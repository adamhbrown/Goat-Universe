# Backend operations and deployment

## 1. Local operation

Run `npm ci --ignore-scripts`, then `npm run dev`. No hosted credentials are
needed for local development. The database is saved under `.local/postgres`,
which Git ignores. The server binds to loopback by default.

`GET /play` serves the existing responsive participant portal on the backend
origin. It supports signup, sign-in, in-memory session refresh, viewing approved
leagues, private join requests, commissioner entry approvals, standings and
ranked ATS submissions. It is not published on GitHub Pages. Browser tokens are
not persisted in localStorage.

`GET /health` checks the database RPC; failure returns 503. `GET /admin` is an
initial administrative API console, not a replacement for the public website.
Create an account, sign in, and use the JSON actions/reports below.

`GET /manage` serves the extended management workspace with registration/login, profile
editing, league requests, picks, commissioner controls and the staff-only
commercial workspace. It does not modify or serve the public `index.html`.
The other session's completed `/play` portal is preserved unchanged. Both
screens use the same authenticated API, accounts and access policies.
Browser access/refresh tokens remain in memory only; reloading requires login.
Concurrent expired requests share a single refresh rotation. Signup in hosted
mode prompts email confirmation; local-only accounts skip actual email delivery.
Password recovery and hosted confirmation redirects still require implementation
and integration testing before public launch.

All action/query endpoints are POST with `Content-Type: application/json`.
Authenticated endpoints require `Authorization: Bearer <access_token>`.
Passwords must be 12–200 characters. Local passwords use scrypt, sessions and
refresh tokens are stored as hashes, refresh tokens rotate, and logout revokes
the local session. Credentials and tokens are never committed to Git.

| Endpoint | Fields |
|---|---|
| `/auth/signup` | `email`, `password`, `display_name` |
| `/auth/login` | `email`, `password` |
| `/auth/refresh` | `refresh_token` |
| `/auth/logout` | Empty object plus access token |
| `/commands` | `op` and operation fields |
| `/query` | `op`, optional `league_id` |
| `/outreach/prepare` | `prospect_id`; requires researcher/executive role |
| `/billing/checkout` | Approved `tier`; disabled until payment launch approval |
| `/billing/webhook` | Raw Stripe JSON with verified Stripe signature |

Available queries: `me`, `leagues`, `league`, `standings`, `history`,
`dashboard`, `crm_records`, `crm_report`, `executive_report`. `dashboard` includes
the user's own pending/rejected entry status, never private games or picks from
a league they are not authorized to view. `profile_update` only changes the
session actor's display name; it cannot grant a role or change another user.

## 2. Commissioner workflow

Any verified account can create a private league and becomes its commissioner.
Commercial privileges are separate; league ownership grants no CRM role.

The portal's `competition_setup` command creates a draft league plus 1–32 rounds
in one database transaction. An invalid round rolls back every write and audit
record. It always sets rules `approved:false`. The NFL screen uses the existing
`backend/rules/nfl-playoffs-61.json` source: four rounds, 59 ranking points and 2
MVP points. Dates must be entered; no teams, sports results or dates are invented.

1. `league_create`: `name`, `sport`, `season`, `rules`.
2. `round_create`: `league_id`, `name`, `lock_at`, `weights`, optional
   `weight_options` and `mvp_bonus`. Round schedules are created in the draft.
3. `game_create`: `round_id`, `home`, `away`, `starts_at`, `home_spread`,
   `source_url`. Enter real sourced events; no generated sport data is included.
4. `league_rules`: `league_id`, `rules`. Approval requires `approved:true`,
   `source_reference`, `tiebreaker:"ats_record"`, `max_points`, `unresolved:[]`.
5. `league_open`: `league_id`, `reason`. Budget must equal every round's weights
   plus its MVP bonus. For this NFL season, use 61.
6. `round_open`: `round_id`, `approved:true`, `push_multiplier`, `missing_policy`,
   `reason`. Allowed push multipliers are 0 or 1; missing policy is `zero` or
   `block`. These are available settings, not founder-approved defaults.
7. A participant requests `enroll` with `league_id`; commissioner uses
   `entry_decide` with `league_id`, `user_id`, `approved:true`.
8. `picks_submit`: `round_id`, `picks:[{game_id,side,weight}]`, plus `mvp_pick` in
   the Super Bowl round. Every game is selected once; weights must match an
   allowed set. Replacements are atomic. Server time locks selections.
9. `result_set`: `game_id`, `home_score`, `away_score`, `source_url`. This is
   commissioner-only and allowed only after selection lock and event start.
   Use `mvp_result` with `round_id`, `mvp_result`, `source_url` for the MVP.
10. `round_finalize`: `round_id`. Requires complete sourced results, applies
    scores and retains a standings snapshot.
11. `round_reopen`: `round_id`, `reason` allows an audited correction while the
    season is open. Re-finalization appends a new snapshot; old records remain.
12. `league_finalize`: `league_id` freezes the completed season and stores the
    championship standings. Reopening a finalized league is not implemented.

Private picks become visible to league members after the selection deadline.
Commissioners cannot inspect competitors' choices before lock through the API.
Direct database table writes are denied to ordinary users. RPCs lock the league
row and validate ownership, membership, deadlines, allocations and transitions.
Hosted RPCs and restrictive RLS policies additionally check the signed JWT's
`session_id` against `auth.sessions`, its actor and expiry, and require a
confirmed, non-anonymous, non-banned account. This closes the normal JWT
post-logout validity window once Supabase removes the session. Local compatibility
fixtures exercise these database checks; actual hosted sign-out semantics remain
an integration acceptance requirement. No hosted Auth tables were changed.

## 3. Commercial workflow

The development-only staff interface is available at GET /crm on the backend origin. It includes staff login, in-memory session refresh, evidence-backed prospect entry, qualified pipeline reporting by currency, internal outreach draft preparation, approvals/rejections, and opportunity records. Only a researcher, approver, or executive can sign in to the commercial desk; the database still enforces the precise permission for each operation. No emails are sent, even when a draft is approved. Browser compatibility and hosted authorization remain to be verified before deployment.

Staff roles are granted by a trusted database administrator. There is no role
granting API and no reliance on client-supplied metadata for privileges.
For local development only, stop the backend, run
`node backend/scripts/grant-local-role.mjs USER_UUID ROLE`, then restart it.
Allowed roles: `researcher`, `approver`, `executive`.

- `research_job`: `query`; creates a research queue record. A scheduled source
  research worker is not connected yet.
- `research_claim`: researcher/executive claims one pending or expired job with
  `FOR UPDATE SKIP LOCKED`, an actor-bound UUID lease and a 15-minute expiry.
  `research_finish`: `job_id`, `lease_token`, `status` (`completed`/`failed`),
  `result:{summary,sources:[HTTPS URLs]}`. Completion requires sources; expired,
  forged, wrong-actor and reused leases are rejected. Leases are not exposed in
  reports or direct authenticated table reads. Failed jobs retain their evidence;
  expired running jobs can be reclaimed and their attempt count increments.
- `crm_prospect`: `organization`, canonical HTTPS root `website`, `category`
  (`advertiser`, `partner`, `investor`), `source_url`, `evidence`, and five named
  `signals`. Each signal has `name`, `value` (0–5), and evidence for nonzero values.
  Names: `audience_fit`, `commercial_fit`, `decision_access`, `timing`, `engagement`.
  Scores sum the five values and multiply by four, giving 0–100. The score
  represents commercial relevance; interest stays `unknown` until documented.
- `/outreach/prepare` stores a customized draft using the prospect's evidence.
  It currently uses a deterministic template, not an unconfigured paid AI API.
  `crm_draft` also accepts a manually prepared `subject` and `body`.
- `crm_decide`: `draft_id`, `approved`, `reason`; approver/executive only.
  Approval is recorded with reviewer and time. Draft content is immutable;
  revisions must be new drafts requiring new approval.
- `crm_interest`: `prospect_id`, `interest`, `permission`, `response_evidence`,
  optional `follow_up_at`. `do_not_contact` blocks drafts and approvals.
- `crm_opportunity`: `prospect_id`, `amount`, `currency`, `probability`, `stage`,
  `evidence_url`. Supply `opportunity_id` to update an existing deal without
  duplicating pipeline. `won` requires approver/executive privileges. Reporting
  separates contracted revenue from weighted pipeline and groups by currency;
  recorded contracts are not evidence of cash received.

`backend/scripts/import-research.mjs FILE.json` imports researched records through
the authenticated API using `GOAT_RESEARCH_TOKEN` and `GOAT_BACKEND_ORIGIN`.
It never sends emails. **No outbound transport or `/outreach/send` route exists.**
Approval records alone do not authorize campaign launch.

## 4. Supabase development configuration

See docs/SUPABASE_RECOVERY.md for the October 14 read-only investigation. The ChatGPT Supabase connector can query the existing database, but the project's management status is COMING_UP with managed-service errors. It is not a development migration target. The GitHub 401 credential problem is separate.\n\nThe old dry run attempted an unlinked connection and failed because IPv6 was
unavailable. The development workflow now performs `supabase link` using the
default pooler before `supabase db push --dry-run`.

Create or select a separate development Supabase project outside this task.
No project purchase or creation was performed. Configure GitHub's `development`
environment with:

- Variable `SUPABASE_DEV_PROJECT_REF`.
- Secrets `SUPABASE_ACCESS_TOKEN` and `SUPABASE_DEV_DB_PASSWORD`.

The workflow refuses the existing project ref `opvoemihfyxidzbdyory` as a
development target. The existing access token is not readable by this agent.
No password or secret should be pasted into chat or committed to Git.

A separate read-only status workflow safely used the existing repository token
against the Supabase management API. On October 13, 2026 the API returned HTTP
401. Replace the rejected credential with a valid Supabase personal access token
through the appropriate GitHub secrets UI. No project status is inferred from
that authentication error, and no provider state was changed.

**October 14 connected-service update:** Supabase MCP account access now works.
`Goat-Universe` (`opvoemihfyxidzbdyory`) reported `COMING_UP` during the read-only
audit. A database catalog query succeeded; the public schema had no application
tables, migration history was empty and there were no development branches.
The existing database was not altered. This connection does not update the
rejected GitHub Actions token, and it is not a dedicated development database.
No project/branch was created because costs and environment selection require
approval. Hosted application registration is still unverified.

Run the development dry run after these are configured. Review its output before
applying migrations in development. No production migration or reset is included.
If the linked pooler connection fails, inspect the actual project status, account
access, pooler credentials and network restrictions; do not purchase IPv4 access
or weaken network restrictions automatically.

For the API set `BACKEND_MODE=supabase`, `APP_ENV=staging`, `SUPABASE_URL`,
`SUPABASE_PUBLISHABLE_KEY`, and HTTPS `APP_ORIGIN`. Supabase Auth verifies the user
before every protected API call. The user's token is forwarded to the database;
ordinary competition and CRM requests never use a privileged service key.
The SQL migrations also enforce access controls when callers use Supabase REST
directly.

## 5. Requirements before real public registration

- Apply and test migrations in the separate hosted development project.
- Verify real Supabase signup, email confirmation, login, refresh and logout.
- Configure the sender/domain, SMTP delivery, redirect allowlist, password reset,
  sign-in abuse protection and commissioner/staff bootstrap accounts.
- Perform hosted RLS tests with real anonymous, participant, commissioner and
  commercial tokens. Local PostgreSQL tests and mocked transport do not prove
  the hosted configuration.
- Approve unresolved competition rules and enter sourced dates/games/spreads.
- Deploy the Node API to suitable server hosting; GitHub Pages serves static
  HTML and cannot run this server. Configure HTTPS, secret management, gateway
  rate limiting, logs, monitoring, backup/restore verification and release gates.
- Review current database objects before any production migration. Existing
  Supabase database contents and pause status have not been inspected.
- Browser-test the development /play portal on phones and desktops, especially account confirmation, session expiry, enrollment approvals, alternate confidence-weight allocations and deadline locks.\n- Integrate approved registration/competition screens into the preserved public\n  website after backend acceptance. Public visitors currently still see the demo.

Production requires `PRODUCTION_LAUNCH_APPROVED=true` and a hosted database.
Changing that flag is a release decision, not proof of readiness.

## 6. Membership, payments and analytics

Membership records are private to their user. Signed Stripe subscription events
can update membership state. The handler checks signatures, timestamps, known
prices, event deduplication and out-of-order events. Test webhook processing is
verified locally; real Stripe integration has not been exercised.

Payments default off. Enabling requires approval flags, approved Stripe prices,
server-only keys, provider setup and a deployed verified webhook. Staging refuses
live Stripe keys. No prices, charges, transactions or financial commitments were
created. Checkout success/cancel visitor pages and complete subscription billing
operations are still pending.

`analytics_event` requires explicit consent and an allowed event type.
`newsletter_consent` records opt-in/withdrawal with consent version. No newsletter
is sent and no public-site tracking snippet has been added. Executive reports
show actual database account/entry/consent counts, CRM follow-ups and pipeline.
Traffic analytics, delivery automation, GPI, Baas payouts and monetization
activation require further approved implementation.

## All five draft setup and March Madness

Use `/manage` after signing in. Its all-five catalog creates persistent drafts
through `game_draft_create` with `game_key`, `name`, and `season`. Drafts do not
need invented schedules. NFL keeps its four-round LXI setup option. Crossover,
League of Greatness, and Classic can store source specifications; their opening
and entry commands fail closed until their full engines are integrated.

For Horns & Hoops, configure the official first Round of 64 tip and schedule
source through `bracket_configure`, then import the real tree with
`bracket_schedule_import`. Supply a JSON `nodes` array with unique `code`,
`stage` 0–6, `starts_at`, `source_url`, and either literal `home_team` / `away_team`
or `home_from_code` / `away_from_code`. Stages 0 and 1 require known future tips;
subsequent stages may omit starts until available. Feeder stages must be adjacent.
No actual qualifying count is hardcoded. Schedule import requires an empty draft
and rolls back every node/audit row on failure.

Rules review preserves the founder points `[1,2,3,5,7,9,11]` and
`championship_total_closest`. After explicit approval and schedule validation,
`league_open` enables invitation requests and commissioner entry decisions.
`bracket_qualifying_pick` takes `node_id`/`team` and locks at that game's tip.
`bracket_submit` atomically replaces exactly 63 main `picks` (`node_id`, `team`)
and `championship_total`, until the one main lock. Downstream selections must
advance the entrant's own predicted earlier winners.

`bracket_result` requires sourced decisive scores after the relevant lock/tip.
`bracket_results_import` applies a `results` array atomically in feeder order.
`bracket_correct` requires a reason and clears the game and dependent outcomes,
retaining old snapshots and audit evidence. Finalize only after all sourced
results are present. Private `league`, `standings` and `history` queries use the
same authenticated member gate as NFL. Direct table writes and internal helper
calls are denied; championship predictions are redacted from pre-lock snapshots.

Live payments, outbound research workers and message transport are not activated
by any of these operations. See CHECKPOINT.md for current test evidence/blockers.
