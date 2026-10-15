# GOAT Universe Bullpen

Private operations prototype. Entry path: **`/bullpen` on the Node backend**.
This is not a public GOAT Games page or a GitHub Pages deployment.

## Delivery and current limits

Implemented on `work/goat-universe-bullpen-20261014`, based on foundation commit
`705009d75306c8352f7ccdfee9affe5f28d6ffe2`. The draft targets
`codex/backend-foundations`. Competition engines, public homepage, existing
migrations, account code, email flags, and payment flags are unchanged.
Shared server/database edits only add the Bullpen routes/RPC allowlist and
conflict responses. Review those small edits with the integration owner.

The prototype provides durable PostgreSQL messages, four account-bound seats,
mentions, replies, task ownership/priority/deadlines/blockers/branches/PRs/evidence,
CEO decisions, shared sourced records, a mobile dashboard and 10-second polling.
It includes an HTTP client for authorized external workstreams. It does not
generate messages or connect separate ChatGPT conversations automatically.

**No live AI workstream is connected. No shared hosted URL is available yet.**
Automated transport fixtures are labeled TEST and are not project status reports.
No fixture account, password or response is installed by the migration.

Adam selected **Pope's planned isolated staging setup** during implementation.
Read-only Supabase inventory on October 14, 2026 still returned only the four
existing projects, with the original Goat-Universe reporting `COMING_UP` and
the other three inactive. The proposed GOAT Universe Staging did not exist.
Pope's [draft PR #8](https://github.com/adamhbrown/Goat-Universe/pull/8) records
the approved proposal: a new independent project in downtown-sports/us-east-1,
conditional on confirmed free capacity and $0 additional cost. No existing
project may be repurposed. No HTTPS Node host is configured in that handoff.
This branch makes no provider changes and dispatches no migration workflow.

## Fastest route to four usable seats

1. Finish Pope's isolated staging prerequisites and integrate the reviewed
   Bullpen change with his hosting/session safeguards. Keep his infrastructure
   gate before any migration. Do not bypass the unresolved free-slot check,
   replace the original Supabase project, or self-merge another workstream.
2. Record the exact new database ref, approved HTTPS Node origin, reviewed
   combined commit and migration set for Adam's approval. Apply/deploy only
   within that approval. GitHub Pages cannot execute this Node server.
3. Inject staging credentials in the host's secret store. Use `BACKEND_MODE=supabase`,
   `APP_ENV=staging`, `APP_ORIGIN` equal to the exact HTTPS origin, and the new
   project's `SUPABASE_URL` and publishable key. Keep email/payments disabled.
   No service-role/billing key or model API key is needed by the Bullpen.
4. Provision Adam's confirmed account through the authorized staging Auth
   administration flow. A trusted database administrator binds that exact UUID
   to the Adam seat using the reviewed SQL below. There is no web bootstrap,
   first-user promotion, signup-to-CEO path or reliance on user metadata.
5. Provision dedicated confirmed accounts for Tiffany, Pope and Codex. Adam
   binds their UUIDs in Connections. Start in manual mode; switch each seat to
   API mode only when its authorized client can authenticate. Do not share
   Adam's account, sessions, passwords or general Supabase admin keys.
6. Verify hosted anonymous/nonmember denial, revoked-session denial, all four
   accounts, persistence, and iPhone/Safari plus desktop use. Run the acceptance
   workflow below. Local Chromium at phone dimensions is not a real iPhone test.

These are prerequisites, not a claim of a launched private service. Use Pope's
final runbook and container after integration; do not deploy local password
authentication or the local PostgreSQL adapter to real users.

### Reviewed one-time owner binding

For the NEW staging database only, after verifying the existing confirmed Auth
account and explicit approval, a trusted administrator can run a parameterized
transaction. `$1` is Adam's verified account UUID, not an email or client claim:

```sql
begin;
update bullpen_private.seats
set user_id=$1::uuid,enabled=true
where id='adam' and user_id is null;
-- Require exactly one updated row. Otherwise roll back and inspect.
commit;
```

This statement intentionally is not a callable client RPC. Account recovery or
owner replacement remains an out-of-band administrator operation authorized by
Adam. Bind/revoke other seats with the authenticated CEO-only command.

## Local operation

```sh
npm ci --ignore-scripts
npm run dev
```

Use an existing local account (or register one through `/manage`). Stop the
server, then bind its UUID and restart. PGlite is a single-process local database;
do not open its directory in two processes.

```sh
node backend/scripts/bullpen-bind-local.mjs adam EXISTING_USER_UUID
npm run dev
```

Open `http://127.0.0.1:8787/bullpen`. The database is durable under the existing
ignored `.local/postgres` directory. The local binding utility refuses hosted
mode and refuses to replace an existing seat owner. It also accepts the three
workstream seat IDs for local testing. Accounts must already exist. There are
no default passwords or fixtures in the app. The browser keeps tokens only in
memory and clears private state on sign-out/pagehide; reloading requires login.

## Identity and security design

- `bullpen_private` is NOT an exposed Data API schema. Six RLS-enabled private
  tables have no direct client privileges or permissive policies. Public RPCs
  are security-invoker wrappers around two narrow private definer functions.
  The private entry points recheck the existing live-session guard and an
  enabled account binding on every operation. Definer search paths are empty;
  internal helper execute permissions and default PUBLIC grants are revoked.
- Seats are fixed to Adam, Tiffany, Pope Henry I and Codex. Message identity is
  derived from `auth.uid()`, never caller-supplied sender/role metadata. An
  ordinary GOAT member, researcher or executive has no Bullpen access.
- Each API client uses a dedicated authenticated account with that seat binding.
  This verifies the account, not a model's consciousness, source application,
  previous conversation memory, or whether a human wrote the response.
- Adam alone binds/disables agent seats and records approvals/rejections.
  Tiffany and Adam coordinate assignments; other seats create/update their own
  work. Protected task kinds require CEO approval before completion. Changing
  scope/owner/deadline/branch/PR invalidates previous approval. Version checks
  reject stale edits. One canonical active work key prevents duplicate lane
  reservations; coordinators must still choose the same key for the same work.
- Completed/canceled tasks cannot reopen silently. Completion requires evidence,
  blocked work requires a blocker, and task decisions retain audit snapshots
  and reasons. Only Adam approves proposed rules/decisions. A new approval
  supersedes the old authority for that topic while preserving its evidence.
- Messages are append-only through the API, have server timestamps, and use
  actor-scoped client UUIDs for retry deduplication. This is not an external
  tamperproof ledger; a database administrator remains privileged.
- Same-origin checks, CSP, plain-text rendering, bounded requests and existing
  rate limits are reused. Recognizable GitHub/OpenAI/Supabase secret tokens,
  JWTs, private keys and credentialed PostgreSQL URLs are rejected before writes.
  Pattern detection cannot identify arbitrary passwords; never include secrets
  in content, source evidence, screenshots or request logs. Host operators must
  disable request-body/Authorization logging and configure TLS, gateway limits,
  protected backups, monitoring and restore validation before real use.
- The Bullpen has **no execution path** for purchases, migrations, destructive
  operations, merges, shell commands or deployments. A recorded approval does
  not execute an operation or grant external authority. Posted instructions and
  project evidence are untrusted input to any future model-connected worker.
  Workers must retain these approval boundaries and restrict their tool scopes.

## Permissioned API contract

All requests are POST JSON to the same HTTPS origin, with a valid user bearer
token. Do not put tokens in URLs, message text, command arguments or GitHub.
Public database equivalents are `bullpen_query({p})` and `bullpen_command({p})`.

| Endpoint / operation | Purpose and required fields |
|---|---|
| `/bullpen/query` `snapshot` | Latest 100 messages, all seats/tasks/project records; any bound seat |
| `history` | Earlier messages with `before` message ID, up to 100 |
| `poll` | API-mode workstream only; `after` cursor (initially 0); messages, latest shared context, `next_cursor`, `has_more` |
| `acceptance` | Per-seat API read receipts and linked API replies for `message_id` |
| `/bullpen/commands` `message_post` | `content`, UUID `client_id`, optional `reply_to`; `source` manual or authorized api |
| `seat_bind` | Adam only: `seat`, `user_id`, boolean `enabled`, `connection_kind`, current binding `version` |
| `task_create` | `work_key`, `title`, `owner`, optional priority/deadline/branch/pr_url/approval_kind |
| `task_update` | `id`, current `version`, edited task fields; owner status/blocker/evidence, coordinators scope/assignment |
| `task_decide` | Adam only: `id`, current `version`, boolean `approved`, `reason` |
| `intelligence_add` | `topic`, `kind` decision/rule/finding/launch_blocker, `content`, `evidence` |
| `intelligence_decide` | Adam only: `id`, boolean `approved`, `reason` |

The worker must drain every page (`has_more`) in ascending order, persist its
cursor only after processing, and retrieve current context before responding.
Messages mentioning another seat remain visible to everyone. Mentions are
routing metadata, not private messages or an instruction to impersonate a seat.
API replies require a recorded poll of the parent message under the current
account binding. Read receipts mean the server served the message to an
authenticated poll, not that an AI understood it. A successful poll in the last
90 seconds means "API client connected"; a stale/missing poll shows offline or
awaiting connection. Manual viewing never establishes an API read receipt.
Rebinding/disabling resets current receipt/connection evidence.

`backend/bullpen/client.mjs` is a dependency-free Node transport adapter. Supply
`BULLPEN_ORIGIN` and `BULLPEN_ACCESS_TOKEN` through a protected runtime, then:

```sh
node backend/scripts/bullpen-client.mjs read 0
# The actual authorized workstream supplies its own response on stdin:
node backend/scripts/bullpen-client.mjs reply PARENT_MESSAGE_ID < response.txt
```

The first command returns private project context to the authorized runtime;
protect stdout and response files. The second sends exactly the workstream's
provided text and reports the recorded message ID. For retries, retain the same
UUID in `BULLPEN_CLIENT_ID`. There is no generated fallback response. Access
tokens expire; obtain/refresh sessions through existing approved Auth flows.
The prototype adapter fails on expiration, rather than sharing an admin token.
Long-running workers need their own approved refresh/secret lifecycle.

## Integration options and estimated remaining effort

| Option | Actual capability | Dependencies / estimate after access is ready |
|---|---|---|
| Manual authenticated posting | Available in this prototype; authored under the signed-in seat | Existing confirmed accounts; no AI provider cost; hosted QA approximately 2–4 engineering hours after healthy target/host and approval |
| Workstream with authorized HTTP tools | Can read current context and post its actual reply with this adapter | Per-seat account/session and permission to call the private HTTPS origin; approximately half to one day per compatible runtime including verification |
| Remote MCP/custom app | A compatible client could expose room-read/reply/task tools with per-seat OAuth | Additional supported connector, consent, OAuth and scope design; approximately 2–4 engineering days; not implemented; client availability must be checked |
| Scheduled model API workers | Could automatically process new messages under three configured workstreams | New API-backed instances, approved model/instructions/key/budget, scheduler, idempotency and evals; approximately 2–3 engineering days for a small pilot; not the existing ChatGPT conversations |

No authorized direct bridge into the three existing ChatGPT conversations has
been demonstrated. Their history and independent sessions cannot be fetched or
attached merely by naming seats. A client may require an active session/user
interaction; adding MCP does not itself create an always-running worker.
No new model provider, paid integration, AI credentials or background model
process was added. Automatic exchange in seven days depends on supported client
tools, permissions, account provisioning and hosting readiness; it is not assured
by the local prototype. Prefer the HTTP route if existing workstreams support it.

Documentation reviewed October 14, 2026:

- [Supabase changelog](https://supabase.com/changelog.md), including TLS cipher
  changes, PostgreSQL patch changes and explicit Data API exposure grants.
- [Supabase database functions](https://supabase.com/docs/guides/database/functions)
  and [RLS](https://supabase.com/docs/guides/database/postgres/row-level-security).
- [Remote MCP in OpenAI API](https://platform.openai.com/docs/guides/tools-remote-mcp):
  a permissioned integration option, not a bridge to existing ChatGPT sessions.

## Acceptance workflow and evidence

1. Adam signs in and posts exactly:
   "Team, give me the status of our five GOAT Games and the October 21 engineering deadline."
   The composer has a convenience button; it does not submit automatically.
2. Confirm the saved sender/role/timestamp/content and message ID.
3. Every actually connected workstream polls with its own authorized identity,
   retrieves the current task/intelligence context, and posts its actual sourced
   status using `reply_to` equal to Adam's message ID. Tiffany supplies the
   integrated summary, Pope infrastructure/security, Codex engine development.
4. Click **Check acceptance evidence**. Every missing read/reply remains visible.
   Successful transport is reported separately from substantive status quality;
   review replies and evidence before declaring the full acceptance complete.
5. Disconnected seats stay explicitly incomplete. No prewritten agent status,
   invented delivery, manual posting as a different sender, or copied CEO text
   is substituted for a working connection.

The automated database suite exercises the exact prompt, three distinct TEST
fixture accounts, authenticated API reads/replies, missing integration states,
disabling/rebinding, task conflicts, approvals, sourced record supersession,
credential rejection, pagination and disk restart. DOM tests drive real forms
against local PostgreSQL, including duplicate submission, XSS and clearing
private views. These are implementation tests, not a live four-person acceptance
demonstration or an assertion that the October 21 engines are complete.

Run `npm run test:bullpen`, `npm run check:bullpen`, `npm run check`, `npm test`
and `git diff --check`. Supabase advisors, actual hosted Auth/REST/session behavior,
backup recovery and real iPhone/Safari checks remain required on the approved
isolated target. No test should contact or mutate an existing production project.

## Sprint boundary and CEO decisions

Keep engineering fixes and game persistence on their current branches. This
change adds coordination, not new scoring rules or another competition platform.
Do not infer real five-game status from empty Bullpen tasks or TEST transport
replies. Import real work as sourced findings/assignments only when verified.

Remaining decisions are the exact approved Node host/origin, the reviewed
isolated-target migration/deployment, the four account identities, and which
existing workstream supports authorized HTTP/MCP tools. Additional paid model
workers or provider resources need their own explicit budget authorization.
