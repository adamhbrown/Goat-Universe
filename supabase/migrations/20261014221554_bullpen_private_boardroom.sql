-- Additive prototype migration. Apply locally only until Adam approves a
-- specific isolated hosted target. Never add this schema to exposed schemas.
create schema bullpen_private;
revoke all on schema bullpen_private from public,anon,authenticated;

create table bullpen_private.seats (
 id text primary key check(id in ('adam','tiffany','pope','codex')),
 name text not null, role text not null,
 user_id uuid unique references auth.users(id),
 enabled boolean not null default false,
 connection_kind text not null default 'manual' check(connection_kind in ('manual','api')),
 last_seen_at timestamptz, last_api_poll_at timestamptz,
 binding_version integer not null default 1
);
insert into bullpen_private.seats(id,name,role) values
 ('adam','Adam','Founder & CEO'),
 ('tiffany','Tiffany','Product & Integration Lead'),
 ('pope','Pope Henry I','Security & Infrastructure Lead'),
 ('codex','Codex','Chief Development Engineer');

create table bullpen_private.messages (
 id bigint generated always as identity primary key,
 seat text not null references bullpen_private.seats(id),
 actor_id uuid not null references auth.users(id),
 source text not null check(source in ('manual','api')),
 content text not null check(length(btrim(content)) between 1 and 8000),
 mentions text[] not null default '{}',
 reply_to bigint references bullpen_private.messages(id),
 client_id uuid not null, created_at timestamptz not null default now(),
 unique(actor_id,client_id)
);
create index bullpen_message_replies on bullpen_private.messages(reply_to,seat);
create table bullpen_private.receipts (
 message_id bigint references bullpen_private.messages(id),
 seat text references bullpen_private.seats(id),
 binding_version integer not null,
 received_at timestamptz not null default now(),
 primary key(message_id,seat,binding_version)
);
create table bullpen_private.tasks (
 id uuid primary key default gen_random_uuid(),
 work_key text not null check(work_key ~ '^[a-z0-9][a-z0-9_/-]{2,119}$'),
 title text not null check(length(btrim(title)) between 1 and 200),
 owner text not null references bullpen_private.seats(id),
 priority text not null check(priority in ('urgent','high','normal','low')),
 deadline timestamptz,
 status text not null default 'todo' check(status in ('todo','in_progress','blocked','awaiting_approval','done','canceled')),
 blocker text not null default '' check(length(blocker)<=2000),
 branch text not null default '' check(length(branch)<=200),
 pr_url text not null default '' check(pr_url='' or pr_url ~ '^https://github[.]com/adamhbrown/Goat-Universe/pull/[0-9]+$'),
 evidence text not null default '' check(length(evidence)<=4000),
 approval_kind text not null default 'none' check(approval_kind in ('none','purchase','migration','destructive','production_deployment','major_change')),
 approval_state text not null default 'not_required' check(approval_state in ('not_required','pending','approved','rejected')),
 version integer not null default 1,
 created_by uuid not null references auth.users(id),
 updated_at timestamptz not null default now(),
 check(status<>'blocked' or length(btrim(blocker))>0),
 check(status<>'done' or length(btrim(evidence))>0),
 check(status<>'done' or approval_kind='none' or approval_state='approved')
);
-- A canonical work key reserves the lane until completion/cancellation.
create unique index bullpen_active_work on bullpen_private.tasks(work_key) where status not in ('done','canceled');
create index bullpen_task_owner on bullpen_private.tasks(owner,status,deadline);
create table bullpen_private.intelligence (
 id uuid primary key default gen_random_uuid(),
 topic text not null check(topic ~ '^[a-z0-9][a-z0-9_/-]{2,119}$'),
 kind text not null check(kind in ('decision','rule','finding','launch_blocker')),
 content text not null check(length(btrim(content)) between 1 and 8000),
 evidence text not null check(length(btrim(evidence)) between 1 and 4000),
 state text not null check(state in ('recorded','proposed','approved','rejected','superseded')),
 seat text not null references bullpen_private.seats(id),
 created_by uuid not null references auth.users(id), created_at timestamptz not null default now()
);
create unique index bullpen_current_rule on bullpen_private.intelligence(topic) where state='approved';
create index bullpen_intel_time on bullpen_private.intelligence(created_at desc,id);
create table bullpen_private.audit (
 id bigint generated always as identity primary key,
 actor_id uuid not null references auth.users(id), seat text not null,
 action text not null, entity_id text not null, detail jsonb not null,
 created_at timestamptz not null default now()
);
do $$ declare t text; begin
 foreach t in array array['seats','messages','receipts','tasks','intelligence','audit'] loop
  execute format('alter table bullpen_private.%I enable row level security',t);
  execute format('revoke all on bullpen_private.%I from public,anon,authenticated,service_role',t);
 end loop;
end $$;
revoke all on all sequences in schema bullpen_private from public,anon,authenticated,service_role;

-- Deliberate, narrow definer boundary: there are no table privileges or public
-- definer RPCs. Both entry points recheck live sessions and database membership.
create function bullpen_private.actor_seat() returns text language plpgsql stable security definer set search_path='' as $$
declare result text;
begin
 if not public.goat_session_valid() then raise exception 'authentication_required' using errcode='28000'; end if;
 select id into result from bullpen_private.seats where user_id=auth.uid() and enabled;
 if result is null then raise exception 'bullpen_membership_required' using errcode='42501'; end if;
 return result;
end $$;

create function bullpen_private.command(p jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare
 who text:=bullpen_private.actor_seat(); actor uuid:=auth.uid(); op text:=p->>'op';
 result jsonb; ident text; existing bullpen_private.messages; task bullpen_private.tasks; next_task bullpen_private.tasks;
 intel bullpen_private.intelligence; target text; mentions text[]; kind text;
begin
 if jsonb_typeof(p) is distinct from 'object' or octet_length(p::text)>30000 then raise exception 'invalid_request'; end if;
 -- Defense in depth for recognizable credentials; arbitrary secrets cannot be
 -- identified reliably. Never paste credentials; workers read them from env.
 if p::text ~* '(sb_secret_[a-z0-9_-]+|sk-(proj-|svcacct-)?[a-z0-9_-]{20,}|github_pat_[a-z0-9_]+|gh[pousr]_[a-z0-9]{20,}|eyJ[a-z0-9_-]+[.]eyJ[a-z0-9_-]+[.][a-z0-9_-]+|-----BEGIN [A-Z ]*PRIVATE KEY|postgres(ql)?://[^ ]+@)' then
  raise exception 'credential_content_forbidden';
 end if;
 if op='message_post' then
  if jsonb_typeof(p->'content') is distinct from 'string' or length(btrim(p->>'content')) not between 1 and 8000 or p->>'client_id' is null then raise exception 'invalid_message'; end if;
  select * into existing from bullpen_private.messages where actor_id=actor and client_id=(p->>'client_id')::uuid;
  if found then
   if existing.content<>(p->>'content') or existing.reply_to is distinct from (p->>'reply_to')::bigint then raise exception 'message_retry_conflict'; end if;
   return to_jsonb(existing);
  end if;
  kind:=coalesce(p->>'source','manual');
  if kind not in ('manual','api') then raise exception 'invalid_message_source'; end if;
  if kind='api' and not exists(select 1 from bullpen_private.seats where id=who and connection_kind='api') then raise exception 'api_connection_required' using errcode='42501'; end if;
  if kind='api' and p->>'reply_to' is not null and not exists(
   select 1 from bullpen_private.receipts r join bullpen_private.seats s on s.id=r.seat
   where r.message_id=(p->>'reply_to')::bigint and r.seat=who and r.binding_version=s.binding_version
  ) then raise exception 'read_context_required'; end if;
  select coalesce(array_agg(s.id order by s.id),'{}') into mentions from bullpen_private.seats s
   where s.id<>'adam' and (p->>'content') ~* ('(^|[^a-z0-9_])@'||s.id||'([^a-z0-9_]|$)');
  insert into bullpen_private.messages(seat,actor_id,source,content,mentions,reply_to,client_id)
   values(who,actor,kind,p->>'content',mentions,(p->>'reply_to')::bigint,(p->>'client_id')::uuid) returning to_jsonb(messages),id::text into result,ident;
 elsif op='seat_bind' then
  if who<>'adam' then raise exception 'ceo_required' using errcode='42501'; end if;
  target:=p->>'seat';
  if target is null or target not in ('tiffany','pope','codex') then raise exception 'invalid_agent_seat'; end if;
  if jsonb_typeof(p->'enabled') is distinct from 'boolean' or p->>'connection_kind' is null or p->>'connection_kind' not in ('manual','api') then raise exception 'invalid_connection'; end if;
  update bullpen_private.seats set user_id=(p->>'user_id')::uuid,enabled=(p->>'enabled')::boolean,
   connection_kind=p->>'connection_kind',last_seen_at=null,last_api_poll_at=null,binding_version=binding_version+1
   where id=target and binding_version=(p->>'version')::integer returning to_jsonb(seats),id into result,ident;
  if result is null then raise exception 'seat_version_conflict'; end if;
  if (p->>'enabled')::boolean and p->>'user_id' is null then raise exception 'account_binding_required'; end if;
 elsif op in ('task_create','task_update','task_decide') then
  if op='task_create' then
   if who not in ('adam','tiffany') and p->>'owner' is distinct from who then raise exception 'task_owner_required' using errcode='42501'; end if;
   insert into bullpen_private.tasks(work_key,title,owner,priority,deadline,branch,pr_url,approval_kind,approval_state,created_by)
    values(lower(btrim(p->>'work_key')),p->>'title',p->>'owner',coalesce(p->>'priority','normal'),nullif(p->>'deadline','')::timestamptz,
     coalesce(p->>'branch',''),coalesce(p->>'pr_url',''),coalesce(p->>'approval_kind','none'),
     case when coalesce(p->>'approval_kind','none')='none' then 'not_required' else 'pending' end,actor)
    returning to_jsonb(tasks),id::text into result,ident;
  else
   select * into task from bullpen_private.tasks where id=(p->>'id')::uuid for update;
   if task.id is null then raise exception 'task_unavailable'; end if;
   if p->>'version' is null or task.version<>(p->>'version')::integer then raise exception 'task_version_conflict'; end if;
   if op='task_decide' then
    if who<>'adam' then raise exception 'ceo_required' using errcode='42501'; end if;
    if jsonb_typeof(p->'approved') is distinct from 'boolean' or length(btrim(coalesce(p->>'reason',''))) not between 1 and 2000 then raise exception 'decision_reason_required'; end if;
    if task.approval_state<>'pending' then raise exception 'pending_approval_required'; end if;
    update bullpen_private.tasks set approval_state=case when (p->>'approved')::boolean then 'approved' else 'rejected' end,
     version=version+1,updated_at=now() where id=task.id returning to_jsonb(tasks),id::text into result,ident;
   else
    if who not in ('adam','tiffany',task.owner) then raise exception 'task_owner_required' using errcode='42501'; end if;
    if who not in ('adam','tiffany') and p ?| array['work_key','title','owner','priority','deadline','approval_kind','branch','pr_url'] then raise exception 'coordinator_required' using errcode='42501'; end if;
    next_task:=jsonb_populate_record(task,p - array['op','id','version','created_by','updated_at','approval_state']);
    if next_task.approval_kind is distinct from task.approval_kind and who<>'adam' then raise exception 'ceo_required' using errcode='42501'; end if;
    next_task.work_key:=lower(btrim(next_task.work_key));
    if row(next_task.work_key,next_task.title,next_task.owner,next_task.priority,next_task.deadline,next_task.branch,next_task.pr_url,next_task.approval_kind)
     is distinct from row(task.work_key,task.title,task.owner,task.priority,task.deadline,task.branch,task.pr_url,task.approval_kind) then
     next_task.approval_state:=case when next_task.approval_kind='none' then 'not_required' else 'pending' end;
    end if;
    -- Closed work is immutable; corrections create a new, explicitly owned item.
    if task.status in ('done','canceled') then raise exception 'task_closed'; end if;
    update bullpen_private.tasks set work_key=next_task.work_key,title=next_task.title,owner=next_task.owner,priority=next_task.priority,
     deadline=next_task.deadline,status=next_task.status,blocker=next_task.blocker,branch=next_task.branch,pr_url=next_task.pr_url,
     evidence=next_task.evidence,approval_kind=next_task.approval_kind,approval_state=next_task.approval_state,version=version+1,updated_at=now()
     where id=task.id returning to_jsonb(tasks),id::text into result,ident;
   end if;
  end if;
 elsif op='intelligence_add' then
  kind:=p->>'kind';
  insert into bullpen_private.intelligence(topic,kind,content,evidence,state,seat,created_by)
   values(p->>'topic',kind,p->>'content',p->>'evidence',case when kind in ('rule','decision') then 'proposed' else 'recorded' end,who,actor)
   returning to_jsonb(intelligence),id::text into result,ident;
 elsif op='intelligence_decide' then
  if who<>'adam' then raise exception 'ceo_required' using errcode='42501'; end if;
  if jsonb_typeof(p->'approved') is distinct from 'boolean' or length(btrim(coalesce(p->>'reason',''))) not between 1 and 2000 then raise exception 'decision_reason_required'; end if;
  select * into intel from bullpen_private.intelligence where id=(p->>'id')::uuid for update;
  if intel.id is null or intel.state<>'proposed' then raise exception 'proposed_record_required'; end if;
  -- Serialize decisions for the same topic, then supersede the old authority.
  perform pg_advisory_xact_lock(hashtextextended(intel.topic,0));
  if (p->>'approved')::boolean then
   update bullpen_private.intelligence set state='superseded' where topic=intel.topic and state='approved';
  end if;
  update bullpen_private.intelligence set state=case when (p->>'approved')::boolean then 'approved' else 'rejected' end
   where id=intel.id returning to_jsonb(intelligence),id::text into result,ident;
 else raise exception 'invalid_bullpen_command';
 end if;
 insert into bullpen_private.audit(actor_id,seat,action,entity_id,detail)
  values(actor,who,op,ident,jsonb_build_object('result',result,'reason',p->>'reason'));
 return result;
end $$;

create function bullpen_private.query(p jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare who text:=bullpen_private.actor_seat(); op text:=coalesce(p->>'op','snapshot');
 rows jsonb; cursor_id bigint:=0; result jsonb; mid bigint;
begin
 if jsonb_typeof(p) is distinct from 'object' then raise exception 'invalid_request'; end if;
 if op='acceptance' then
  mid:=(p->>'message_id')::bigint;
  if not exists(select 1 from bullpen_private.messages where id=mid) then raise exception 'message_unavailable'; end if;
  return jsonb_build_object('message_id',mid,'seats',(
   select jsonb_agg(jsonb_build_object('seat',s.id,'name',s.name,
    'received_at',(select r.received_at from bullpen_private.receipts r where r.message_id=mid and r.seat=s.id and r.binding_version=s.binding_version),
    'reply_id',(select min(m.id) from bullpen_private.messages m where m.reply_to=mid and m.seat=s.id and m.actor_id=s.user_id and m.source='api'),
    'connection_kind',s.connection_kind,'enabled',s.enabled,'bound',s.user_id is not null))
   from bullpen_private.seats s where s.id<>'adam'));
 end if;
 if op not in ('snapshot','poll','history') then raise exception 'invalid_bullpen_query'; end if;
 update bullpen_private.seats set last_seen_at=now() where id=who;
 if op='poll' then
  if who='adam' or not exists(select 1 from bullpen_private.seats where id=who and connection_kind='api') then raise exception 'api_connection_required' using errcode='42501'; end if;
  cursor_id:=coalesce((p->>'after')::bigint,0);
  if cursor_id<0 then raise exception 'invalid_cursor'; end if;
  select coalesce(jsonb_agg(to_jsonb(m) order by m.id),'[]'),coalesce(max(m.id),cursor_id)
   into rows,cursor_id from (select * from bullpen_private.messages where id>cursor_id order by id limit 100) m;
  insert into bullpen_private.receipts(message_id,seat,binding_version)
   select (m->>'id')::bigint,who,s.binding_version from jsonb_array_elements(rows) m cross join bullpen_private.seats s where s.id=who
   on conflict do nothing;
  update bullpen_private.seats set last_api_poll_at=now() where id=who;
 else
  select coalesce(jsonb_agg(to_jsonb(m) order by m.id),'[]') into rows from (
   select * from bullpen_private.messages where op='snapshot' or id<(p->>'before')::bigint order by id desc limit 100
  ) m;
 end if;
 result:=jsonb_build_object('conversation','GOAT Universe Bullpen','me',who,'server_time',now(),
  'messages',rows,'next_cursor',cursor_id,
  'has_more',case when op='poll' then exists(select 1 from bullpen_private.messages where id>cursor_id) else false end,
  'seats',(select jsonb_agg(jsonb_build_object('id',s.id,'name',s.name,'role',s.role,'bound',s.user_id is not null,'enabled',s.enabled,
   'user_id',case when who='adam' then s.user_id else null end,'version',s.binding_version,'connection_kind',s.connection_kind,
   'last_seen_at',s.last_seen_at,'last_api_poll_at',s.last_api_poll_at,
   'status',case when s.user_id is null then 'unbound' when not s.enabled then 'disabled' when s.connection_kind='manual' then 'manual'
    when s.last_api_poll_at is null then 'api_waiting' when s.last_api_poll_at<now()-interval '90 seconds' then 'stale' else 'connected' end) order by case s.id when 'adam' then 0 when 'tiffany' then 1 when 'pope' then 2 else 3 end) from bullpen_private.seats s),
  'tasks',(select coalesce(jsonb_agg(to_jsonb(t) order by t.updated_at desc,t.id),'[]') from bullpen_private.tasks t),
  'intelligence',(select coalesce(jsonb_agg(to_jsonb(i) order by i.created_at desc,i.id),'[]') from bullpen_private.intelligence i));
 return result;
end $$;

revoke all on all functions in schema bullpen_private from public,anon,authenticated,service_role;
grant usage on schema bullpen_private to authenticated;
grant execute on function bullpen_private.command(jsonb),bullpen_private.query(jsonb) to authenticated;
create function public.bullpen_command(p jsonb) returns jsonb language sql security invoker set search_path='' as $$ select bullpen_private.command(p); $$;
create function public.bullpen_query(p jsonb) returns jsonb language sql security invoker set search_path='' as $$ select bullpen_private.query(p); $$;
revoke all on function public.bullpen_command(jsonb),public.bullpen_query(jsonb) from public,anon,service_role;
grant execute on function public.bullpen_command(jsonb),public.bullpen_query(jsonb) to authenticated;
