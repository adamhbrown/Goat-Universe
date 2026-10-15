# GOAT Universe — Supabase recovery investigation

**Date:** 2026-10-14
**Existing project:** Goat-Universe
**Project reference:** opvoemihfyxidzbdyory
**Region:** us-east-1

## Confirmed through the connected Supabase account (read-only)

- The management API still reports project state COMING_UP. The database service is not proven fully healthy.
- Read-only SQL executes against the project's postgres database; PostgreSQL reported pg_postmaster_start_time() of 2026-10-14 09:04:44+00.
- The auth, public, realtime, and storage namespaces exist. auth.users is present.
- to_regclass('realtime.subscription') and to_regclass('storage.objects') both returned NULL at inspection. This does not establish that customer data is missing; these are managed-service relations.
- Logs included a Realtime migration failure (MigrationsFailedToRun), a connection-pool queue timeout after 15 seconds, relation "realtime.subscription" does not exist, and aborted Storage health checks.
- Security and performance advisor responses returned no lints. This is not a substitute for a healthy-service check.
- The application migrations from draft PR #1 have not been applied to the existing project. The connector reported an empty app migration list, and the public application tables were not visible in a public schema listing.

## Separate authentication problem

GitHub's previous Supabase status workflow reported HTTP 401 from the management API. The ChatGPT Supabase connection now authenticates and reads the project. These are distinct credentials. Successful ChatGPT access does not refresh the GitHub Actions secret.

Only place a replacement Supabase management token in appropriately protected GitHub Actions secrets. Do not print, paste into docs, or commit tokens.

## Safe recovery posture

1. Do not reset, delete, pause, restore, or migrate the existing project while managed services remain in COMING_UP.
2. Do not manually recreate realtime.subscription or storage.objects. Supabase manages those schemas and their migrations.
3. Check project and service status and log timestamps again after startup settles.
4. If stuck, open a Supabase support ticket with project ref, region, relevant UTC timestamps, COMING_UP status, Realtime migration/queue-timeout errors, and aborted Storage health checks. Ask platform support to inspect provisioning.
5. After Supabase confirms full health, verify Auth, Storage, Realtime, migration history and a minimal non-mutating SQL call.
6. Before applying GOAT Games migrations, create a separate development project after reviewing cost and account plan. Do not use the existing project as a disposable test database.
7. Run a development-only migration dry run and hosted authentication/RLS tests. Production deployment remains gated.

## Support message (no secrets)

> Our project opvoemihfyxidzbdyory in us-east-1 is stuck in COMING_UP. PostgreSQL accepts read-only queries, but the platform is not reaching healthy status. On October 14, 2026 at approximately 09:12 UTC, Realtime logs reported MigrationsFailedToRun, a 15-second DBConnection queue timeout, and missing realtime.subscription. Storage health requests were aborted. storage.objects was also not present during a read-only check. Please inspect managed-service startup/provisioning and advise the safest repair. We have not reset the project or modified managed schemas.

No hosted database mutation, payment, outreach, or production deployment was performed during this investigation.
