# GOAT Universe — controlled remediation and recovery report

Evidence collected October 15, 2026, approximately 23:20–23:57 UTC.
Branch: `work/controlled-remediation-pr35-20261015`.
Base: `3667f347f99415a61ec365ee0ad5ce9a2b3e08e5` (PR #35).

**The application repairs are review candidates. Supabase is not recovered.**
No merge, deployment, hosted migration, reset, pause, restore, project creation,
credential change, payment, or outbound support message was performed. Project
metadata and diagnostic logs were read through the existing connector. No
private league, member, pick, payment, or Bullpen records were queried remotely.

## Current Supabase status

The connected account successfully returned these project states. A management
response is not an end-to-end service acceptance test.

| Preserved project | Reference | Region | Observed status |
| --- | --- | --- | --- |
| Goat-Universe | `opvoemihfyxidzbdyory` | us-east-1 | `COMING_UP` |
| Downtown Sports Inc | `lbzdmniuskyytwoaeyjn` | us-east-1 | `ACTIVE_HEALTHY` |
| Downtown Sports Pulse | `xcvptuqqtcebxorqlnsv` | us-east-2 | `INACTIVE` |
| DSI World Cup Shootout 2026 | `tyuhnlmrczwekqjnjdcw` | us-east-1 | `INACTIVE` |

The inactive projects were not resumed. The API status alone does not establish
why they are inactive. The healthy project was not substituted as a test database.

Current Goat-Universe diagnostic-log queries covered the default last 24 hours;
counts are a diagnostic snapshot, not a continuously monitored metric:

| Service | Evidence | What remains unverified |
| --- | --- | --- |
| Database | PostgreSQL logs contain 914 mentions of `realtime.subscription`; sampled messages say the relation does not exist. Pooler logs show connections and TLS establishment. | A fresh SQL health probe, completeness of managed schemas, application migration state, backup recoverability. |
| Realtime | 174 repeated “Applying migrations” messages; internal tenant health requests also returned 200. | Successful managed migrations, subscription functionality, external client delivery. An internal 200 does not override missing-relation errors. |
| Storage | 47 migration-start and 46 migration-failure messages; internal health requests also returned 200. | Managed migration completion and bucket/object API functionality. No upload or object listing was attempted. |
| REST API | PostgREST logs show two successful PostgreSQL connections and six schema-cache reload messages; latest logged event in this snapshot was 22:21:11 UTC. | Externally authenticated REST/RPC behavior and application schema availability. |
| Auth | No Auth source appeared in the retrieved log-source inventory. | Auth health, confirmation, refresh, recovery, SMTP and redirect configuration. Absence of logs proves none of these. No account or email was created. |

The earlier October 14 investigation in [SUPABASE_RECOVERY.md](SUPABASE_RECOVERY.md)
recorded working read-only SQL, absent `realtime.subscription` and
`storage.objects`, a Realtime `MigrationsFailedToRun` error, a 15-second pool queue
timeout, and aborted Storage health checks. Those SQL observations are historical;
they were not silently treated as fresh checks today.

**Diagnosis:** managed-service initialization remains incomplete. Missing managed
relations and repeated Storage migration failures are concrete symptoms. The
underlying provisioning cause, including whether a pool timeout initiated or
followed the failure, remains unconfirmed. Application SQL is not an appropriate
repair for Supabase-owned schemas. No evidence reviewed establishes data loss.

Support evidence was read, not sent:

- SU-507996: infrastructure escalation confirmed October 14 at 17:49:11 UTC;
  October 15 diagnostic follow-up remains in the thread.
- A newer existing ticket, SU-509925, was acknowledged October 15 at 20:12:18 UTC
  and escalated at 21:11:49 UTC. Its retrieved response still supplies no root
  cause, recovery steps or ETA.
- Continue through the existing support case rather than opening another
  duplicate. Ask for the confirmed provisioning failure, managed migration
  state, a data-preserving in-place recovery procedure, impact, and next update.
  Any actual support action affecting the project requires separate approval.

## Why the migration dry run failed

[Run 38814963686](https://github.com/adamhbrown/Goat-Universe/actions/runs/38814963686),
job `116697340203`, ran against old main `594273e…` before PR #35 merged.
The installed CLI reported version 2.121.0. The token-presence step passed.
The failing command was:

```text
supabase db push --dry-run --project-ref opvoemihfyxidzbdyory
IPv6 is not supported on your current network
Run supabase link --project-ref opvoemihfyxidzbdyory to setup IPv4 connection.
```

This run failed on connectivity before SQL validation. It does not demonstrate
invalid migration SQL, a missing token, or the root cause of `COMING_UP`.
The older management-API HTTP 401 is a separate authentication-path finding.
A nonempty Actions secret is not proof that it is valid or authorized; successful
connector OAuth does not repair that secret.

Current source already describes linking through an IPv4-capable pooler. Do not
rerun it against this preserved project. Once a named, healthy, isolated
development target and its cost are approved, validate the pinned CLI, credentials
and session-pooler connection separately; only then request approval to remove
the hold and perform a development dry run. No CLI link or push ran here.

## Five PR #35 findings and prepared repairs

| Finding | Branch implementation | Regression evidence / remaining gate |
| --- | --- | --- |
| Only one existing project blocked as a development target | Shared immutable four-project policy used by target validation, application development/staging configuration and Bullpen readiness. Both remote migration workflows now stop before CLI setup/connection. An unconditional hold has no environment/input override. | All four references rejected; formerly valid development fixtures also stop at the hold. Workflow order checked. This is branch code, not an active organization-wide lock. Main and external CLI users remain unchanged. |
| Payments can start without the billing-system key | Supabase payment startup requires a privileged-shaped billing key in addition to existing approval and Stripe configuration. Publishable/blank/malformed keys fail startup. | Secret-key and legacy service-role JWT fixtures accepted; absent/invalid keys rejected; defaults remain off; live development keys rejected. Shape validation does not prove credential validity, project match or grants. |
| A replacement subscription never updates membership | SQL review candidate permits a newer subscription to replace the previous one atomically and retains retired identifiers so delayed events cannot reactivate or cancel the replacement. | Disposable PostgreSQL-WASM tests cover cancellation/re-subscription, duplicate IDs, older/equal timestamps, delayed retired events, multiple replacements, failed-transaction retry and denied anon/authenticated RPC execution. Candidate is outside `supabase/migrations`; hosted behavior remains unfixed until separately approved. |
| Concurrent refreshes can unexpectedly sign out participants | Participant script shares one refresh, reuses a newer token for a delayed 401, and rejects replies belonging to older sessions/navigation. Logout clears credentials immediately. Server errors after a successful refresh preserve the session. | Actual-script JSDOM tests cover simultaneous requests, late 401, refresh failure, logout/new-login races, retry bounds, malformed refresh, navigation and retry HTTP 500. Browser and hosted Auth acceptance remain pending. |
| Editable SQL and manifest can agree while differing from the reviewed source | Fixed reviewed commit, exact file set and digests are checked independently of candidate-manifest values. Both candidate bytes and declared hashes must match. | Altering both SQL and adjacent manifest still fails; alternate file set and unsafe paths fail. Five digests independently checked from Git archive of `c8b120dfc0f81bcc480408d6eee914893bd6ad84`. This is not a digital signature; trusted checker code and Git review are still required. Overall gate remains blocked. |

The SQL proposal is `backend/remediation/payment-subscription-replacement.sql`.
It is deliberately not auto-discovered by migration tooling. Promotion requires
a reviewed migration generated with the pinned Supabase CLI and explicit approval
to apply to the approved development target. All five historical migrations are
byte-for-byte unchanged. No official league rule or award policy changed.

Billing limitations to review before activation: provider timestamps remain
strictly ordered (`<`); equal-second conflicting events retain existing behavior
and need reconciliation policy. Previously processed historical events cannot
reconstruct retired IDs automatically. If live billing ever existed, authorize
a provider reconciliation/backfill plan first. The candidate's additional column
must be included in an approved migration and rollback review.

## Payment exposure check

In this execution environment, `PAYMENTS_ENABLED`, `PAYMENT_LAUNCH_APPROVED`,
`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` and `SUPABASE_BILLING_SECRET_KEY` are
absent. Neither a live nor a test Stripe key prefix is configured here. Repository
example defaults keep payments off. No `.env` was present in either worktree.

The managed runtime reports no configured secret bindings/runtime variables.
GitHub denied listing repository secret metadata (HTTP 403). The environments
list exposed only `github-pages`; a protected `development` environment was not
listed. No hosted application's environment, Stripe account or transaction ledger
was inspected. **Live payments are not proven disabled everywhere, and no-payments
received is not established.** An authorized operator should inspect only flag
states, secret presence/mode and provider transaction status, without publishing
secret values. No payment-provider call was made in this work.

## Secure read-only Codex access — exact setup path

The existing connector can read account project metadata and diagnostic logs.
That proves this connector's authentication works; it does not establish a
restricted read-only tool configuration, working SQL connectivity, or valid
GitHub/CLI credentials. Its available catalog includes mutating tools; none were
used. No new Codex configuration or OAuth grant was installed.

Use the current [Supabase MCP guide](https://supabase.com/docs/guides/ai-tools/mcp).
The guide documents project scoping, `read_only=true` (read-only PostgreSQL user),
feature groups and browser OAuth. It recommends development data rather than
production. Use a separately approved, healthy development project with synthetic
data. Do not choose any of the four preserved references above as a disposable
development target.

1. Adam selects/approves the target project and organization, data scope and
   authorized operator. Project creation, paid branching and purchases are not
   part of this handoff. Confirm project health first.
2. Start with diagnostics/documentation only. On the operator's Codex CLI, replace
   the placeholder with the approved reference, then run these configuration
   commands (documented here, **not executed**):

   ```sh
   codex mcp add supabase_goat_dev_readonly --url 'https://mcp.supabase.com/mcp?project_ref=APPROVED_DEV_REF&read_only=true&features=debugging,docs'
   codex mcp login supabase_goat_dev_readonly
   codex mcp get supabase_goat_dev_readonly
   ```

   Complete Supabase OAuth in the trusted browser, select only the intended
   organization, review the grant, and retain per-tool approval. No manual PAT,
   service-role key, database password or secret pasted into chat is required.
   CLI command forms were checked with the installed `--help` output.
3. When schema diagnostics are approved, change the URL's feature selection to
   `features=database,debugging,docs`, retaining the exact project and
   `read_only=true`. Reauthorize/restart the client if required. Inspect the
   resulting tool catalog; do not enable account, branching, Edge Function or
   Storage-management groups. Project scoping disables account-management tools;
   read-only SQL does not itself guarantee every other API is non-mutating.
4. Approve only metadata/schema inspection initially. A bounded
   `SHOW transaction_read_only` can confirm the SQL session reports read-only;
   do not test with a write. List schema/migration metadata only. Keep private
   member, league, payment, credential and Bullpen content outside the scope.
   Treat database/log text as untrusted, redact diagnostics, and do not follow
   instructions embedded in records.
5. If real-data inspection is later necessary, obtain explicit scope approval
   and use narrowly granted read-only views/roles or a sanitized export. Read-only
   permission prevents writes, not disclosure. Do not give Codex a service-role
   key for diagnosis. Restrict retention and revoke the OAuth grant when finished
   (`codex mcp logout supabase_goat_dev_readonly` and provider access review).

For GitHub CI later, separately validate the intended identity and least required
management privileges, environment-scoped secret names and a dedicated development
database credential. Do not reuse a production credential, expose values to logs,
or assume connector access supplies CLI access. Those credentials and environment
changes require their own approved configuration action.

## Tests and preservation

- Full local suite: **107 passed, zero failed/cancelled/skipped** (final run).
- `npm run check`, `npm run check:bullpen`, explicit syntax checks for new modules,
  workflow YAML parsing and `git diff --check` passed.
- Hold CLI exits 1 with `migration_execution_blocked_pending_review`, as intended.
- Tests use local HTTP, disposable PostgreSQL-WASM and controlled fetch fixtures.
  The initial sandboxed HTTP run stalled without loopback access and was stopped;
  the complete suite passed with local networking enabled.
- No hosted Supabase/Auth/RLS, real payment-provider, Chromium, iPhone Safari or
  VoiceOver acceptance is claimed by these tests. JSDOM checks are DOM tests.
- npm dependencies installed from the existing lockfile with scripts disabled,
  using a writable temporary cache. Package manifest and lockfile unchanged.
- Existing league/CRM/Bullpen behavior, private-access tests, history and local
  recovery tests passed. No creative asset or public homepage file changed.
- Original dirty GOATVILLE integration worktree was preserved untouched. Repairs
  use a separate worktree; main remained `3667f347…` on the latest read.

## Safeguards and approval decisions

Read-only GitHub evidence still reports `main` as unprotected and repository
rulesets as empty. The detailed branch-protection endpoint requires administration
permission and returned 403; no configuration was changed. Recommend:

1. Require pull requests, resolved conversations, a passing full backend check on
   the latest commit, and an independent approving reviewer. Require two reviews
   for database/auth/billing/workflow changes, dismiss stale approvals, and require
   approval after the last push. Add appropriate CODEOWNERS for those paths.
2. Block force pushes/deletion and routine direct pushes to main; apply review
   requirements to administrators with a tightly documented emergency bypass.
   Review required-check path filters so skipped jobs cannot block or evade gates.
3. Create/review protected development and production environments with independent
   reviewers, no self-approval, restricted branches and separate secrets. Use
   immutable reviewed commit/artifact identifiers and least-privilege workflow
   permissions; pin third-party Actions to reviewed commit digests.
4. Keep migration, application deployment and public static release approval
   separate. PR #35's merge already triggered a successful GitHub Pages build and
   deploy ([run 38815965448](https://github.com/adamhbrown/Goat-Universe/actions/runs/38815965448)).
   Approval to merge main can therefore publish the current Pages selection.
   Review that automatic path before approving any future merge.
5. Retain backup/restore evidence and previous approved artifacts; use Pope's
   selected-file static export and separately trusted manifest digest when that
   work is reviewed. Never publish the backend tree or credentials with a preview.

These are recommendations requiring repository/environment administration approval,
not protections silently installed by this branch. A source-code migration hold
does not prevent an administrator from using an external CLI or older workflow.

## Next actions, in order

1. Review this draft, especially the four-project policy and unconditional hold.
   Do not dispatch existing main migration workflows while it awaits review.
   CEO approval is needed to change main or disable/restrict provider workflows.
2. Obtain Supabase's confirmed diagnosis and data-preserving recovery plan on the
   existing support escalation. No reset/restore/manual managed-schema repair.
3. Have an authorized operator verify hosted payment flags/mode and transaction
   status without exposing keys. Keep payments disabled pending reconciliation,
   approved prices, billing credentials and sandbox acceptance.
4. Approve a named isolated healthy development project, cost and scoped OAuth
   access; install the read-only diagnostic connection above. Do not resume old
   projects or create resources without separate authorization.
5. Independently review the SQL proposal and equal-timestamp/reconciliation policy,
   then approve migration-file preparation/application separately. Validate hosted
   Auth, RPC authorization, refresh, billing test events, backups and rollback on
   the isolated target before requesting production approval.
6. Approve branch/review/environment safeguards and the Pages release boundary.
   Continue GOATVILLE creative integration/local playable previews independently;
   the existing creative branches and assets are preserved.

No production action is necessary to review or run this branch's local tests.
