# Bullpen infrastructure handoff — October 15, 2026

The private room remains undeployed. This change supplies Bullpen-specific
evidence checks and a local private-data restoration rehearsal while the approved
database, host and combined application candidate are being resolved.

Branch: `work/pope-bullpen-readiness-20261015`.
Base: Bullpen prototype `c8b120dfc0f81bcc480408d6eee914893bd6ad84` / PR #11.
Target this infrastructure-only draft to that application branch. It does not
merge the hosting/account safeguards or touch the October 21 engine work.

## Current resource evidence

Read-only Supabase inventory still lists exactly the four preserved existing
projects. `Goat-Universe` is `COMING_UP`; the other three are `INACTIVE`.
`downtown-sports` (`mfdvazvckhhxjhnhmpxc`) reports plan `free` / tier `tier_free`.
The proposed new independent GOAT Universe Staging project is absent.

That inventory does **not** establish available quota, eligibility, compute cost,
or a zero-cost project slot. The previous proposal remains conditional; no new
resource was created. Do not reactivate, repurpose or delete an existing project.

A read-only Replit search for editable apps matching GOAT returned no matches.
This does not prove that Adam has no host elsewhere or that Replit is suitable
or free. No verified HTTPS Node host, available capacity or hosting cost was
identified through these tools. No hosting provider was selected by assumption.

## Added checks

`backend/bullpen/readiness.mjs` and its CLI:

```bash
node backend/scripts/check-bullpen-readiness.mjs
```

Configure these non-secret values through the approved runtime configuration:

| Setting | Required value |
| --- | --- |
| `APP_ENV` | `staging` |
| `BACKEND_MODE` | `supabase` |
| `APP_ORIGIN` | Exact approved HTTPS origin, no path, trailing slash or credentials |
| `BULLPEN_STAGING_PROJECT_REF` | New isolated project ref, not any of the four preserved refs |
| `AUTH_EMAIL_ENABLED` | `false` |
| `PAYMENTS_ENABLED` | `false` |

With valid target configuration, the check inspects `/health`, security/cache
headers on the empty `/bullpen` sign-in shell, and anonymous denial on
`/bullpen/query`. It uses a shared 15-second deadline, bounded response bodies,
redirect rejection and sanitized reports. It never calls commands, registers a
user, binds a seat, posts a message or polls a workstream.

Optional protected runtime values `BULLPEN_ACCEPTANCE_ACCESS_TOKEN` and
`BULLPEN_ACCEPTANCE_MESSAGE_ID` permit inspecting the **existing** acceptance
record. They are not command-line arguments. Supply only a designated bound
member's approved session, never an admin/service-role/management credential.
The session is withheld if initial health, headers or anonymous denial fail.
Do not paste tokens into chat, docs, response files or logs.

The acceptance query returns before the SQL's presence/receipt writes. Unlike
`snapshot`, `history` or `poll`, it does not update last-seen state or manufacture
new receipt evidence. A local database regression verifies that all six private
tables are unchanged by that query. Returned reports omit message content,
account UUIDs, raw errors, origins and tokens.

Receipt/reply flags are explicitly **historical evidence**. They do not establish
a current connection, prove that a model read the message, or verify response
quality. An operator must verify that the supplied message ID identifies Adam's
exact acceptance prompt. This preflight does not claim to check the prompt text.

The result stays `incomplete` even when these narrow checks succeed. Pending
items include actual host-to-project identity, four real bindings, revocation,
hosted backup/restore, gateway/logging controls, real-device acceptance, and
demonstrated supported workstreams with sourced replies. General schema health
does not prove that the Bullpen migration is installed. The optional authenticated
RPC check supplies additional evidence; absence is explicit, never silently passed.

Exit codes: 1 for failed checks; 2 for blocked/incomplete. There is deliberately
no green launch or live-agent certificate. In the current unconfigured workspace,
the CLI returned `blocked` with no checks or connection evidence and made no
network request.

## Recovery verification completed

The local PostgreSQL-WASM test creates labeled fixture identities, the exact
acceptance prompt, a clearly labeled TEST API reply, a task and a sourced TEST
finding. It dumps the database and restores into a separate new in-memory local
database. It verifies byte-equivalent JSON records for:

- `bullpen_private.seats`, `messages`, `receipts`, `tasks`, `intelligence`, `audit`.
- The same acceptance evidence after restoration.
- Anonymous and unbound-account denial; all three client roles remain denied
  direct private-table reads; disabling a restored seat denies its access.

No fixture account, message, token or archive is installed on a provider, written
to a deployment package, or claimed as a real agent connection. Hosted Supabase
restore semantics and Auth session behavior remain to be tested after approval.

## Verification and ownership

- Eight new focused tests passed: seven readiness tests and one recovery test.
- The complete Bullpen baseline plus these changes passed **83 tests**, zero
  failed/skipped. The strengthened no-write acceptance assertion was separately
  rerun in the focused recovery test.
- `npm run check:bullpen`, `npm run check`, new-script syntax checks and whitespace
  checks passed. No browser execution or hosted acceptance was claimed here.

Kodak should include the reviewed utilities with the combined application
candidate and PR #8's hosting/session prerequisites. Existing server, config,
Auth, UI, database adapters and migration files are unchanged by this branch.

## Exact deployment package still required before CEO approval

1. New target ref/organization/region with account-specific quota and cost evidence.
2. Named Node host, owner, capacity, cost, exact HTTPS origin and protected secrets.
3. Fixed reviewed combined commit, container/image identity, migration file hashes
   and backup/rollback procedure. The five current prototype migration files are
   recorded in `BULLPEN_DEPLOYMENT_REVIEW_20261015.json`; they are not an applied
   migration set or a substitute for Kodak's final combined manifest.
4. Four approved identities and a trusted-admin, one-time founder-seat binding.
   No first-user promotion, default password, shared CEO session or public bootstrap.
5. Designated test accounts, authorized provisioning/migration/deployment scope,
   and desktop/iPhone acceptance owner.

No URL or real workstream connection is available from this change. Do not report
missing workstreams as connected. Manual authenticated room use comes first;
automatic communication remains a separate technical and authorization milestone.
