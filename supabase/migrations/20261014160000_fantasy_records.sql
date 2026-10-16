-- Verified League of Greatness architecture, supplied schedules and ESPN exports.
-- No provider requests, invented teams, automatic seed tiebreaks or live scores.
create table public.goat_fantasy_teams (
 id uuid primary key default gen_random_uuid(), league_id uuid not null references public.goat_leagues(id),
 user_id uuid not null references auth.users(id),
 franchise_key text not null check(length(btrim(franchise_key)) between 1 and 100),
 external_team_id text not null check(length(btrim(external_team_id)) between 1 and 100),
 name text not null check(length(btrim(name)) between 1 and 150),
 source_url text not null check(source_url ~ '^https://[^[:space:]/]+(/[^[:space:]]*)?$'),
 unique(league_id,user_id),unique(league_id,franchise_key),unique(league_id,external_team_id)
);
create table public.goat_fantasy_matchups (
 id uuid primary key default gen_random_uuid(), league_id uuid not null references public.goat_leagues(id),
 week integer not null check(week between 1 and 17),
 home_id uuid not null references public.goat_fantasy_teams(id),away_id uuid not null references public.goat_fantasy_teams(id),
 starts_at timestamptz not null, source_url text not null check(source_url ~ '^https://[^[:space:]/]+(/[^[:space:]]*)?$'),
 home_raw_score numeric,away_raw_score numeric,home_bonus_applied integer check(home_bonus_applied in (0,2)),
 home_score numeric,away_score numeric,result_source text,finalized_at timestamptz,
 unique(league_id,week,home_id,away_id),check(home_id<>away_id),
 check(home_raw_score is null or (home_raw_score>=0 and home_raw_score<'Infinity'::numeric)),
 check(away_raw_score is null or (away_raw_score>=0 and away_raw_score<'Infinity'::numeric)),
 check(home_score is null or (home_score>=0 and home_score<'Infinity'::numeric)),
 check(away_score is null or (away_score>=0 and away_score<'Infinity'::numeric)),
 check((home_score is null)=(away_score is null) and (home_score is null)=(result_source is null) and (home_score is null)=(finalized_at is null)),
 check(result_source is null or result_source ~ '^https://[^[:space:]/]+(/[^[:space:]]*)?$')
);
create table public.goat_fantasy_seeds (
 league_id uuid references public.goat_leagues(id), seed integer check(seed between 1 and 7),
 team_id uuid not null references public.goat_fantasy_teams(id),
 source_url text not null check(source_url ~ '^https://[^[:space:]/]+(/[^[:space:]]*)?$'),
 primary key(league_id,seed),unique(league_id,team_id)
);
create index goat_fantasy_matchups_league on public.goat_fantasy_matchups(league_id,week);
create index goat_fantasy_teams_user on public.goat_fantasy_teams(user_id);
do $$ declare t text; begin
 foreach t in array array['goat_fantasy_teams','goat_fantasy_matchups','goat_fantasy_seeds'] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('revoke all on public.%I from public,anon,authenticated',t);
  execute format('grant select on public.%I to authenticated',t);
  execute format('create policy fantasy_member on public.%I for select to authenticated using(public.goat_can_view(league_id))',t);
  execute format('create policy live_session on public.%I as restrictive for all to authenticated using((select public.goat_session_valid())) with check((select public.goat_session_valid()))',t);
 end loop;
end $$;
create function public.goat_fantasy_standings(lid uuid) returns jsonb language sql stable security definer set search_path='' as $$
 with results as (
  select t.id team_id,t.user_id,p.display_name,t.name,t.franchise_key,t.external_team_id,
   count(m.id) filter(where m.home_score is not null) played,
   count(m.id) filter(where (m.home_id=t.id and m.home_score>m.away_score) or (m.away_id=t.id and m.away_score>m.home_score)) wins,
   count(m.id) filter(where (m.home_id=t.id and m.home_score<m.away_score) or (m.away_id=t.id and m.away_score<m.home_score)) losses,
   count(m.id) filter(where m.home_score=m.away_score) ties,
   coalesce(sum(case when m.home_id=t.id then m.home_score else m.away_score end),0) points_for,
   coalesce(sum(case when m.home_id=t.id then m.away_score else m.home_score end),0) points_against,
   (select seed from public.goat_fantasy_seeds s where s.league_id=lid and s.team_id=t.id) seed,
   (select case when (f.home_id=t.id and f.home_score>f.away_score) or (f.away_id=t.id and f.away_score>f.home_score) then 1 else 2 end
    from public.goat_fantasy_matchups f where f.league_id=lid and f.week=17 and f.home_score<>f.away_score and t.id in (f.home_id,f.away_id)) rank
  from public.goat_fantasy_teams t join public.goat_profiles p on p.user_id=t.user_id left join public.goat_fantasy_matchups m on m.league_id=t.league_id and m.week<=14 and t.id in (m.home_id,m.away_id)
  where t.league_id=lid group by t.id,p.display_name
 ) select coalesce(jsonb_agg(to_jsonb(r) order by seed nulls last,name),'[]') from results r;
$$;
revoke all on function public.goat_fantasy_standings(uuid) from public,anon,authenticated;

alter function public.goat_command(jsonb) rename to goat_command_v4;
alter function public.goat_query(jsonb) rename to goat_query_v4;
revoke all on function public.goat_command_v4(jsonb),public.goat_query_v4(jsonb) from public,anon,authenticated;
create function public.goat_command(p jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid:=public.goat_actor(); op text:=p->>'op'; lid uuid; l public.goat_leagues; m public.goat_fantasy_matchups;
 eid uuid; item jsonb; team uuid; seeds uuid[]; survivors uuid[]; pairs jsonb; playoff_week integer; n integer; bonus integer; previous jsonb;
begin
 if op like 'fantasy_%' then
  if p ? 'matchup_id' then select league_id into lid from public.goat_fantasy_matchups where id=(p->>'matchup_id')::uuid;
  else lid:=(p->>'league_id')::uuid; end if;
 else return public.goat_command_v4(p); end if;
 select * into l from public.goat_leagues where id=lid for update;
 if l.id is null or l.game_key is distinct from 'league-of-greatness' then raise exception 'fantasy_league_required'; end if;
 if l.owner_id<>actor then raise exception 'commissioner_required' using errcode='42501'; end if;
 if l.status='final' then raise exception 'league_final'; end if;
 eid:=lid;
 case op
 when 'fantasy_team_create' then
  if l.status<>'draft' then raise exception 'roster_frozen'; end if;
  if (select count(*) from public.goat_fantasy_teams where league_id=lid)>=12 then raise exception 'fantasy_twelve_teams_required'; end if;
  insert into public.goat_fantasy_teams(league_id,user_id,franchise_key,external_team_id,name,source_url)
  values(lid,(p->>'user_id')::uuid,p->>'franchise_key',p->>'external_team_id',p->>'name',p->>'source_url') returning id into eid;
 when 'fantasy_schedule_import' then
  if l.status<>'draft' or exists(select 1 from public.goat_fantasy_matchups where league_id=lid) then raise exception 'empty_draft_schedule_required'; end if;
  if jsonb_typeof(p->'matchups') is distinct from 'array' or jsonb_array_length(p->'matchups')<>84 then raise exception 'fantasy_14_week_schedule_required'; end if;
  for item in select * from jsonb_array_elements(p->'matchups') loop
   if (item->>'week')::integer not between 1 and 14 then raise exception 'fantasy_regular_week_required'; end if;
   if (select count(*) from public.goat_fantasy_teams where league_id=lid and id in ((item->>'home_id')::uuid,(item->>'away_id')::uuid))<>2 then raise exception 'fantasy_matchup_teams_invalid'; end if;
   insert into public.goat_fantasy_matchups(league_id,week,home_id,away_id,starts_at,source_url)
   values(lid,(item->>'week')::integer,(item->>'home_id')::uuid,(item->>'away_id')::uuid,(item->>'starts_at')::timestamptz,item->>'source_url');
  end loop;
  for n in 1..14 loop
   if (select count(*) from public.goat_fantasy_matchups x where x.league_id=lid and x.week=n)<>6 or
    exists(select 1 from public.goat_fantasy_teams t where t.league_id=lid and (select count(*) from public.goat_fantasy_matchups x where x.league_id=lid and x.week=n and t.id in (x.home_id,x.away_id))<>1) then raise exception 'fantasy_week_pairing_invalid'; end if;
  end loop;
 when 'fantasy_open' then
  if l.status<>'draft' or l.season !~ '^[0-9]{4}$' or l.season::integer not between 2019 and 2100 or
   (select count(*) from public.goat_fantasy_teams where league_id=lid)<>12 or
   (select count(*) from public.goat_fantasy_matchups where league_id=lid)<>84 then raise exception 'fantasy_season_incomplete'; end if;
  if p->'approved' is distinct from 'true'::jsonb or coalesce(length(btrim(p->>'source_reference')),0)=0 then raise exception 'fantasy_source_approval_required'; end if;
  -- Roster owners become approved season participants; no user metadata roles.
  insert into public.goat_entries(league_id,user_id,status) select lid,user_id,'approved' from public.goat_fantasy_teams where league_id=lid;
  update public.goat_leagues set status='open',rules=jsonb_build_object('approved',true,'source_reference',p->>'source_reference','unresolved',jsonb_build_array('Official tied playoff game and finishing-place policies pending'),'home_bonus_from',2026,'home_bonus',2,'regular_weeks',14,'playoff_teams',7) where id=lid;
 when 'fantasy_result' then
  select * into m from public.goat_fantasy_matchups where id=(p->>'matchup_id')::uuid;
  if l.status<>'open' or m.starts_at>clock_timestamp() then raise exception 'result_not_ready'; end if;
  if m.home_score is not null then raise exception 'correction_required'; end if;
  if p->'verified' is distinct from 'true'::jsonb or jsonb_typeof(p->'source_includes_home_bonus') is distinct from 'boolean' or
   jsonb_typeof(p->'home_score') is distinct from 'number' or jsonb_typeof(p->'away_score') is distinct from 'number' or p->>'source_url' is null then raise exception 'verified_fantasy_scores_required'; end if;
  bonus:=case when l.season::integer>=2026 and p->'source_includes_home_bonus'='false'::jsonb then 2 else 0 end;
  update public.goat_fantasy_matchups set home_raw_score=(p->>'home_score')::numeric,away_raw_score=(p->>'away_score')::numeric,
   home_bonus_applied=bonus,home_score=(p->>'home_score')::numeric+bonus,away_score=(p->>'away_score')::numeric,result_source=p->>'source_url',finalized_at=clock_timestamp() where id=m.id;eid:=m.id;
  insert into public.goat_history(league_id,snapshot,reason) values(lid,public.goat_fantasy_standings(lid),'fantasy_result_finalized');
 when 'fantasy_results_import' then
  if jsonb_typeof(p->'results') is distinct from 'array' or jsonb_array_length(p->'results') not between 1 and 90 or
   (select count(distinct x->>'matchup_id') from jsonb_array_elements(p->'results') x)<>jsonb_array_length(p->'results') then raise exception 'unique_fantasy_results_required'; end if;
  for item in select * from jsonb_array_elements(p->'results') loop
   if not exists(select 1 from public.goat_fantasy_matchups where id=(item->>'matchup_id')::uuid and league_id=lid) then raise exception 'matchup_not_in_league'; end if;
   perform public.goat_command(item||jsonb_build_object('op','fantasy_result'));
  end loop;
 when 'fantasy_playoffs_seed' then
  if l.status<>'open' or exists(select 1 from public.goat_fantasy_matchups where league_id=lid and week<=14 and home_score is null) then raise exception 'fantasy_regular_results_required'; end if;
  if exists(select 1 from public.goat_fantasy_seeds where league_id=lid) then raise exception 'fantasy_seeds_frozen'; end if;
  if jsonb_typeof(p->'team_ids') is distinct from 'array' or jsonb_array_length(p->'team_ids')<>7 or
   (select count(distinct x) from jsonb_array_elements_text(p->'team_ids') x)<>7 or p->'verified' is distinct from 'true'::jsonb or p->>'source_url' is null then raise exception 'verified_fantasy_seeds_required'; end if;
  n:=0;
  for item in select * from jsonb_array_elements(p->'team_ids') loop
   team:=(item#>>'{}')::uuid;n:=n+1;
   if not exists(select 1 from public.goat_fantasy_teams where id=team and league_id=lid) then raise exception 'fantasy_seed_team_invalid'; end if;
   insert into public.goat_fantasy_seeds values(lid,n,team,p->>'source_url');
  end loop;
 when 'fantasy_playoff_round' then
  playoff_week:=(p->>'week')::integer;
  if l.status<>'open' or playoff_week is null or playoff_week not in (15,16,17) then raise exception 'fantasy_playoff_week_invalid'; end if;
  if exists(select 1 from public.goat_fantasy_matchups x where x.league_id=lid and x.week=playoff_week) then raise exception 'fantasy_playoff_round_exists'; end if;
  select array_agg(team_id order by seed) into seeds from public.goat_fantasy_seeds where league_id=lid;
  if array_length(seeds,1) is distinct from 7 then raise exception 'verified_fantasy_seeds_required'; end if;
  if playoff_week=15 then pairs:=jsonb_build_array(jsonb_build_array(seeds[2],seeds[7]),jsonb_build_array(seeds[3],seeds[6]),jsonb_build_array(seeds[4],seeds[5]));
  else
   n:=case when playoff_week=16 then 3 else 2 end;
   if (select count(*) from public.goat_fantasy_matchups x where x.league_id=lid and x.week=playoff_week-1 and x.home_score<>x.away_score)<>n then raise exception 'fantasy_decisive_playoff_results_required'; end if;
   select array_agg(s.team_id order by s.seed) into survivors from public.goat_fantasy_seeds s where s.league_id=lid and
    ((playoff_week=16 and s.seed=1) or exists(select 1 from public.goat_fantasy_matchups x where x.league_id=lid and x.week=playoff_week-1 and s.team_id=case when x.home_score>x.away_score then x.home_id else x.away_id end));
   if playoff_week=16 then pairs:=jsonb_build_array(jsonb_build_array(survivors[1],survivors[4]),jsonb_build_array(survivors[2],survivors[3]));
   else pairs:=jsonb_build_array(jsonb_build_array(survivors[1],survivors[2]));end if;
  end if;
  if jsonb_typeof(p->'schedule') is distinct from 'array' or jsonb_array_length(p->'schedule')<>jsonb_array_length(pairs) then raise exception 'fantasy_playoff_schedule_required'; end if;
  for n in 0..jsonb_array_length(pairs)-1 loop
   item:=p->'schedule'->n;
   if item->>'starts_at' is null then raise exception 'fantasy_playoff_schedule_required'; end if;
   -- Pairings are determined by verified seeds. Home designation is supplied
   -- by the official schedule, never inferred from an unapproved home rule.
   if (item->>'home_id')::uuid is null or (item->>'away_id')::uuid is null or
    not (pairs->n @> jsonb_build_array(item->>'home_id',item->>'away_id')) or item->>'home_id'=item->>'away_id' then raise exception 'fantasy_playoff_pairing_invalid'; end if;
   insert into public.goat_fantasy_matchups(league_id,week,home_id,away_id,starts_at,source_url)
   values(lid,playoff_week,(item->>'home_id')::uuid,(item->>'away_id')::uuid,(item->>'starts_at')::timestamptz,item->>'source_url');
  end loop;
 when 'fantasy_correct' then
  select * into m from public.goat_fantasy_matchups where id=(p->>'matchup_id')::uuid;
  if m.home_score is null or coalesce(length(btrim(p->>'reason')),0)=0 then raise exception 'correction_reason_required'; end if;
  insert into public.goat_history(league_id,snapshot,reason) values(lid,public.goat_fantasy_standings(lid),'before_fantasy_correction');
  select jsonb_agg(to_jsonb(x)) into previous from public.goat_fantasy_matchups x where x.league_id=lid and (x.id=m.id or (x.week>m.week and x.week>14));
  delete from public.goat_fantasy_matchups x where x.league_id=lid and x.week>m.week and x.week>14;
  if m.week<=14 then delete from public.goat_fantasy_seeds where league_id=lid;end if;
  update public.goat_fantasy_matchups set home_raw_score=null,away_raw_score=null,home_bonus_applied=null,home_score=null,away_score=null,result_source=null,finalized_at=null where id=m.id;
  p:=p||jsonb_build_object('previous_results',previous);eid:=m.id;
  insert into public.goat_history(league_id,snapshot,reason) values(lid,public.goat_fantasy_standings(lid),'fantasy_correction_invalidated_dependents');
 when 'fantasy_finalize' then
  if l.status<>'open' or (select count(*) from public.goat_fantasy_matchups where league_id=lid and week=17 and home_score<>away_score)<>1 then raise exception 'fantasy_championship_incomplete'; end if;
  update public.goat_leagues set status='final' where id=lid;
  insert into public.goat_history(league_id,snapshot,reason) values(lid,public.goat_fantasy_standings(lid),'league_finalized');
 else raise exception 'unsupported_fantasy_operation'; end case;
 insert into public.goat_audit(actor_id,action,entity_id,detail) values(actor,op,eid,p);
 return jsonb_build_object('id',eid,'operation',op,'status','recorded');
end $$;
create function public.goat_query(p jsonb) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare actor uuid:=public.goat_actor(); lid uuid:=(p->>'league_id')::uuid; l public.goat_leagues;op text:=p->>'op';
begin
 select * into l from public.goat_leagues where id=lid;
 if l.game_key='league-of-greatness' and op in ('league','standings') then
  if not public.goat_can_view(lid) then raise exception 'league_access_denied' using errcode='42501'; end if;
  if op='standings' then return public.goat_fantasy_standings(lid); end if;
  return public.goat_query_v4(p)||jsonb_build_object(
   'fantasy_teams',(select coalesce(jsonb_agg(to_jsonb(t) order by name),'[]') from public.goat_fantasy_teams t where league_id=lid),
   'fantasy_matchups',(select coalesce(jsonb_agg(to_jsonb(m) order by week,id),'[]') from public.goat_fantasy_matchups m where league_id=lid),
   'fantasy_seeds',(select coalesce(jsonb_agg(to_jsonb(s) order by seed),'[]') from public.goat_fantasy_seeds s where league_id=lid));
 end if;
 return public.goat_query_v4(p);
end $$;
create or replace function public.goat_standings(lid uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare strategy text;
begin
 perform public.goat_actor();if not public.goat_can_view(lid) then raise exception 'league_access_denied' using errcode='42501';end if;
 select l.strategy into strategy from public.goat_leagues l where id=lid;
 if strategy='ncaa_bracket_v1' then return public.goat_bracket_standings(lid);end if;
 if strategy='fantasy_h2h_2026_v1' then return public.goat_fantasy_standings(lid);end if;
 if strategy in ('cross_sport_playoffs_v1','mlb_postseason_v1') then return public.goat_series_standings(lid);end if;
 return public.goat_standings_internal(lid);
end $$;
revoke all on function public.goat_command(jsonb),public.goat_query(jsonb) from public,anon;
grant execute on function public.goat_command(jsonb),public.goat_query(jsonb) to authenticated;
