-- Supabase Auth owns production credentials. No user-supplied metadata grants roles.
create table public.goat_profiles (
 user_id uuid primary key references auth.users(id) on delete cascade,
 display_name text not null check(length(display_name) between 1 and 80),
 created_at timestamptz not null default now()
);
create table public.goat_roles (
 user_id uuid references auth.users(id) on delete cascade,
 role text check(role in ('researcher','approver','executive')),
 primary key(user_id,role)
);
create table public.goat_leagues (
 id uuid primary key default gen_random_uuid(), owner_id uuid not null references auth.users(id),
 name text not null check(length(name) between 1 and 120), sport text not null,
 season text not null, strategy text not null check(strategy='ranked_ats_v1'),
 status text not null default 'draft' check(status in ('draft','open','final')),
 rules jsonb not null default '{}', created_at timestamptz not null default now()
);
create table public.goat_entries (
 league_id uuid references public.goat_leagues(id), user_id uuid references auth.users(id),
 status text not null default 'pending' check(status in ('pending','approved','rejected')),
 joined_at timestamptz not null default now(), primary key(league_id,user_id)
);
create table public.goat_rounds (
 id uuid primary key default gen_random_uuid(), league_id uuid not null references public.goat_leagues(id),
 name text not null, lock_at timestamptz not null, weights integer[] not null, weight_options jsonb not null,
 push_multiplier numeric check(push_multiplier in (0,1)),
 missing_policy text check(missing_policy in ('zero','block')),
 mvp_bonus integer not null default 0 check(mvp_bonus in (0,2)), mvp_result text,
 status text not null default 'draft' check(status in ('draft','open','locked','final')),
 approved boolean not null default false
);
create table public.goat_games (
 id uuid primary key default gen_random_uuid(), round_id uuid not null references public.goat_rounds(id),
 home text not null, away text not null, starts_at timestamptz not null,
 home_spread numeric not null, source_url text not null check(source_url like 'https://%'),
 home_score integer check(home_score>=0), away_score integer check(away_score>=0),
 result_source text check(result_source like 'https://%'),
 check((home_score is null)=(away_score is null)), check(home<>away)
);
create table public.goat_submissions (
 round_id uuid references public.goat_rounds(id), user_id uuid references auth.users(id),
 mvp_pick text, submitted_at timestamptz not null default now(), primary key(round_id,user_id)
);
create table public.goat_picks (
 game_id uuid references public.goat_games(id), user_id uuid references auth.users(id),
 side text not null check(side in ('home','away')), weight integer not null check(weight>0),
 primary key(game_id,user_id)
);
create table public.goat_history (
 id bigint generated always as identity primary key, league_id uuid not null references public.goat_leagues(id),
 round_id uuid references public.goat_rounds(id), snapshot jsonb not null,
 reason text not null, recorded_at timestamptz not null default now()
);
create table public.goat_audit (
 id bigint generated always as identity primary key, actor_id uuid references auth.users(id),
 action text not null, entity_id uuid, detail jsonb not null default '{}', at timestamptz not null default now()
);
create table public.goat_prospects (
 id uuid primary key default gen_random_uuid(), organization text not null check(length(organization) between 1 and 150),
 website text unique not null check(website ~ '^https://[^/]+/?$'),
 category text not null check(category in ('advertiser','partner','investor')),
 source_url text not null check(source_url like 'https://%'), researched_at timestamptz not null default now(),
 evidence text not null check(length(evidence)>0), signals jsonb not null,
 score integer not null check(score between 0 and 100),
 interest text not null default 'unknown' check(interest in ('unknown','interested','declined')),
 permission text not null default 'unverified' check(permission in ('unverified','opted_in','intro_requested','do_not_contact')),
 follow_up_at timestamptz, response_evidence text, created_by uuid not null references auth.users(id)
);
create table public.goat_drafts (
 id uuid primary key default gen_random_uuid(), prospect_id uuid not null references public.goat_prospects(id),
 subject text not null, body text not null, status text not null default 'pending' check(status in ('pending','approved','rejected')),
 created_by uuid not null references auth.users(id), decided_by uuid references auth.users(id),
 decision_note text, created_at timestamptz not null default now(), decided_at timestamptz
);
create table public.goat_opportunities (
 id uuid primary key default gen_random_uuid(), prospect_id uuid not null references public.goat_prospects(id),
 amount numeric not null check(amount>=0), currency text not null check(currency ~ '^[A-Z]{3}$'),
 probability numeric not null check(probability between 0 and 1),
 stage text not null check(stage in ('qualified','conversation','proposal','won','lost')),
 evidence_url text not null check(evidence_url like 'https://%'), created_by uuid not null references auth.users(id),
 created_at timestamptz not null default now()
);
create table public.goat_research_jobs (
 id uuid primary key default gen_random_uuid(), query text not null,
 status text not null default 'pending' check(status in ('pending','completed','failed')),
 created_by uuid not null references auth.users(id), created_at timestamptz not null default now()
);
create table public.goat_memberships (
 user_id uuid primary key references auth.users(id), tier text not null,
 status text not null check(status in ('active','trialing','past_due','canceled','unpaid','incomplete','incomplete_expired','paused')),
 subscription_id text unique not null, provider_event_time bigint not null, expires_at timestamptz
);
create table public.goat_payment_events (
 event_id text primary key, event_type text not null, received_at timestamptz not null default now()
);
create table public.goat_analytics (
 id bigint generated always as identity primary key, user_id uuid references auth.users(id),
 event text not null check(event in ('session_started','competition_viewed','publication_opened')),
 resource text, recorded_at timestamptz not null default now()
);
create table public.goat_newsletter (
 user_id uuid primary key references auth.users(id), opted_in boolean not null,
 consent_version text not null, updated_at timestamptz not null default now()
);
create index on public.goat_rounds(league_id);
create index on public.goat_games(round_id);
create index on public.goat_picks(user_id);
create index on public.goat_prospects(score desc,follow_up_at);
create index on public.goat_history(league_id,id desc);
create index on public.goat_audit(entity_id,at desc);

create function public.goat_actor() returns uuid language plpgsql stable security definer set search_path='' as $$
begin if auth.uid() is null then raise exception 'authentication_required' using errcode='28000'; end if; return auth.uid(); end $$;
create function public.goat_has_role(wanted text) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.goat_roles where user_id=auth.uid() and role in (wanted,'executive'));
$$;
create function public.goat_can_view(lid uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.goat_leagues where id=lid and owner_id=auth.uid()) or
 exists(select 1 from public.goat_entries where league_id=lid and user_id=auth.uid() and status='approved');
$$;
create function public.goat_profile_insert() returns trigger language plpgsql security definer set search_path='' as $$
begin insert into public.goat_profiles(user_id,display_name) values(new.id,left(coalesce(nullif(new.raw_user_meta_data->>'display_name',''),'GOAT member'),80)); return new; end $$;
create trigger goat_auth_profile after insert on auth.users for each row execute function public.goat_profile_insert();

-- Direct table writes are denied. All writes use validated, audited RPCs.
do $$ declare t text; begin
 foreach t in array array['goat_profiles','goat_roles','goat_leagues','goat_entries','goat_rounds','goat_games','goat_submissions','goat_picks','goat_history','goat_audit','goat_prospects','goat_drafts','goat_opportunities','goat_research_jobs','goat_memberships','goat_payment_events','goat_analytics','goat_newsletter'] loop
 execute format('alter table public.%I enable row level security',t);
 execute format('revoke all on public.%I from anon, authenticated',t);
 end loop;
end $$;
grant select on public.goat_profiles,public.goat_leagues,public.goat_entries,public.goat_rounds,public.goat_games,public.goat_picks,public.goat_submissions,public.goat_history,public.goat_prospects,public.goat_drafts,public.goat_opportunities,public.goat_research_jobs,public.goat_memberships,public.goat_newsletter to authenticated;
create policy profile_self on public.goat_profiles for select to authenticated using(user_id=auth.uid());
create policy league_member on public.goat_leagues for select to authenticated using(public.goat_can_view(id));
create policy entries_member on public.goat_entries for select to authenticated using(user_id=auth.uid() or public.goat_can_view(league_id));
create policy rounds_member on public.goat_rounds for select to authenticated using(public.goat_can_view(league_id));
create policy games_member on public.goat_games for select to authenticated using(exists(select 1 from public.goat_rounds r where r.id=round_id and public.goat_can_view(r.league_id)));
create policy picks_visibility on public.goat_picks for select to authenticated using(user_id=auth.uid() or exists(select 1 from public.goat_games g join public.goat_rounds r on r.id=g.round_id where g.id=game_id and r.lock_at<=now() and public.goat_can_view(r.league_id)));
create policy submissions_visibility on public.goat_submissions for select to authenticated using(user_id=auth.uid() or exists(select 1 from public.goat_rounds r where r.id=round_id and r.lock_at<=now() and public.goat_can_view(r.league_id)));
create policy history_member on public.goat_history for select to authenticated using(public.goat_can_view(league_id));
create policy membership_self on public.goat_memberships for select to authenticated using(user_id=auth.uid());
create policy newsletter_self on public.goat_newsletter for select to authenticated using(user_id=auth.uid());
do $$ declare t text; begin foreach t in array array['goat_prospects','goat_drafts','goat_opportunities','goat_research_jobs'] loop
 execute format('create policy crm_staff on public.%I for select to authenticated using(public.goat_has_role(''researcher'') or public.goat_has_role(''approver''))',t);
end loop; end $$;

create function public.goat_standings(lid uuid) returns jsonb language sql stable security definer set search_path='' as $$
with scores as (
 select e.user_id,p.display_name,
 coalesce((select sum(case when (case k.side when 'home' then g.home_score-g.away_score+g.home_spread else g.away_score-g.home_score-g.home_spread end)>0 then k.weight when g.home_score-g.away_score+g.home_spread=0 then k.weight*r.push_multiplier else 0 end)
 from public.goat_picks k join public.goat_games g on g.id=k.game_id join public.goat_rounds r on r.id=g.round_id where k.user_id=e.user_id and r.league_id=lid and r.status='final'),0)
 +coalesce((select sum(r.mvp_bonus) from public.goat_submissions s join public.goat_rounds r on r.id=s.round_id where s.user_id=e.user_id and r.league_id=lid and r.status='final' and s.mvp_pick=r.mvp_result),0) as points,
 (select count(*) from public.goat_picks k join public.goat_games g on g.id=k.game_id join public.goat_rounds r on r.id=g.round_id where k.user_id=e.user_id and r.league_id=lid and r.status='final' and (case k.side when 'home' then g.home_score-g.away_score+g.home_spread else g.away_score-g.home_score-g.home_spread end)>0) as wins,
 (select count(*) from public.goat_picks k join public.goat_games g on g.id=k.game_id join public.goat_rounds r on r.id=g.round_id where k.user_id=e.user_id and r.league_id=lid and r.status='final' and (case k.side when 'home' then g.home_score-g.away_score+g.home_spread else g.away_score-g.home_score-g.home_spread end)<0) as losses
 from public.goat_entries e join public.goat_profiles p on p.user_id=e.user_id where e.league_id=lid and e.status='approved'
), ranked as(select *,dense_rank() over(order by points desc,wins desc,losses asc) as rank from scores)
select coalesce(jsonb_agg(to_jsonb(ranked) order by rank,display_name),'[]') from ranked;
$$;
revoke all on function public.goat_actor(), public.goat_profile_insert(),public.goat_standings(uuid),public.goat_has_role(text),public.goat_can_view(uuid) from public;
grant execute on function public.goat_has_role(text),public.goat_can_view(uuid) to authenticated;
