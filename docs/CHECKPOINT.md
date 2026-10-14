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


## October 14, 2026 — additional completed development

### Product interfaces committed (development branch only)
- GOAT Games participant portal served at GET /play: account creation/sign-in, rotating in-memory session tokens, private league invitation requests, owned/approved league cards, standings, ranked ATS pick form, existing confidence-weight restoration, and commissioner entry approvals.
- Commercial HQ served at GET /crm: authorized staff sign-in, reports, researched prospect evidence intake, opportunity recording, internal outreach draft preparation, and approver/executive decision controls. No external message sending or charging.
- Both are separate from the existing static public website. No production route or hosted Node API was deployed.

### Verification
- GitHub Actions Backend tests succeeded with 11 passing and 0 failing, including the existing league/CRM integration tests and new headless UI tests.
- The headless UI tests simulate account sessions, ranking submissions, league enrollments and approvals, commercial prospect records, internal drafts, approval decisions, and expired-token refresh. They do not prove full real-browser support.
- Updated source syntax checks include both browser scripts.

### Live Supabase read-only investigation
- Connected account confirmed Goat-Universe project ref opvoemihfyxidzbdyory, region us-east-1; status remains COMING_UP at repeated checks.
- PostgreSQL responds to read-only queries, but Realtime logged managed migration/connection timeouts, and managed internal tables were missing during read-only inspection.
- No migration was applied, no project was reset, and no hosted registration was tested. See docs/SUPABASE_RECOVERY.md for diagnostic details and support escalation.
- The original GitHub workflow management-token 401 remains a separate credential-rotation task; working connector access does not repair the GitHub secret.

### Remaining release gates
- Healthy Supabase services, separate approved-cost development project, valid protected development credentials, development-only migrations and hosted RLS/authentication verification.
- Email confirmation/sending setup, real-browser and mobile functional/accessibility tests, API hosting, monitored staging deployment and release approval.
- Founder approval of NFL push, missed-pick, tie, spread/source and deadline policies; no unsourced games or fabricated results.
- Explicit approvals for any production deployment, outreach, payment activation or paid services.
