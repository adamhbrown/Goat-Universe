-- Isolated competition development. No hosted migration has been applied.
-- CLI creation was blocked by its read-only home directory; timestamp is UTC.
-- Policies/schedules are commissioner supplied. No NBA/NHL/MLB rules are seeded.
create table public.goat_series_config (
 league_id uuid primary key references public.goat_leagues(id),
 policy jsonb not null, configured_at timestamptz not null default now()
);
create table public.goat_series_events (
 id uuid primary key default gen_random_uuid(), league_id uuid not null references public.goat_leagues(id),
 code text not null check(length(btrim(code)) between 1 and 80),
 sport text not null check(sport in ('NBA','NHL','MLB')),
 round text not null check(length(btrim(round)) between 1 and 80),
 stage integer not null check(stage between 1 and 32),
 lock_at timestamptz not null, source_url text not null check(source_url ~ '^https://[^[:space:]/]+(/[^[:space:]]*)?$'),
 home_team text, away_team text,
 home_from uuid references public.goat_series_events(id), away_from uuid references public.goat_series_events(id),
 winner text, result_source text, finalized_at timestamptz,
 unique(league_id,code),
 check((home_team is null)<>(home_from is null)), check((away_team is null)<>(away_from is null)),
 check(home_team is null or length(btrim(home_team)) between 1 and 150),
 check(away_team is null or length(btrim(away_team)) between 1 and 150),
 check(home_team is null or away_team is null or home_team<>away_team),
 check(home_from is null or away_from is null or home_from<>away_from),
 check((winner is null)=(result_source is null) and (winner is null)=(finalized_at is null)),
 check(result_source is null or result_source ~ '^https://[^[:space:]/]+(/[^[:space:]]*)?$')
);
create table public.goat_series_picks (
 event_id uuid references public.goat_series_events(id), user_id uuid references auth.users(id),
 team text not null check(length(btrim(team)) between 1 and 150),
 submitted_at timestamptz not null default clock_timestamp(), primary key(event_id,user_id)
);
create index goat_series_events_league on public.goat_series_events(league_id,stage);
create index goat_series_picks_user on public.goat_series_picks(user_id);
do $$ declare t text; begin
 foreach t in array array['goat_series_config','goat_series_events','goat_series_picks'] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('revoke all on public.%I from public,anon,authenticated',t);
  execute format('grant select on public.%I to authenticated',t);
  execute format('create policy live_session on public.%I as restrictive for all to authenticated using((select public.goat_session_valid())) with check((select public.goat_session_valid()))',t);
 end loop;
end $$;
create policy series_config_member on public.goat_series_config for select to authenticated using(public.goat_can_view(league_id));
create policy series_events_member on public.goat_series_events for select to authenticated using(public.goat_can_view(league_id));
create policy series_picks_private on public.goat_series_picks for select to authenticated using(exists
 (select 1 from public.goat_series_events e where e.id=event_id and public.goat_can_view(e.league_id) and (user_id=auth.uid() or e.lock_at<=now())));

create function public.goat_series_policy_valid(key text, season text, policy jsonb) returns boolean
 language plpgsql immutable set search_path='' as $$
declare sports text[]; sport text; matrix jsonb; points jsonb;
begin
 sports:=case key when 'goat-crossover' then array['NBA','NHL'] when 'goat-classic' then array['MLB'] else null end;
 if sports is null or jsonb_typeof(policy) is distinct from 'object' or policy->'approved' is distinct from 'true'::jsonb or
  policy->>'game_id' is distinct from key or policy->>'season' is distinct from season or
  coalesce(length(btrim(policy->>'source_reference')),0)=0 or policy->'unresolved' is distinct from '[]'::jsonb or
  policy->>'missing_policy' is null or policy->>'missing_policy' not in ('zero','block') or policy->>'tie_policy' is distinct from 'shared_rank'
 then return false; end if;
 matrix:=policy->'points_by_sport';
 if jsonb_typeof(matrix) is distinct from 'object' then return false; end if;
 if (select array_agg(x order by x) from jsonb_object_keys(matrix) x) is distinct from (select array_agg(x order by x) from unnest(sports) x) then return false; end if;
 foreach sport in array sports loop
  if jsonb_typeof(matrix->sport) is distinct from 'object' then return false; end if;
  if (select count(*) from jsonb_object_keys(matrix->sport))=0 then return false; end if;
  for points in select value from jsonb_each(matrix->sport) loop
   if jsonb_typeof(points) is distinct from 'number' or points::text !~ '^[0-9]+$' or points::numeric>9007199254740991 then return false; end if;
  end loop;
 end loop;
 return true;
end $$;
create function public.goat_series_candidates(eid uuid) returns table(team text)
 language sql stable security definer set search_path='' as $$
 with recursive tree as (
  select e.* from public.goat_series_events e where e.id=eid
  union all select e.* from public.goat_series_events e join tree t on (e.id=t.home_from or e.id=t.away_from) and t.winner is null
 ) select winner from tree where winner is not null
 union select home_team from tree where home_team is not null and winner is null
 union select away_team from tree where away_team is not null and winner is null;
$$;
create function public.goat_series_standings(lid uuid) returns jsonb
 language sql stable security definer set search_path='' as $$
 with scored as (
  select en.user_id,pr.display_name,
   coalesce(sum(case when e.winner=k.team then (c.policy->'points_by_sport'->e.sport->>e.round)::numeric else 0 end),0) points,
   count(*) filter(where e.winner=k.team) correct,
   count(k.event_id) entered
  from public.goat_entries en join public.goat_profiles pr on pr.user_id=en.user_id
  join public.goat_series_config c on c.league_id=en.league_id
  left join public.goat_series_events e on e.league_id=en.league_id
  left join public.goat_series_picks k on k.event_id=e.id and k.user_id=en.user_id
  where en.league_id=lid and en.status='approved' group by en.user_id,pr.display_name
 ), ranked as(select *,rank() over(order by points desc) rank from scored)
 select coalesce(jsonb_agg(to_jsonb(r)||jsonb_build_object('sports',
  (select coalesce(jsonb_agg(to_jsonb(s) order by sport),'[]') from (
   select e.sport,coalesce(sum(case when e.winner=k.team then (c.policy->'points_by_sport'->e.sport->>e.round)::numeric else 0 end),0) points,
    count(*) filter(where e.winner=k.team) correct
   from public.goat_series_events e join public.goat_series_config c on c.league_id=e.league_id
   left join public.goat_series_picks k on k.event_id=e.id and k.user_id=r.user_id
   where e.league_id=lid group by e.sport
  ) s)) order by rank,display_name),'[]') from ranked r;
$$;
revoke all on function public.goat_series_policy_valid(text,text,jsonb),public.goat_series_candidates(uuid),public.goat_series_standings(uuid) from public,anon,authenticated;

alter function public.goat_command(jsonb) rename to goat_command_v3;
alter function public.goat_query(jsonb) rename to goat_query_v3;
revoke all on function public.goat_command_v3(jsonb),public.goat_query_v3(jsonb) from public,anon,authenticated;
create function public.goat_command(p jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid:=public.goat_actor(); op text:=p->>'op'; lid uuid; l public.goat_leagues;
 c public.goat_series_config; e public.goat_series_events; f public.goat_series_events;
 item jsonb; selected text; home text; away text; eid uuid; stamp timestamptz; previous jsonb;
begin
 if op like 'series_%' then
  -- Only event_id selects an event's parent. Extraneous bracket/round IDs
  -- cannot redirect authorization to a league owned by the caller.
  if p ? 'event_id' then select league_id into lid from public.goat_series_events where id=(p->>'event_id')::uuid;
  else lid:=(p->>'league_id')::uuid; end if;
 elsif op in ('enroll','entry_decide','league_finalize') then lid:=(p->>'league_id')::uuid;
 else return public.goat_command_v3(p); end if;
 select * into l from public.goat_leagues where id=lid for update;
 if l.id is null or l.game_key not in ('goat-crossover','goat-classic') or l.game_key is null then
  if op like 'series_%' then raise exception 'series_league_required'; end if;
  return public.goat_command_v3(p);
 end if;
 if op not like 'series_%' and l.status='draft' then return public.goat_command_v3(p); end if;
 if l.status='final' then raise exception 'league_final'; end if;
 if op not in ('enroll','series_submit') and l.owner_id<>actor then raise exception 'commissioner_required' using errcode='42501'; end if;
 select * into c from public.goat_series_config where league_id=lid;
 stamp:=clock_timestamp(); eid:=lid;
 case op
 when 'series_configure' then
  if l.status<>'draft' then raise exception 'rules_frozen'; end if;
  if not public.goat_series_policy_valid(l.game_key,l.season,p->'policy') then raise exception 'series_policy_approval_required'; end if;
  if exists(select 1 from public.goat_series_events x where x.league_id=lid and not ((p->'policy'->'points_by_sport'->x.sport) ? x.round)) then raise exception 'series_scoring_round_missing'; end if;
  insert into public.goat_series_config(league_id,policy) values(lid,p->'policy') on conflict(league_id) do update set policy=excluded.policy,configured_at=stamp;
 when 'series_event_create' then
  if l.status<>'draft' then raise exception 'schedule_frozen'; end if;
  if (l.game_key='goat-crossover' and coalesce(p->>'sport','') not in ('NBA','NHL')) or
   (l.game_key='goat-classic' and p->>'sport' is distinct from 'MLB') then raise exception 'series_sport_invalid'; end if;
  if c.league_id is not null and not coalesce((c.policy->'points_by_sport'->(p->>'sport')) ? (p->>'round'),false) then raise exception 'series_scoring_round_missing'; end if;
  if (p->>'lock_at') is null or (p->>'lock_at')::timestamptz<=stamp then raise exception 'invalid_deadline'; end if;
  for selected in select x.value from jsonb_each_text(p) x where x.key in ('home_from','away_from') and x.value is not null loop
   select * into f from public.goat_series_events where id=selected::uuid;
   if f.id is null or f.league_id<>lid or f.sport is distinct from p->>'sport' or f.stage>=(p->>'stage')::integer or f.lock_at>=(p->>'lock_at')::timestamptz then raise exception 'invalid_series_feeder'; end if;
   if exists(select 1 from public.goat_series_events x where x.home_from=f.id or x.away_from=f.id) then raise exception 'series_feeder_already_used'; end if;
  end loop;
  insert into public.goat_series_events(league_id,code,sport,round,stage,lock_at,source_url,home_team,away_team,home_from,away_from)
  values(lid,p->>'code',p->>'sport',p->>'round',(p->>'stage')::integer,(p->>'lock_at')::timestamptz,p->>'source_url',p->>'home_team',p->>'away_team',(p->>'home_from')::uuid,(p->>'away_from')::uuid) returning id into eid;
 when 'series_schedule_import' then
  if l.status<>'draft' or exists(select 1 from public.goat_series_events where league_id=lid) then raise exception 'empty_draft_schedule_required'; end if;
  if jsonb_typeof(p->'events') is distinct from 'array' or jsonb_array_length(p->'events') not between 1 and 256 then raise exception 'series_schedule_required'; end if;
  for item in select value from jsonb_array_elements(p->'events') order by (value->>'stage')::integer loop
   -- A batch may only configure its own league, never honor extra routing IDs.
   item:=item-'event_id'-'node_id'-'round_id'-'game_id';
   if item ? 'home_from_code' then
    select id into eid from public.goat_series_events where league_id=lid and code=item->>'home_from_code';
    if eid is null then raise exception 'invalid_series_feeder'; end if;
    item:=item||jsonb_build_object('home_from',eid);
   end if;
   if item ? 'away_from_code' then
    select id into eid from public.goat_series_events where league_id=lid and code=item->>'away_from_code';
    if eid is null then raise exception 'invalid_series_feeder'; end if;
    item:=item||jsonb_build_object('away_from',eid);
   end if;
   perform public.goat_command(item||jsonb_build_object('op','series_event_create','league_id',lid));
  end loop;
  eid:=lid;
 when 'series_open' then
  if l.status<>'draft' or c.league_id is null or not public.goat_series_policy_valid(l.game_key,l.season,c.policy) or coalesce(length(btrim(p->>'reason')),0)=0 then raise exception 'series_policy_approval_required'; end if;
  if not exists(select 1 from public.goat_series_events where league_id=lid) or
   (l.game_key='goat-crossover' and (select count(distinct sport) from public.goat_series_events where league_id=lid)<>2) then raise exception 'series_required_sport_missing'; end if;
  if exists(select 1 from public.goat_series_events where league_id=lid and lock_at<=stamp) then raise exception 'invalid_deadline'; end if;
  if (select sum((c.policy->'points_by_sport'->sport->>round)::numeric) from public.goat_series_events where league_id=lid)>9007199254740991 then raise exception 'series_points_overflow'; end if;
  update public.goat_leagues set status='open' where id=lid;
 when 'enroll','entry_decide' then
  if l.status<>'open' or exists(select 1 from public.goat_series_events where league_id=lid and lock_at<=stamp) then raise exception 'enrollment_closed'; end if;
  if op='enroll' then insert into public.goat_entries(league_id,user_id) values(lid,actor) on conflict do nothing;
  else
   if jsonb_typeof(p->'approved') is distinct from 'boolean' then raise exception 'entry_decision_required'; end if;
   update public.goat_entries set status=case when (p->>'approved')::boolean then 'approved' else 'rejected' end where league_id=lid and user_id=(p->>'user_id')::uuid;
   if not found then raise exception 'entry_not_found'; end if;
  end if;
 when 'series_submit' then
  if l.status<>'open' then raise exception 'selections_locked'; end if;
  if not exists(select 1 from public.goat_entries where league_id=lid and user_id=actor and status='approved') then raise exception 'approved_entry_required' using errcode='42501'; end if;
  if jsonb_typeof(p->'picks') is distinct from 'array' or jsonb_array_length(p->'picks') not between 1 and 256 or
   (select count(distinct x->>'event_id') from jsonb_array_elements(p->'picks') x)<>jsonb_array_length(p->'picks') then raise exception 'unique_series_picks_required'; end if;
  for item in select * from jsonb_array_elements(p->'picks') loop
   select * into e from public.goat_series_events where id=(item->>'event_id')::uuid and league_id=lid;
   if e.id is null then raise exception 'event_not_in_league'; end if;
   if e.lock_at<=stamp then raise exception 'selections_locked'; end if;
   if not exists(select 1 from public.goat_series_candidates(e.id) x where x.team=item->>'team') then raise exception 'invalid_series_selection'; end if;
  end loop;
  for item in select * from jsonb_array_elements(p->'picks') loop
   insert into public.goat_series_picks(event_id,user_id,team,submitted_at) values((item->>'event_id')::uuid,actor,item->>'team',stamp)
   on conflict(event_id,user_id) do update set team=excluded.team,submitted_at=excluded.submitted_at;
  end loop;
 when 'series_result' then
  select * into e from public.goat_series_events where id=(p->>'event_id')::uuid;
  if l.status<>'open' or e.lock_at>stamp then raise exception 'result_not_ready'; end if;
  if e.winner is not null then raise exception 'correction_required'; end if;
  home:=coalesce(e.home_team,(select winner from public.goat_series_events where id=e.home_from));
  away:=coalesce(e.away_team,(select winner from public.goat_series_events where id=e.away_from));
  if home is null or away is null then raise exception 'feeder_results_required'; end if;
  if p->>'winner' is null or p->>'winner' not in (home,away) or p->>'source_url' is null then raise exception 'sourced_series_winner_required'; end if;
  update public.goat_series_events set winner=p->>'winner',result_source=p->>'source_url',finalized_at=stamp where id=e.id; eid:=e.id;
  insert into public.goat_history(league_id,snapshot,reason) values(lid,public.goat_series_standings(lid),'series_result_finalized');
 when 'series_results_import' then
  if jsonb_typeof(p->'results') is distinct from 'array' or jsonb_array_length(p->'results') not between 1 and 256 or
   (select count(distinct x->>'event_id') from jsonb_array_elements(p->'results') x)<>jsonb_array_length(p->'results') then raise exception 'unique_series_results_required'; end if;
  for item in select value from jsonb_array_elements(p->'results') order by (select stage from public.goat_series_events where id=(value->>'event_id')::uuid) loop
   if not exists(select 1 from public.goat_series_events where id=(item->>'event_id')::uuid and league_id=lid) then raise exception 'event_not_in_league'; end if;
   perform public.goat_command(item||jsonb_build_object('op','series_result'));
  end loop;
 when 'series_correct' then
  select * into e from public.goat_series_events where id=(p->>'event_id')::uuid;
  if e.winner is null or coalesce(length(btrim(p->>'reason')),0)=0 then raise exception 'correction_reason_required'; end if;
  insert into public.goat_history(league_id,snapshot,reason) values(lid,public.goat_series_standings(lid),'before_series_correction');
  with recursive affected as(select e.id union all select x.id from public.goat_series_events x join affected a on x.home_from=a.id or x.away_from=a.id)
  select jsonb_agg(to_jsonb(x)) into previous from public.goat_series_events x join affected a on a.id=x.id;
  with recursive affected as(select e.id union all select x.id from public.goat_series_events x join affected a on x.home_from=a.id or x.away_from=a.id)
  update public.goat_series_events set winner=null,result_source=null,finalized_at=null where id in(select id from affected);
  p:=p||jsonb_build_object('previous_results',previous); eid:=e.id;
  insert into public.goat_history(league_id,snapshot,reason) values(lid,public.goat_series_standings(lid),'series_correction_invalidated_dependents');
 when 'series_finalize','league_finalize' then
  if l.status<>'open' or not exists(select 1 from public.goat_entries where league_id=lid and status='approved') or
   exists(select 1 from public.goat_series_events where league_id=lid and winner is null) then raise exception 'league_incomplete'; end if;
  if c.policy->>'missing_policy'='block' and exists(select 1 from public.goat_entries en cross join public.goat_series_events x where en.league_id=lid and en.status='approved' and x.league_id=lid and not exists(select 1 from public.goat_series_picks k where k.event_id=x.id and k.user_id=en.user_id)) then raise exception 'missing_submissions'; end if;
  update public.goat_leagues set status='final' where id=lid;
  insert into public.goat_history(league_id,snapshot,reason) values(lid,public.goat_series_standings(lid),'league_finalized');
 else raise exception 'unsupported_series_operation';
 end case;
 insert into public.goat_audit(actor_id,action,entity_id,detail) values(actor,op,eid,p);
 return jsonb_build_object('id',eid,'operation',op,'status','recorded');
end $$;
create function public.goat_query(p jsonb) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare actor uuid:=public.goat_actor(); lid uuid:=(p->>'league_id')::uuid; l public.goat_leagues; op text:=p->>'op';
begin
 select * into l from public.goat_leagues where id=lid;
 if l.game_key in ('goat-crossover','goat-classic') and op in ('league','standings') then
  if not public.goat_can_view(lid) then raise exception 'league_access_denied' using errcode='42501'; end if;
  if op='standings' then return public.goat_series_standings(lid); end if;
  return public.goat_query_v3(p)||jsonb_build_object('series_config',(select to_jsonb(c) from public.goat_series_config c where league_id=lid),
   'series_events',(select coalesce(jsonb_agg(to_jsonb(e) order by stage,code),'[]') from public.goat_series_events e where league_id=lid),
   'series_picks',(select coalesce(jsonb_agg(to_jsonb(k)),'[]') from public.goat_series_picks k join public.goat_series_events e on e.id=k.event_id where e.league_id=lid and (k.user_id=actor or e.lock_at<=now())));
 end if;
 return public.goat_query_v3(p);
end $$;
create or replace function public.goat_standings(lid uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare strategy text;
begin
 perform public.goat_actor();
 if not public.goat_can_view(lid) then raise exception 'league_access_denied' using errcode='42501'; end if;
 select l.strategy into strategy from public.goat_leagues l where id=lid;
 if strategy='ncaa_bracket_v1' then return public.goat_bracket_standings(lid); end if;
 if strategy in ('cross_sport_playoffs_v1','mlb_postseason_v1') then return public.goat_series_standings(lid); end if;
 if strategy<>'ranked_ats_v1' then return '[]'; end if;
 return public.goat_standings_internal(lid);
end $$;
revoke all on function public.goat_command(jsonb),public.goat_query(jsonb) from public,anon;
grant execute on function public.goat_command(jsonb),public.goat_query(jsonb) to authenticated;
