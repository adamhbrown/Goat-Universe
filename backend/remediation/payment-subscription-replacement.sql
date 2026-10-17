-- REVIEW CANDIDATE ONLY. Not in supabase/migrations and not applied remotely.
-- Preserve the reviewed historical migrations. Promotion requires separate
-- migration approval and a migration file generated with the pinned CLI.
-- Retire superseded identifiers so a delayed event cannot resurrect them.
alter table public.goat_memberships
 add column retired_subscription_ids text[] not null default '{}';

create or replace function public.goat_payment_event(p jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
begin
 insert into public.goat_payment_events(event_id,event_type)
  values(p->>'event_id',p->>'event_type') on conflict do nothing;
 if not found then return '{"duplicate":true}'; end if;
 if p ? 'user_id' then
  insert into public.goat_memberships(user_id,tier,status,subscription_id,provider_event_time,expires_at)
   values((p->>'user_id')::uuid,p->>'tier',p->>'status',p->>'subscription_id',
    (p->>'event_time')::bigint,(p->>'expires_at')::timestamptz)
  on conflict(user_id) do update set
   tier=excluded.tier,status=excluded.status,subscription_id=excluded.subscription_id,
   provider_event_time=excluded.provider_event_time,expires_at=excluded.expires_at,
   retired_subscription_ids=case
    when public.goat_memberships.subscription_id=excluded.subscription_id
    then public.goat_memberships.retired_subscription_ids
    else array_append(public.goat_memberships.retired_subscription_ids,public.goat_memberships.subscription_id)
   end
  where public.goat_memberships.provider_event_time<excluded.provider_event_time
   and not (excluded.subscription_id=any(public.goat_memberships.retired_subscription_ids));
 end if;
 return '{"recorded":true}';
end $$;
revoke all on function public.goat_payment_event(jsonb) from public,anon,authenticated;
grant execute on function public.goat_payment_event(jsonb) to service_role;
