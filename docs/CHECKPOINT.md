# GOAT Universe development checkpoint — October 14, 2026

This is a verified implementation checkpoint, not a claim of five hours of
unattended execution or a production launch. Work remains in the development
branch / draft PR. The public homepage, main branch and hosted database are
unchanged. No external communications, charges or purchases occurred.

## Functionality and limits

| GOAT Game | Saved development functionality | Still required |
|---|---|---|
| 1st & BAA | Accounts, entries, ranked ATS rounds, 13-game simulation, 59 + 2 = 61, deadlines, sourced results, correction snapshots and final standings | Official schedule/lines, founder-approved push/missing/ATS tie policies, hosted acceptance |
| Horns & Hoops | Persistent bracket database and HTTP API, commissioner and entrant forms, 63-game main bracket, qualifying picks, score import, corrections, standings and championship archive | Official field/qualifying count/schedule, launch review, hosted acceptance; exact residual ties remain tied |
| GOAT Crossover | Persistent draft, source-specification intake, evidence-gated combined NBA/NHL scoring helper with tests | Approved competition rules, full database/entry/scoring integration, real series |
| League of Greatness | Persistent draft, official-score comparison, no double home bonus, seven-seed Week 15 playoffs and Week 16 reseeding helpers with tests | Provider records/roster integration and complete league operations |
| The GOAT Classic | Persistent draft, source-specification intake, evidence-gated MLB prediction-scoring helper with tests | Approved competition rules, full database/entry/scoring integration, real series |

All five drafts can be created with **no invented event dates or teams**.
Unsupported leagues cannot open entries or accidentally execute the NFL engine.
Scoring helpers with fixture policies are not official rulebooks or live leagues.
The annual Baas conversion remains unapproved; there is no live annual payout.

## March Madness implementation

Founder directions from the October 14 conversation:

- One main bracket per authenticated GOAT profile.
- Qualifying: 1 point per correct selection; each game locks at its own tip.
- Main round values: 2 / 3 / 5 / 7 / 9 / 11.
- All 63 main picks and the predicted combined National Championship total lock
  permanently at the first Round of 64 tip. No subsequent round-by-round edits.
- Most points wins; closest championship-total prediction breaks a points tie.
  Equally close predictions retain equal rank; no secondary rule is invented.
- Qualifying picks may be omitted; later entry is allowed before the main lock,
  without permitting retroactive qualifying picks.

The commissioner imports sourced tournament nodes/feeder relationships rather
than the application generating a real field. The opening gate validates a
32/16/8/4/2/1 main tree, unique teams, feeder usage and first-tip deadline.
Qualifying-game count is not assumed. Individual and atomic bulk result imports
require decisive scores and source URLs. Correcting an earlier result clears its
result and every dependent result, retaining old standings and audit evidence.
Every affected official result must then be reviewed and re-entered.

A complete **65-game synthetic fixture** (63 main + 2 qualifying) verified a
**211-point** maximum: 209 main points plus the fixture's two qualifying points.
That is a test fixture, not the published maximum for the actual tournament.

## Accounts, API and commercial backend

- Local PostgreSQL-backed registration/login, profile updates, bearer sessions,
  refresh rotation, logout and restart persistence.
- Supabase REST/Auth adapters forward the validated user's JWT, not service
  privileges. Hosted email/Auth behavior remains unverified.
- Database session restrictions, private league permissions, hidden predictions
  and tiebreakers, actor-bound writes and direct-write denial. Internal RPC
  implementations cannot be invoked by anonymous or authenticated clients.
- `/manage`: account/profile/preferences, all-five draft creation, NFL management,
  full March Madness entry/admin/standings/history and staff-only commercial forms.
- `/play`: retained member portal, five-game catalog and March Madness workspace
  link. `/crm`: retained commercial dashboard. Existing public site untouched.
- CRM evidence-backed qualification, opportunities, internal outreach drafts,
  approver decisions, suppression, follow-ups and reports by currency.
- Research jobs use exclusive 15-minute leases, expiry/reclaim and evidence-bearing
  completion. No autonomous external research worker is connected.
- Newsletter/analytics consent and membership/webhook foundations exist locally.
  Payments and outbound communication remain disabled. No send route exists.

## Verified tests

Latest merged local run: **47 passed, 0 failed, 0 skipped** (`npm test`).
JavaScript checks passed (`npm run check`). Production dependency audit reported
**0 vulnerabilities** (`npm audit --omit=dev --audit-level=high`).

Coverage includes full NFL and NCAA simulations, main/qualifier deadlines,
complete bracket validation, championship tiebreaks and shared exact ties,
correction invalidation, immutable history, atomic import rollback, private
predictions and pre-lock snapshot redaction, table RLS/session restrictions,
API privilege escalation and spoofing, auth throttling, session rotation/logout,
restart persistence, CRM qualification/draft/approval/reporting/suppression,
payment signature/replay handling and actual account/commissioner/CRM/bracket
DOM form submissions against local PostgreSQL.

DOM tests are **not visual desktop/mobile browser acceptance**. Supabase session
compatibility tests use local Auth-table fixtures, not a hosted GoTrue login.
Current-head GitHub CI must be inspected separately from local results; earlier
passing runs do not prove the newest commit passed.

Early development failures were fixed: a bracket SQL alias ambiguity, bulk
simulation exceeding the real HTTP throttle (now atomic import), and a DOM test
ending before an asynchronous save finished. The actual rate limit was retained.

## Read-only Supabase status

Connected tools work. `Goat-Universe` (`opvoemihfyxidzbdyory`) still reports
**COMING_UP**, has **0 application tables** and **0 development branches**.
Read-only SQL succeeds; full managed-service health is not established.
No production schema or managed-service repair was performed.
The previous GitHub Actions management-token 401 is a separate credential issue.
See `SUPABASE_RECOVERY.md` for the earlier provisioning findings and support draft.

## Publications and business review

Live site HTML and catalog were fetched. The catalog currently declares **39
editions / 802 pages**; this is the current site catalog, not a count of all files
in Adam's archive. **89 checks passed**: every catalog cover/first and last page,
all six declared PDFs, and key HTML/script routes, following six route redirects.
This does not verify every interior page or visual mobile behavior.
See `PUBLICATIONS_AUDIT.md` and `publication-link-audit.json` for evidence and
commercial integration gaps. No public hierarchy or design was changed.

## Before real users register

1. Resolve Supabase managed-service provisioning and establish a separate healthy
   development target. Review any project/branch expense with Adam first.
2. Configure protected development URL/publishable key, migration credentials and
   a valid management token for Actions; never commit or print secrets.
3. Apply migrations in development and verify hosted signup, confirmation email,
   login/refresh/logout, session restrictions, RPCs and direct Data API access.
4. Complete mobile/desktop browser acceptance, password recovery/email callback
   flows, API hosting/HTTPS, production gateway/rate protection, monitoring,
   backups and operational recovery.
5. Import actual event schedules/lines and approve outstanding contest policies.
   Integrate the remaining three rulebooks and their persistent workflows.
6. Confirm membership/advertising terms, payment-provider test acceptance,
   competition eligibility/legal review and explicit production launch approval.

Local code is testable now; hosted registration is not live. No claim is made
that the existing Supabase service has been restored.
