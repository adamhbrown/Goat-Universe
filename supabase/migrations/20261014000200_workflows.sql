create function public.goat_command(p jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare
 actor uuid:=public.goat_actor(); op text:=p->>'op'; lid uuid; rid uuid; eid uuid;
 l public.goat_leagues; r public.goat_rounds; g public.goat_games; pr public.goat_prospects;
 weights integer[]; selected_weights integer[]; option_weights integer[]; weight_options jsonb; item jsonb; signal jsonb;
 n integer; score integer:=0; result jsonb; note text:=p->>'reason';
begin
 if op='league_create' then
  insert into public.goat_leagues(owner_id,name,sport,season,strategy,rules)
  values(actor,p->>'name',p->>'sport',p->>'season','ranked_ats_v1',coalesce(p->'rules','{}')) returning id into eid;
 elsif op in ('league_rules','league_open','round_create','game_create','round_open','enroll','entry_decide','picks_submit','result_set','mvp_result','round_finalize','round_reopen','league_finalize') then
  if p ? 'round_id' then
   rid:=(p->>'round_id')::uuid; select league_id into lid from public.goat_rounds where id=rid;
  elsif p ? 'game_id' then
   select * into g from public.goat_games where id=(p->>'game_id')::uuid;
   rid:=g.round_id; select league_id into lid from public.goat_rounds where id=rid;
  else lid:=(p->>'league_id')::uuid; end if;
  select * into l from public.goat_leagues where id=lid for update;
  if l.id is null then raise exception 'league_not_found'; end if;
  if l.status='final' then raise exception 'league_final'; end if;
  if op not in ('enroll','picks_submit') and l.owner_id<>actor then raise exception 'commissioner_required' using errcode='42501'; end if;
  if rid is not null then select * into r from public.goat_rounds where id=rid for update; end if;
  eid:=coalesce(rid,lid);
  case op
  when 'league_rules' then
   if l.status<>'draft' then raise exception 'rules_frozen'; end if;
   update public.goat_leagues set rules=p->'rules' where id=lid;
  when 'league_open' then
   if l.status<>'draft' or coalesce(l.rules->>'approved','false')<>'true' or
    coalesce(length(l.rules->>'source_reference'),0)=0 or l.rules->>'tiebreaker' is distinct from 'ats_record' or
    coalesce(l.rules->'unresolved','[]')<>'[]'::jsonb or coalesce(length(note),0)=0 then raise exception 'rules_approval_required'; end if;
   select sum((select sum(w) from unnest(x.weights) w)+x.mvp_bonus) into n from public.goat_rounds x where league_id=lid;
   if n is null or n is distinct from (l.rules->>'max_points')::integer then raise exception 'point_budget_mismatch'; end if;
   update public.goat_leagues set status='open' where id=lid;
  when 'round_create' then
   if l.status<>'draft' then raise exception 'schedule_frozen'; end if;
   select array_agg(v::integer order by v::integer) into weights from jsonb_array_elements_text(p->'weights') v;
   if weights is null or array_length(weights,1)=0 or exists(select 1 from unnest(weights) w where w<=0) or
    (select count(distinct w) from unnest(weights) w)<>array_length(weights,1) then raise exception 'invalid_weights'; end if;
   weight_options:=coalesce(p->'weight_options',jsonb_build_array(to_jsonb(weights)));
   if jsonb_typeof(weight_options)<>'array' or jsonb_array_length(weight_options)=0 then raise exception 'invalid_weight_options'; end if;
   for item in select * from jsonb_array_elements(weight_options) loop
    select array_agg(v::integer order by v::integer) into option_weights from jsonb_array_elements_text(item) v;
    if array_length(option_weights,1) is distinct from array_length(weights,1) or
     (select sum(w) from unnest(option_weights) w) is distinct from (select sum(w) from unnest(weights) w) or
     exists(select 1 from unnest(option_weights) w where w<=0) or
     (select count(distinct w) from unnest(option_weights) w)<>array_length(weights,1) then raise exception 'invalid_weight_options'; end if;
   end loop;
   insert into public.goat_rounds(league_id,name,lock_at,weights,weight_options,mvp_bonus) values(lid,p->>'name',(p->>'lock_at')::timestamptz,weights,weight_options,coalesce((p->>'mvp_bonus')::integer,0)) returning id into eid;
  when 'game_create' then
   if r.status<>'draft' then raise exception 'round_frozen'; end if;
   insert into public.goat_games(round_id,home,away,starts_at,home_spread,source_url)
   values(rid,p->>'home',p->>'away',(p->>'starts_at')::timestamptz,(p->>'home_spread')::numeric,p->>'source_url') returning id into eid;
  when 'round_open' then
   if l.status<>'open' or r.status<>'draft' then raise exception 'invalid_state'; end if;
   if coalesce((p->>'approved')::boolean,false)=false or coalesce(length(note),0)=0 or
    p->>'missing_policy' is null or p->>'push_multiplier' is null then raise exception 'round_rules_required'; end if;
   if r.lock_at<=now() or exists(select 1 from public.goat_games where round_id=rid and starts_at<r.lock_at) then raise exception 'invalid_deadline'; end if;
   if (select count(*) from public.goat_games where round_id=rid)<>array_length(r.weights,1) then raise exception 'game_weight_count_mismatch'; end if;
   update public.goat_rounds set status='open',approved=true,push_multiplier=(p->>'push_multiplier')::numeric,missing_policy=p->>'missing_policy' where id=rid;
  when 'enroll' then
   if l.status<>'open' or exists(select 1 from public.goat_rounds where league_id=lid and lock_at<=now()) then raise exception 'enrollment_closed'; end if;
   insert into public.goat_entries(league_id,user_id) values(lid,actor) on conflict do nothing;
  when 'entry_decide' then
   if exists(select 1 from public.goat_rounds where league_id=lid and lock_at<=now()) then raise exception 'enrollment_closed'; end if;
   update public.goat_entries set status=case when (p->>'approved')::boolean then 'approved' else 'rejected' end where league_id=lid and user_id=(p->>'user_id')::uuid;
   if not found then raise exception 'entry_not_found'; end if;
  when 'picks_submit' then
   if r.status<>'open' or r.lock_at<=now() then raise exception 'selections_locked'; end if;
   if not exists(select 1 from public.goat_entries where league_id=lid and user_id=actor and status='approved') then raise exception 'approved_entry_required' using errcode='42501'; end if;
   if jsonb_typeof(p->'picks') is distinct from 'array' then raise exception 'invalid_picks'; end if;
   n:=jsonb_array_length(p->'picks');
   if n<>array_length(r.weights,1) or (select count(distinct x->>'game_id') from jsonb_array_elements(p->'picks') x)<>n then raise exception 'complete_unique_picks_required'; end if;
   select array_agg((x->>'weight')::integer order by (x->>'weight')::integer) into selected_weights from jsonb_array_elements(p->'picks') x;
   if not exists(select 1 from jsonb_array_elements(r.weight_options) x where
    (select array_agg(v::integer order by v::integer) from jsonb_array_elements_text(x) v)=selected_weights) then raise exception 'weight_allocation_invalid'; end if;
   if r.mvp_bonus>0 and coalesce(length(p->>'mvp_pick'),0)=0 then raise exception 'mvp_pick_required'; end if;
   for item in select * from jsonb_array_elements(p->'picks') loop
    if not exists(select 1 from public.goat_games where id=(item->>'game_id')::uuid and round_id=rid) then raise exception 'game_not_in_round'; end if;
   end loop;
   delete from public.goat_picks where user_id=actor and game_id in(select id from public.goat_games where round_id=rid);
   for item in select * from jsonb_array_elements(p->'picks') loop
    insert into public.goat_picks(game_id,user_id,side,weight) values((item->>'game_id')::uuid,actor,item->>'side',(item->>'weight')::integer);
   end loop;
   insert into public.goat_submissions(round_id,user_id,mvp_pick) values(rid,actor,p->>'mvp_pick')
    on conflict(round_id,user_id) do update set mvp_pick=excluded.mvp_pick,submitted_at=now();
  when 'result_set' then
   if r.status not in ('open','locked') or r.lock_at>now() or g.starts_at>now() then raise exception 'result_not_ready'; end if;
   if p->>'source_url' is null then raise exception 'result_evidence_required'; end if;
   update public.goat_rounds set status='locked' where id=rid;
   update public.goat_games set home_score=(p->>'home_score')::integer,away_score=(p->>'away_score')::integer,result_source=p->>'source_url' where id=g.id;
   if p->>'home_score' is null or p->>'away_score' is null then raise exception 'scores_required'; end if;
   eid:=g.id; p:=p||jsonb_build_object('previous_result',jsonb_build_object('home_score',g.home_score,'away_score',g.away_score,'source',g.result_source));
  when 'mvp_result' then
   if r.status not in ('open','locked') or r.lock_at>now() or r.mvp_bonus=0 or coalesce(length(p->>'mvp_result'),0)=0 or coalesce(p->>'source_url','') not like 'https://%' then raise exception 'mvp_result_not_ready'; end if;
   update public.goat_rounds set mvp_result=p->>'mvp_result' where id=rid;
  when 'round_finalize' then
   if r.status<>'locked' or exists(select 1 from public.goat_games where round_id=rid and (home_score is null or result_source is null)) or (r.mvp_bonus>0 and r.mvp_result is null) then raise exception 'results_incomplete'; end if;
   if r.missing_policy='block' and exists(select 1 from public.goat_entries e where e.league_id=lid and e.status='approved' and not exists(select 1 from public.goat_submissions s where s.round_id=rid and s.user_id=e.user_id)) then raise exception 'missing_submissions'; end if;
   update public.goat_rounds set status='final' where id=rid;
   insert into public.goat_history(league_id,round_id,snapshot,reason) values(lid,rid,public.goat_standings(lid),'round_finalized');
  when 'round_reopen' then
   if r.status<>'final' or coalesce(length(note),0)=0 then raise exception 'correction_reason_required'; end if;
   update public.goat_rounds set status='locked' where id=rid;
  when 'league_finalize' then
   if l.status<>'open' or exists(select 1 from public.goat_rounds where league_id=lid and status<>'final') or not exists(select 1 from public.goat_entries where league_id=lid and status='approved') then raise exception 'league_incomplete'; end if;
   update public.goat_leagues set status='final' where id=lid;
   insert into public.goat_history(league_id,snapshot,reason) values(lid,public.goat_standings(lid),'league_finalized');
  end case;
 elsif op in ('crm_prospect','crm_draft','crm_interest','crm_opportunity','research_job') then
  if not(public.goat_has_role('researcher')) then raise exception 'researcher_required' using errcode='42501'; end if;
  case op
  when 'crm_prospect' then
   if jsonb_typeof(p->'signals') is distinct from 'array' or jsonb_array_length(p->'signals')<>5 then raise exception 'five_evidence_signals_required'; end if;
   if (select count(distinct x->>'name') from jsonb_array_elements(p->'signals') x where x->>'name' in ('audience_fit','commercial_fit','decision_access','timing','engagement'))<>5 then raise exception 'signal_names_required'; end if;
   for signal in select * from jsonb_array_elements(p->'signals') loop
    n:=(signal->>'value')::integer;
    if n is null or n<0 or n>5 or (n>0 and coalesce(length(signal->>'evidence'),0)=0) then raise exception 'signal_evidence_required'; end if;
    score:=score+n*4;
   end loop;
   insert into public.goat_prospects(organization,website,category,source_url,evidence,signals,score,created_by)
   values(p->>'organization',lower(rtrim(p->>'website','/')),p->>'category',p->>'source_url',p->>'evidence',p->'signals',score,actor) returning id into eid;
  when 'crm_draft' then
   select * into pr from public.goat_prospects where id=(p->>'prospect_id')::uuid;
   if pr.id is null or pr.permission='do_not_contact' then raise exception 'prospect_unavailable'; end if;
   if coalesce(length(p->>'subject'),0)=0 or coalesce(length(p->>'body'),0)=0 then raise exception 'draft_content_required'; end if;
   insert into public.goat_drafts(prospect_id,subject,body,created_by) values(pr.id,p->>'subject',p->>'body',actor) returning id into eid;
  when 'crm_interest' then
   if coalesce(length(p->>'response_evidence'),0)=0 then raise exception 'response_evidence_required'; end if;
   update public.goat_prospects set interest=p->>'interest',permission=p->>'permission',response_evidence=p->>'response_evidence',follow_up_at=(p->>'follow_up_at')::timestamptz where id=(p->>'prospect_id')::uuid returning id into eid;
   if eid is null then raise exception 'prospect_not_found'; end if;
  when 'crm_opportunity' then
   if p->>'stage'='won' and not public.goat_has_role('approver') then raise exception 'approver_required' using errcode='42501'; end if;
   if exists(select 1 from public.goat_opportunities where id=(p->>'opportunity_id')::uuid and stage='won') and not public.goat_has_role('approver') then raise exception 'approver_required' using errcode='42501'; end if;
   if p ? 'opportunity_id' then
    update public.goat_opportunities set amount=(p->>'amount')::numeric,currency=p->>'currency',probability=(p->>'probability')::numeric,stage=p->>'stage',evidence_url=p->>'evidence_url'
    where id=(p->>'opportunity_id')::uuid returning id into eid;
    if eid is null then raise exception 'opportunity_not_found'; end if;
   else
    insert into public.goat_opportunities(prospect_id,amount,currency,probability,stage,evidence_url,created_by)
    values((p->>'prospect_id')::uuid,(p->>'amount')::numeric,p->>'currency',(p->>'probability')::numeric,p->>'stage',p->>'evidence_url',actor) returning id into eid;
   end if;
  when 'research_job' then
   insert into public.goat_research_jobs(query,created_by) values(p->>'query',actor) returning id into eid;
  end case;
 elsif op='crm_decide' then
  if not public.goat_has_role('approver') then raise exception 'approver_required' using errcode='42501'; end if;
  if coalesce(length(note),0)=0 then raise exception 'decision_reason_required'; end if;
  if exists(select 1 from public.goat_drafts d join public.goat_prospects prospect_row on prospect_row.id=d.prospect_id where d.id=(p->>'draft_id')::uuid and prospect_row.permission='do_not_contact') then raise exception 'prospect_unavailable'; end if;
  update public.goat_drafts set status=case when (p->>'approved')::boolean then 'approved' else 'rejected' end,decided_by=actor,decision_note=note,decided_at=now()
  where id=(p->>'draft_id')::uuid and status='pending' returning id into eid;
  if eid is null then raise exception 'pending_draft_required'; end if;
 elsif op='analytics_event' then
  if coalesce((p->>'consent')::boolean,false)=false then raise exception 'analytics_consent_required'; end if;
  insert into public.goat_analytics(user_id,event,resource) values(actor,p->>'event',left(p->>'resource',120));
 elsif op='newsletter_consent' then
  if coalesce(length(p->>'consent_version'),0)=0 then raise exception 'consent_version_required'; end if;
  insert into public.goat_newsletter(user_id,opted_in,consent_version) values(actor,(p->>'opted_in')::boolean,p->>'consent_version')
  on conflict(user_id) do update set opted_in=excluded.opted_in,consent_version=excluded.consent_version,updated_at=now();
 else raise exception 'unsupported_operation';
 end if;
 -- Picks are private until locked; audit records never expose picks through member queries.
 insert into public.goat_audit(actor_id,action,entity_id,detail) values(actor,op,eid,p);
 return jsonb_build_object('id',eid,'operation',op,'status','recorded');
end $$;

create function public.goat_query(p jsonb) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare actor uuid:=public.goat_actor(); lid uuid:=(p->>'league_id')::uuid; out jsonb; op text:=p->>'op'; begin
 if op='me' then
  return jsonb_build_object('profile',(select to_jsonb(x) from public.goat_profiles x where user_id=actor),'roles',(select coalesce(jsonb_agg(role),'[]') from public.goat_roles where user_id=actor),'membership',(select to_jsonb(x) from public.goat_memberships x where user_id=actor));
 elsif op='leagues' then
  select coalesce(jsonb_agg(to_jsonb(x)),'[]') into out from public.goat_leagues x where public.goat_can_view(x.id); return out;
 elsif op in ('league','standings','history') then
  if not public.goat_can_view(lid) then raise exception 'league_access_denied' using errcode='42501'; end if;
  if op='standings' then return public.goat_standings(lid); end if;
  if op='history' then select coalesce(jsonb_agg(to_jsonb(x) order by id),'[]') into out from public.goat_history x where league_id=lid; return out; end if;
  return jsonb_build_object('league',(select to_jsonb(x) from public.goat_leagues x where id=lid),
   'rounds',(select coalesce(jsonb_agg(to_jsonb(x)),'[]') from public.goat_rounds x where league_id=lid),
   'games',(select coalesce(jsonb_agg(to_jsonb(g)),'[]') from public.goat_games g join public.goat_rounds r on r.id=g.round_id where r.league_id=lid),
   'entries',(select coalesce(jsonb_agg(to_jsonb(e)),'[]') from public.goat_entries e where league_id=lid),
   'picks',(select coalesce(jsonb_agg(to_jsonb(k)),'[]') from public.goat_picks k join public.goat_games g on g.id=k.game_id join public.goat_rounds r on r.id=g.round_id where r.league_id=lid and (k.user_id=actor or r.lock_at<=now())));
 elsif op in ('crm_report','crm_records') then
  if not(public.goat_has_role('researcher') or public.goat_has_role('approver')) then raise exception 'crm_access_denied' using errcode='42501'; end if;
  if op='crm_records' then return jsonb_build_object('prospects',(select coalesce(jsonb_agg(to_jsonb(x)),'[]') from public.goat_prospects x),'drafts',(select coalesce(jsonb_agg(to_jsonb(x)),'[]') from public.goat_drafts x),'opportunities',(select coalesce(jsonb_agg(to_jsonb(x)),'[]') from public.goat_opportunities x),'research_jobs',(select coalesce(jsonb_agg(to_jsonb(x)),'[]') from public.goat_research_jobs x)); end if;
  return jsonb_build_object('prospects',(select count(*) from public.goat_prospects),'interested',(select count(*) from public.goat_prospects where interest='interested'),
   'awaiting_approval',(select count(*) from public.goat_drafts where status='pending'),
   'follow_ups',(select coalesce(jsonb_agg(jsonb_build_object('id',id,'organization',organization,'due',follow_up_at)),'[]') from public.goat_prospects where follow_up_at<=now() and permission<>'do_not_contact'),
   'pipeline_by_currency',(select coalesce(jsonb_agg(to_jsonb(x)),'[]') from (select currency, sum(amount) filter(where stage='won') as contracted_revenue,sum(amount*probability) filter(where stage not in ('won','lost')) as weighted_pipeline from public.goat_opportunities group by currency) x));
 elsif op='executive_report' then
  if not public.goat_has_role('executive') then raise exception 'executive_required' using errcode='42501'; end if;
  return jsonb_build_object('accounts',(select count(*) from public.goat_profiles),'approved_entries',(select count(*) from public.goat_entries where status='approved'),
   'newsletter_opt_ins',(select count(*) from public.goat_newsletter where opted_in),'active_memberships',(select count(*) from public.goat_memberships where status in ('active','trialing') and (expires_at is null or expires_at>now())),
   'analytics',(select coalesce(jsonb_agg(to_jsonb(x)),'[]') from(select event,count(*) from public.goat_analytics group by event)x),'commercial',public.goat_query('{"op":"crm_report"}'));
 else raise exception 'unsupported_query'; end if;
end $$;

-- Only the server's verified billing webhook can call this RPC.
create function public.goat_payment_event(p jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
begin
 insert into public.goat_payment_events(event_id,event_type) values(p->>'event_id',p->>'event_type') on conflict do nothing;
 if not found then return '{"duplicate":true}'; end if;
 if p ? 'user_id' then
  insert into public.goat_memberships(user_id,tier,status,subscription_id,provider_event_time,expires_at)
   values((p->>'user_id')::uuid,p->>'tier',p->>'status',p->>'subscription_id',(p->>'event_time')::bigint,(p->>'expires_at')::timestamptz)
   on conflict(user_id) do update set tier=excluded.tier,status=excluded.status,subscription_id=excluded.subscription_id,provider_event_time=excluded.provider_event_time,expires_at=excluded.expires_at
   where public.goat_memberships.subscription_id=excluded.subscription_id and public.goat_memberships.provider_event_time<excluded.provider_event_time;
 end if;
 return '{"recorded":true}';
end $$;
revoke all on function public.goat_command(jsonb),public.goat_query(jsonb),public.goat_payment_event(jsonb) from public,anon;
grant execute on function public.goat_command(jsonb),public.goat_query(jsonb) to authenticated;
revoke all on function public.goat_payment_event(jsonb) from authenticated;
grant execute on function public.goat_payment_event(jsonb) to service_role;

create function public.goat_health() returns jsonb language sql stable set search_path='' as $$ select '{"database_ok":true,"schema_version":2}'::jsonb; $$;
revoke all on function public.goat_health() from public;
grant execute on function public.goat_health() to anon,authenticated,service_role;
