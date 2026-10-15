-- Competition commands must compare real time after acquiring league locks.
-- transaction_timestamp()/now() can be stale after a request waits for a lock.
-- Preserve original migration files, function identities and revoked grants.
do $$ declare impl text; definition text; begin
 foreach impl in array array['public.goat_command_v1(jsonb)','public.goat_command_v3(jsonb)'] loop
  definition:=pg_get_functiondef(impl::regprocedure);
  execute replace(definition,'now()','clock_timestamp()');
 end loop;
end $$;

create table public.goat_finish_certifications (
 league_id uuid primary key references public.goat_leagues(id),
 snapshot jsonb not null, source_url text not null check(source_url ~ '^https://[^[:space:]/]+(/[^[:space:]]*)?$'),
 source_reference text not null check(length(btrim(source_reference))>0),
 certified_by uuid not null references auth.users(id),certified_at timestamptz not null default now()
);
create table public.goat_championships (
 id uuid primary key default gen_random_uuid(),owner_id uuid not null references auth.users(id),
 name text not null check(length(btrim(name)) between 1 and 120),season integer not null check(season between 2026 and 2100),
 policy jsonb,status text not null default 'draft' check(status in ('draft','final')),
 final_snapshot jsonb,created_at timestamptz not null default now()
);
create table public.goat_championship_results (
 championship_id uuid references public.goat_championships(id),
 game_key text check(game_key in ('first-and-baa','horns-and-hoops','goat-crossover','league-of-greatness','goat-classic')),
 league_id uuid not null references public.goat_leagues(id),snapshot jsonb not null,
 source_url text not null,recorded_at timestamptz not null default now(),primary key(championship_id,game_key),unique(championship_id,league_id)
);
create index goat_championships_owner on public.goat_championships(owner_id,season);
create function public.goat_championship_can_view(cid uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.goat_championships where id=cid and owner_id=auth.uid()) or
 exists(select 1 from public.goat_championship_results r join public.goat_entries e on e.league_id=r.league_id where r.championship_id=cid and e.user_id=auth.uid() and e.status='approved');
$$;
revoke all on function public.goat_championship_can_view(uuid) from public,anon;
grant execute on function public.goat_championship_can_view(uuid) to authenticated;
do $$ declare t text; begin
 foreach t in array array['goat_finish_certifications','goat_championships','goat_championship_results'] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('revoke all on public.%I from public,anon,authenticated',t);
  execute format('grant select on public.%I to authenticated',t);
  execute format('create policy live_session on public.%I as restrictive for all to authenticated using((select public.goat_session_valid())) with check((select public.goat_session_valid()))',t);
 end loop;
end $$;
create policy finish_member on public.goat_finish_certifications for select to authenticated using(public.goat_can_view(league_id));
create policy championship_member on public.goat_championships for select to authenticated using(public.goat_championship_can_view(id));
create policy championship_results_member on public.goat_championship_results for select to authenticated using(public.goat_championship_can_view(championship_id));
create function public.goat_annual_policy_valid(p jsonb,season integer) returns boolean language plpgsql immutable set search_path='' as $$
declare table_points jsonb; point jsonb; previous numeric; amount numeric;
begin
 if jsonb_typeof(p) is distinct from 'object' or p->'approved' is distinct from 'true'::jsonb or
  p->>'season' is distinct from season::text or p->>'tie_policy' is distinct from 'shared_rank' or
  coalesce(length(btrim(p->>'source_reference')),0)<4 or jsonb_typeof(p->'conversions') is distinct from 'object' then return false;end if;
 if (select array_agg(x order by x) from jsonb_object_keys(p->'conversions') x) is distinct from array['first-and-baa','goat-classic','goat-crossover','horns-and-hoops','league-of-greatness'] then return false;end if;
 for table_points in select value from jsonb_each(p->'conversions') loop
  if jsonb_typeof(table_points) is distinct from 'array' then return false;end if;
  if jsonb_array_length(table_points) not between 1 and 100000 then return false;end if;
  previous:=null;
  for point in select * from jsonb_array_elements(table_points) loop
   if jsonb_typeof(point) is distinct from 'number' or point::text !~ '^[0-9]+$' then return false;end if;
   amount:=point::numeric;if amount>9007199254740991 or (previous is not null and amount>previous) then return false;end if;
   previous:=amount;
  end loop;
 end loop;
 return true;
end $$;
create function public.goat_annual_standings(cid uuid) returns jsonb language sql stable security definer set search_path='' as $$
 with finishes as (
  select (x->>'user_id')::uuid user_id,x->>'display_name' display_name,r.game_key,(x->>'place')::integer place,r.source_url,
   (c.policy->'conversions'->r.game_key->>((x->>'place')::integer-1))::numeric baas
  from public.goat_championship_results r join public.goat_championships c on c.id=r.championship_id cross join lateral jsonb_array_elements(r.snapshot) x where r.championship_id=cid
 ), totals as (
  select user_id,max(display_name) display_name,sum(baas) baas,count(*) competitions,
   jsonb_agg(jsonb_build_object('game_key',game_key,'place',place,'baas',baas,'source_url',source_url) order by game_key) breakdown
  from finishes group by user_id
 ), ranked as(select *,rank() over(order by baas desc) rank from totals)
 select coalesce(jsonb_agg(to_jsonb(r) order by rank,display_name),'[]') from ranked r;
$$;
revoke all on function public.goat_annual_policy_valid(jsonb,integer),public.goat_annual_standings(uuid) from public,anon,authenticated;

alter function public.goat_command(jsonb) rename to goat_command_v5;
alter function public.goat_query(jsonb) rename to goat_query_v5;
revoke all on function public.goat_command_v5(jsonb),public.goat_query_v5(jsonb) from public,anon,authenticated;
create function public.goat_command(p jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid:=public.goat_actor(); op text:=p->>'op'; cid uuid:=(p->>'championship_id')::uuid;
 c public.goat_championships;l public.goat_leagues; cert public.goat_finish_certifications;lid uuid:=(p->>'league_id')::uuid;
 eid uuid;item jsonb;board jsonb;finish jsonb;snapshot jsonb:='[]';key text;place integer;
begin
 if op='competition_finish_certify' then
  select * into l from public.goat_leagues where id=lid for update;
  if l.owner_id is distinct from actor then raise exception 'commissioner_required' using errcode='42501';end if;
  if l.status<>'final' then raise exception 'final_league_required';end if;
  if exists(select 1 from public.goat_finish_certifications where league_id=lid) then raise exception 'finishes_already_certified';end if;
  if p->'verified' is distinct from 'true'::jsonb or coalesce(length(btrim(p->>'source_reference')),0)=0 or jsonb_typeof(p->'finishes') is distinct from 'array' then raise exception 'verified_finishes_required';end if;
  board:=public.goat_standings(lid);
  if jsonb_array_length(board)=0 or jsonb_array_length(p->'finishes')<>jsonb_array_length(board) or
   (select count(distinct x->>'user_id') from jsonb_array_elements(p->'finishes') x)<>jsonb_array_length(board) then raise exception 'complete_unique_finishes_required';end if;
  for item in select * from jsonb_array_elements(board) loop
   select value into finish from jsonb_array_elements(p->'finishes') where value->>'user_id'=item->>'user_id';
   if finish is null or jsonb_typeof(finish->'place') is distinct from 'number' or finish->>'place' !~ '^[0-9]+$' then raise exception 'finish_place_invalid';end if;
   place:=(finish->>'place')::integer;
   if place not between 1 and jsonb_array_length(board) then raise exception 'finish_place_invalid';end if;
   -- Known computed places cannot be rewritten by supplied certification.
   -- Fantasy places 3–12 require a sourced official finishing order; no seed
   -- or regular-season record is silently substituted for a finishing place.
   if item->>'rank' is not null and (item->>'rank')::integer<>place then raise exception 'finish_conflicts_with_standings';end if;
   snapshot:=snapshot||jsonb_build_array(item||jsonb_build_object('place',place));
  end loop;
  insert into public.goat_finish_certifications values(lid,snapshot,p->>'source_url',p->>'source_reference',actor,now());eid:=lid;
 elsif op='annual_create' then
  insert into public.goat_championships(owner_id,name,season) values(actor,p->>'name',(p->>'season')::integer) returning id into eid;
 elsif op like 'annual_%' then
  select * into c from public.goat_championships where id=cid for update;
  if c.owner_id is distinct from actor then raise exception 'championship_owner_required' using errcode='42501';end if;
  if c.status='final' then raise exception 'championship_final';end if;eid:=cid;
  case op
  when 'annual_policy_set' then
   if exists(select 1 from public.goat_championship_results where championship_id=cid) then raise exception 'annual_policy_frozen';end if;
   if not public.goat_annual_policy_valid(p->'policy',c.season) then raise exception 'baas_policy_approval_required';end if;
   update public.goat_championships set policy=p->'policy' where id=cid;
  when 'annual_competition_attach' then
   if c.policy is null then raise exception 'baas_policy_approval_required';end if;
   select * into l from public.goat_leagues where id=lid for update;
   if l.owner_id is distinct from actor then raise exception 'commissioner_required' using errcode='42501';end if;
   if l.status<>'final' or l.season is distinct from c.season::text then raise exception 'final_season_league_required';end if;
   select * into cert from public.goat_finish_certifications where league_id=lid;
   if cert.league_id is null then raise exception 'certified_finishes_required';end if;
   key:=coalesce(l.game_key,case l.strategy when 'ranked_ats_v1' then 'first-and-baa' when 'ncaa_bracket_v1' then 'horns-and-hoops' end);
   if key is null then raise exception 'official_game_required';end if;
   if exists(select 1 from jsonb_array_elements(cert.snapshot) x where (x->>'place')::integer>jsonb_array_length(c.policy->'conversions'->key)) then raise exception 'baas_place_not_configured';end if;
   if exists(select 1 from public.goat_championship_results where championship_id=cid and game_key=key) then raise exception 'annual_game_already_attached';end if;
   insert into public.goat_championship_results(championship_id,game_key,league_id,snapshot,source_url) values(cid,key,lid,cert.snapshot,cert.source_url);
   if exists(select 1 from jsonb_array_elements(public.goat_annual_standings(cid)) x where (x->>'baas')::numeric>9007199254740991) then raise exception 'baas_total_overflow';end if;
  when 'annual_finalize' then
   if c.policy is null or (select count(*) from public.goat_championship_results where championship_id=cid)<>5 then raise exception 'annual_five_finished_games_required';end if;
   update public.goat_championships set status='final',final_snapshot=public.goat_annual_standings(cid) where id=cid;
  else raise exception 'unsupported_annual_operation';end case;
 else return public.goat_command_v5(p);end if;
 insert into public.goat_audit(actor_id,action,entity_id,detail) values(actor,op,eid,p);
 return jsonb_build_object('id',eid,'operation',op,'status','recorded');
end $$;
create function public.goat_query(p jsonb) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare actor uuid:=public.goat_actor();op text:=p->>'op';cid uuid:=(p->>'championship_id')::uuid;c public.goat_championships;result jsonb;
begin
 if op='annuals' then
  return (select coalesce(jsonb_agg(to_jsonb(a) order by a.created_at desc),'[]') from public.goat_championships a where public.goat_championship_can_view(a.id));
 elsif op in ('annual','annual_standings') then
  if not public.goat_championship_can_view(cid) then raise exception 'championship_access_denied' using errcode='42501';end if;
  select * into c from public.goat_championships where id=cid;
  if op='annual_standings' then
   if c.policy is null then raise exception 'baas_policy_approval_required';end if;
   return coalesce(c.final_snapshot,public.goat_annual_standings(cid));
  end if;
  return to_jsonb(c)||jsonb_build_object('baas_awarded',false,'competitions',(select coalesce(jsonb_agg(to_jsonb(r) order by game_key),'[]') from public.goat_championship_results r where championship_id=cid));
 elsif op='member_history' then
  -- user_id in the request is deliberately ignored; this is a self-only view.
  return (select coalesce(jsonb_agg(jsonb_build_object('league_id',l.id,'name',l.name,'season',l.season,'game_key',l.game_key,'certified',f.league_id is not null,
   'finish',(select x from jsonb_array_elements(f.snapshot) x where x->>'user_id'=actor::text)) order by l.created_at desc),'[]')
   from public.goat_leagues l join public.goat_entries e on e.league_id=l.id and e.user_id=actor and e.status='approved'
   left join public.goat_finish_certifications f on f.league_id=l.id where l.status='final');
 elsif op='competition_dashboard' then
  return jsonb_build_object('server_time',now(),'competitions',
   (select jsonb_agg(jsonb_build_object('game_key',g.key,'leagues',
    (select coalesce(jsonb_agg(to_jsonb(l)||jsonb_build_object('entry_status',e.status,
     'series_policy_approved',exists(select 1 from public.goat_series_config sc where sc.league_id=l.id),
     'finishes_certified',exists(select 1 from public.goat_finish_certifications f where f.league_id=l.id)) order by l.created_at desc),'[]')
     from public.goat_leagues l left join public.goat_entries e on e.league_id=l.id and e.user_id=actor
     where (l.owner_id=actor or e.user_id=actor) and coalesce(l.game_key,case l.strategy when 'ranked_ats_v1' then 'first-and-baa' when 'ncaa_bracket_v1' then 'horns-and-hoops' end)=g.key)))
    from (values('first-and-baa'),('horns-and-hoops'),('goat-crossover'),('league-of-greatness'),('goat-classic')) g(key)));
 end if;
 result:=public.goat_query_v5(p);
 if op='league' then return result||jsonb_build_object('finish_certification',(select to_jsonb(f) from public.goat_finish_certifications f where f.league_id=(p->>'league_id')::uuid));end if;
 return result;
end $$;
revoke all on function public.goat_command(jsonb),public.goat_query(jsonb) from public,anon;
grant execute on function public.goat_command(jsonb),public.goat_query(jsonb) to authenticated;
-- Keep infrastructure's v4 Auth baseline; identify the additive competition
-- migration independently so staging can verify this feature set explicitly.
create or replace function public.goat_health() returns jsonb language sql stable set search_path='' as $$
 select '{"database_ok":true,"schema_version":4,"competition_schema_version":1}'::jsonb;
$$;
