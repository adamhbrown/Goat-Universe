# Backend operations and deployment

## 1. Local operation

Run `npm ci --ignore-scripts`, then `npm run dev`. No hosted credentials are
needed for local development. The database is saved under `.local/postgres`,
which Git ignores. The server binds to loopback by default.

`GET /health` checks the database RPC; failure returns 503. `GET /admin` is an
initial administrative API console, not a replacement for the public website.
Create an account, sign in, and use the JSON actions/reports below.

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
`crm_records`, `crm_report`, `executive_report`.

## 2. Commissioner workflow

Any verified account can create a private league and becomes its commissioner.
Commercial privileges are separate; league ownership grants no CRM role.

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

## 3. Commercial workflow

Staff roles are granted by a trusted database administrator. There is no role
granting API and no reliance on client-supplied metadata for privileges.
For local development only, stop the backend, run
`node backend/scripts/grant-local-role.mjs USER_UUID ROLE`, then restart it.
Allowed roles: `researcher`, `approver`, `executive`.

- `research_job`: `query`; creates a research queue record. A scheduled source
  research worker is not connected yet.
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

The old dry run attempted an unlinked connection and failed because IPv6 was
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
- Integrate approved registration/competition screens into the preserved public
  website after backend acceptance. Public visitors currently still see the demo.

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
