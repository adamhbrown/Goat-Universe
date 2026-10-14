# Verified development checkpoint — October 13, 2026

## Functioning and verified locally

- PostgreSQL migration installation, Supabase-compatible access policies and RPCs.
- Password registration/login, opaque bearer sessions, refresh rotation and logout.
- Commissioner-owned private leagues, member requests and entry approval.
- Full 13-game NFL ranked ATS simulation: Wild Card, Divisional, Conference and
  Super Bowl, plus MVP, for a maximum of **61 points**.
- Alternative conference weight pairs, unique full submissions, locked deadlines,
  sourced official-result input, scoring, standings, corrections and snapshots.
- Championship finalization with retained historical records.
- CRM source/evidence records, relevance scoring, opportunity tracking, draft
  preparation, executive approval, suppression and follow-up/pipeline reporting.
- Consent records, private memberships, signed payment-event parsing, replay and
  stale-event protection. Payments and external communication remain inactive.
- API checks for authentication, origin, privilege escalation, user spoofing,
  query injection and direct database access restrictions.

## Test result

`npm test`: **9 tests passed, 0 failed** at this checkpoint.
GitHub's automated `Backend tests` workflow also completed successfully on the
development branch and pull request. A standalone server smoke check returned
HTTP 200 for `/health`, `/admin`, and both console assets; the database health
response reported schema version 2 and payments disabled.
The competition and CRM tests exercise the HTTP API against actual local
PostgreSQL migrations. Supabase remote transport is separately tested with a
mock; hosted account and RLS behavior is not claimed verified.

The first run exposed a test assertion counting previous locked-round picks and
a CRM approval SQL alias ambiguity. A persistent-startup check also exposed a
missing database parent directory. These were corrected; persistence across
restart is now covered by a regression test.

## Incomplete / requires access

- The read-only Supabase project-status workflow returned **HTTP 401** on
  October 13, 2026. The configured token is present, but the management API does
  not accept it. A valid Supabase personal access token must be securely supplied;
  project pause status remains unknown. This is a current authentication blocker
  in addition to the earlier September IPv6 connection failure.
- Hosted Supabase project status and connectivity verification; dedicated
  development project ref, API key and database password are unavailable here.
- Applying migrations in development, real Auth email delivery, production
  hosting, gateway protection, backups and monitoring.
- Official push/missing/tiebreak/deadline rules, real scheduled events, and public
  participant UI integration.
- Additional multisport scoring strategies and approved Baas/GPI rules.
- Scheduled automated prospect research, real prospect ingestion, integrated
  inbox replies and executive notifications. The queue/import/API foundation
  works; no external worker or communications provider is connected.
- Membership pricing, tested provider deployment, live payment activation,
  checkout destination pages and subscription operations.

The existing public website and main branch were not changed. No hosted service
is reported restored by this development checkpoint.
