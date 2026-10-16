# Operation GOATVILLE — infrastructure and launch readiness

Pope Henry I · October 15, 2026 · CEO review copy

**Decision:** keep the original project preserved. Static guest experiences can
advance on isolated branches. A secure public competition launch remains blocked
by managed-service initialization, an approved healthy testing/hosting target,
hosted acceptance, release integration and unresolved rules. No merge or deployment
was performed.

## 1. Confirmed Supabase findings

Project `Goat-Universe`, ref `opvoemihfyxidzbdyory`, `us-east-1`.

| Evidence checked in this run | Result and limit |
| --- | --- |
| Connected management project read | `COMING_UP`; created September 24, 2026. The current connector authenticates successfully. |
| Read-only SQL at 09:27:29 UTC October 15 | PostgreSQL 17.6 responded; 11 connections versus max 60; zero ungranted locks at that instant. This does not prove internal service connectivity or exclude earlier contention. |
| Managed relation lookup | `storage.objects` and `realtime.subscription` both NULL. Do not manually create them. This is not proof of customer-data loss. |
| Public schema inventory | Zero public tables. Application schema is not available there. This does not describe private/Auth data. |
| Storage logs retrieved | October 14 16:55:01.454 UTC: migration failed, `error.message="timeout expired"`, `error.errorCode="UnknownError"`; repeated failures also at 16:53:38 and 16:52:27. Health requests included both aborted requests and a 200, which is insufficient evidence of recovery. |
| Realtime logs retrieved | October 14 16:45:31.043 UTC: `MigrationsFailedToRun`, DBConnection connection error and queue timeout after 15000 ms. Generic Ecto suggestions in logs are not an authorized repair plan. |
| Security advisor | Empty lint list. With no public application tables this is not an application security certification. |
| GitHub historical status job | [Run 38494493813](https://github.com/adamhbrown/Goat-Universe/actions/runs/38494493813), job 115627054496: `Project status access failed (HTTP 401)` at October 14 01:13:06 UTC. Re-read actual job logs. |
| September dry run | [Run 36032527224](https://github.com/adamhbrown/Goat-Universe/actions/runs/36032527224), job 107744557599: token presence check passed; CLI then failed with IPv6 unsupported. Presence was not authentication validation. |

Log query window was October 14 09:26:16 through October 15 09:26:16 UTC.
The most recent matching failures returned are from October 14; these are not
claimed as new October 15 errors. The **current project state and SQL observation**
are October 15 evidence. No full current service-health API response was available
through the exposed connector tools.

### Authentication versus initialization

The GitHub management credential was rejected in the recorded run. Expiration
of the reported seven-day token is plausible; revocation, an invalid/wrong token
or wrong secret scope are alternatives. The secret's actual expiry and identity
were not inspected, and no replacement token was created. A working ChatGPT
connector does not refresh the GitHub secret.

An expired GitHub PAT has not been established as the cause of internal Storage
or Realtime migrations failing. Treat that infrastructure failure as a separate
support investigation. Replacing the credential alone would not establish service
recovery. Follow existing `SUPABASE_TOKEN_DIAGNOSIS.md` on the staging branch:
the status job uses repository/organization secrets, while development jobs can
use an overriding same-named development-environment secret.

### Platform status and support

The public [status summary](https://status.supabase.com/api/v2/summary.json)
returned "All Systems Operational" but its page update was October 13 and the
returned component list contained only `ap-east-1`. That response does not verify
`us-east-1` or rule out a project-specific incident. No current regional incident
was verified as the cause. The [changelog](https://supabase.com/changelog) records
an October 8 status-page migration, an October 6 scoped-token rollout, and a
November 10 TLS cipher change; none establishes the cause of this project failure.

Repository history (`docs/ISOLATED_STAGING_DECISION.md` on
`work/pope-isolated-staging-20261014`) records the October 14 support submission
and the owner's acknowledgment number **SU-507996**. Prior conversation records
agree: acknowledgment only, no engineer diagnosis then. No ticket/inbox reader or
support-response tool is exposed here, and a targeted file search did not resolve
a current reply. **The actual current ticket response was not reviewed.** Do not
claim Supabase refused support, diagnosed a cause, or approved a repair. Do not
submit a duplicate ticket; continue the existing thread when the response is available.

Next provider action: request project-specific internal connection/migration
findings and an in-place, data-preserving recovery recommendation under SU-507996.
Any proposed repair must return to Adam for approval before execution.

## 2. Security and deployment audit

Audited production `main` at `594273e662dc72629c9919d59cf78c5e6081aea4` and backend
foundation at `705009d75306c8352f7ccdfee9affe5f28d6ffe2`. Open drafts were inventoried,
not silently merged into the audited baseline.

| Area | Verified finding | Priority/action |
| --- | --- | --- |
| Live deployment | HTTPS GET returned 22,216-byte HTML, byte-for-byte equal to `main:index.html`; SHA-256 `c3ca90e746c557bc713781777543b5bf3ad9ec0497b2265a7ebf005aa74f06fe`. Latest returned main Pages run [36031969258](https://github.com/adamhbrown/Goat-Universe/actions/runs/36031969258) succeeded September 24. | Static site is reachable. This is not a backend/account launch. |
| Pages configuration | Dynamic Pages workflow records a main deployment; no Pages build/export workflow is present in main. Administrative Pages configuration is not exposed by this connector. | Inferred branch-based Pages flow; exact settings and environment reviewers unverified. Read them with owner access before release. |
| Branch protection | Branch list reports `protected:false` for main and all returned branches; rulesets endpoint returns `[]`. Detailed protection endpoint returned 403 `Resource not accessible by integration`. | P0 release control: approve main/integration protections and reviewed required checks. No protection was changed. |
| Production workflow | Main migration dry-run is manual, uses CLI `latest` and points at original protected project; token check tests presence only. Actual failed run hit IPv6. | Do not dispatch. Prepare a reviewed replacement using isolated target and existing guards, not main's old workflow. |
| Build and tests | Foundation has locked dependencies, pinned direct versions, Node >=22 and CI Node24, `npm ci --ignore-scripts`, contents-read permission, checkout credential persistence disabled, checks and automated tests. | Good local/CI foundation. Third-party actions are tagged rather than full immutable SHAs; review pinning before launch. |
| Authentication | Local and Supabase adapters, verified session guards, role/ownership checks, origin checks, CSP, token-in-memory clients and deadline tests exist. Local production auth is forbidden. | Hosted Auth/RLS/session revocation and real recovery/email/browser acceptance are still required. Local compatibility is not live Supabase proof. |
| Hosted configuration | Foundation rejects original production project in nonproduction; staging hardening and Docker are prepared separately in PRs #6/#8. `config.toml` Auth redirects are loopback development values. | Exact separate HTTPS origin, proxy settings, redirect allowlist, protected secrets and hosting owner are unverified. Do not copy localhost configuration into production. |
| Secrets | No secret values were fetched. `.env`, `.local`, node_modules and Supabase temporary files are ignored. New export scanner rejects private paths and recognizable privileged credentials. | GitHub secret inventory/scope/reviewers and whole-history secret scan remain unverified. Never publish an entire backend checkout as Pages content. |
| Dependencies | `npm ci --ignore-scripts` succeeded; `npm audit --json` returned zero known vulnerabilities for this lockfile (40 dependency total). | This is vulnerability-database evidence, not proof of dependency provenance or all supply-chain safety. No dependency update performed. |
| Abuse controls | Foundation has request-size limits and process-local request/auth throttles. | Shared gateway limits and monitoring needed for multi-instance/public hosting; proxy/NAT behavior must be tested with chosen host. |
| Mobile/performance | Main is small but uses remote Google Fonts, animation and a timer. The selected creative export contains self-hosted fonts but `goatville.html` still imports Google Fonts remotely. | Lazy-load games/media, use reduced-motion support, review external dependencies and measure on real devices. No Lighthouse/Core Web Vitals measurement claimed. |
| Data integrity | Main contains hard-coded demo competitors/rankings and a demo profile-request message. | Public release must remove clearly fictional standings or make prototype status unmistakable; it must not imply durable registration. Creative owner handles approved replacement. |
| Recovery | Git commits provide code history; local data snapshot/restore is now rehearsed. | No hosted backup/restore or complete production rollback drill verified. Define RPO/RTO, custody, retention and restore checks before irreplaceable data. |
| Integration | 12 open draft PRs were returned, including separate design, accounts, staging, Bullpen and QA changes. | Test a reviewed combined candidate; green checks on individual branches do not certify the union. |

## 3. Actual improvements completed

- Added an isolated mini-game host and strict guest message protocol. Messages
  cannot carry official scores, BAAS/GPI, private account identity or arbitrary
  award IDs through this contract.
- Added opt-in device-only guest stamps with bounded storage, corruption fallback,
  deduplication and clear controls. Every stamp is `local-unverified`.
- Added a small standalone keyboard/touch integration harness with a sandbox,
  separate child document, reduced-motion support and restrictive CSP.
- Added a static public-export audit CLI with private-file, symlink, recognizable
  credential, external dependency and size-budget checks. It is read-only.
- Added an actual local competition backup/restore regression proving snapshots,
  audit records, finalized data and access restrictions survive restoration.
- Added an optional repeatable browser acceptance script for desktop/mobile widths,
  reduced motion, keyboard use, sandbox isolation and opt-in persistence.
- Produced the [integration handoff](GOATVILLE_ENGINEERING_HANDOFF.md).

These are infrastructure modules and test utilities. No creative branch, server
route, original migration, scoring engine, credential, provider setting, production
website, billing setting or authentication policy was changed.

## 4. Tests and results

| Check | Actual result |
| --- | --- |
| Existing baseline suite | 63/63 passed before changes |
| Final complete suite | 77/77 passed, zero failed/skipped; 14 new tests |
| Existing syntax check | `npm run check` passed |
| New-file syntax and whitespace | Verified separately before commit |
| npm dependency audit | Zero known vulnerabilities reported |
| Harness export scan | Passed: 7 files, 12,319 bytes at the final recorded check, no external runtime dependencies |
| Production static export scan | Review failure: external Google Fonts CSS in index.html |
| Selected creative static export scan | Review failures: remote CSS in goatville.html; font README.md excluded by current public-file allowlist. Export size 238,909 bytes. This is a review gate, not evidence of a vulnerability in the font README. |
| Local backup/restore | Passed: real PostgreSQL-WASM dump/load preserved eight competition/audit tables, history RPC, schema v4 and anonymous/write denials |
| Real browser acceptance | **BLOCKED**: Chromium not installed; download returned invalid/truncated ZIP. Script exits 2 with `playwright_and_chromium_required`. DOM tests passed, but browser sandbox/CSP enforcement and real mobile behavior remain unverified. |
| Hosted Supabase acceptance | **BLOCKED**: no approved healthy isolated target with app schema and hosted accounts |

## 5. Branch, commit and PR

Branch: `work/pope-operation-goatville-20261015`.
Base: `codex/backend-foundations` at `705009d`.
Commit SHA and draft PR are recorded in the delivery message/PR metadata after
the final commit; this report does not self-embed a changing commit identifier.
No merge, Pages dispatch, migration dispatch or provider write is authorized here.

## 6. Verified blockers

1. Original Supabase project remains `COMING_UP` with missing managed relations.
2. Recorded GitHub management-authentication failure; token expiry/secret scope
   cannot be resolved by reading current secret values through this connector.
3. Existing support ticket has no currently accessible technical response.
4. No approved healthy isolated database/HTTPS runtime is available in this run.
   The previous new-staging proposal still requires confirmed free capacity and
   exact-target approval; inventory alone is not billing eligibility.
5. Administrative branch-protection detail and Pages/environment settings are
   inaccessible through this integration; list-level protection evidence is weak.
6. Browser execution is blocked by unavailable Chromium; hosted Auth/RLS, sender,
   backups, restore and real iPhone acceptance are not complete.
7. NFL policy decisions and final combined release candidate remain outstanding.

## 7. Platform architecture and corrective sequence

The foundation already supports membership/commissioner flows, transactional
picks, server-time locks, sourced result entry, correction audit and historical
snapshots in local PostgreSQL tests. The full 13-game, 61-point NFL simulation
passes. Do not rewrite that engine inside GOATVILLE.

| Competition | Existing baseline | Missing launch decision/evidence |
| --- | --- | --- |
| 1st & BAA | Ranked ATS engine, commissioner/member workflow, snapshots and NFL tests | Pushes, missed picks, exact ATS tiebreak ordering/final ties, approved round deadlines, schedule/spread sources and final rules approval |
| Horns & Hoops | Bracket and qualifying/main-lock implementation, tests | Official field/schedule/results and hosted acceptance; no fabricated entries |
| GOAT Crossover | Combined NBA/NHL catalog and isolated prediction helper tests | Approved mechanics/scoring, complete reviewed persistent workflow and hosted acceptance |
| League of Greatness | Provider-score/helper structure and source-aware home-bonus handling | Real provider ingestion, identity mapping, rights/access, complete operating workflow and acceptance |
| The GOAT Classic | Catalog and MLB-series helper tests | Approved rules, full reviewed persistent workflow and hosted acceptance |

Cross-competition BAAS conversion remains unapproved. GPI has no verified
official calculation/persistence pipeline in the audited baseline. Do not invent
formulas, championship entitlements or conversions. Use versioned approved
rulebooks, immutable sourced outcomes, an idempotent award ledger and audited
corrections; publish leaderboards from derived read models.

Highest-priority launch path:

1. Continue original-project support recovery while independently finishing
   reviewed static guest play, accessibility, assets and browser acceptance.
2. Review the existing account/security/staging drafts (#2/#6/#8) and QA (#13)
   with the relevant owners, then assemble a fixed integration candidate. Keep
   Bullpen and CRM exposure outside the initial public launch.
3. Resolve GitHub diagnostic credential through a protected owner-controlled
   update, then run one read-only status check; require project/service evidence
   separately from authentication success.
4. Approve the exact healthy isolated database/host and migration manifest.
   Run the existing infrastructure gate, dry-run and then only authorized changes.
5. Exercise hosted signup/verification/login/recovery/logout/revocation, two-user
   privacy, cross-league denial, direct RLS, locks at the boundary, resubmission,
   sourced scoring, corrections, snapshots, restart and restore. Require denial
   tests as well as happy paths. Only designated accounts/test inboxes.
6. Approve NFL rules and pin authoritative events, spreads, lock timestamps and
   correction permissions. Re-run the full playoff simulation on the hosted
   candidate using labeled fixtures before real entries.
7. Approve protected release/rollback procedures, HTTPS/security headers,
   monitoring and an exact production commit. Deploy only after that approval.

### Recovery and rollback proposal

For a static release, export only reviewed public files, run the scanner and
browser acceptance, retain a checksum/version manifest and previous artifact,
then verify the deployed commit/content. Rollback is a separately authorized
redeploy/revert of the last approved static release; do not force-push main.

For the backend, retain an immutable tested image/config version, use additive
compatible schema changes and verify schema compatibility before returning an
older app. A code rollback is not a database restore. Rehearse restoration into
an isolated target with row/history/privilege verification and a reconciliation
plan; never overwrite the original as a rehearsal. Define acceptable data loss
and restoration time with Adam before public collection of league history.

## 8. Remaining engineering effort

Estimates are engineering hours, not calendar guarantees. Assume one experienced
engineer, accessible provider/host accounts, a fixed approved rulebook, reviewable
source branches and no additional provider incident. Provider response/recovery,
approval waiting, data licensing and rule decisions are excluded.

| Work | Estimate |
| --- | --- |
| Guest foundation integration, browser fixes and mobile/accessibility acceptance | 8–16 h |
| Assemble existing account/staging/QA work and resolve integration conflicts | 8–16 h |
| Approved healthy staging configuration, deployment and initial hosted acceptance | 12–20 h |
| January NFL policies wired to approved sources, hosted full-season/correction tests | 8–16 h |
| Production release controls, monitoring, backup/restore, rollback and device acceptance | 12–24 h |
| **Initial secure NFL + lightweight guest launch** | **48–92 h**, plus external blockers |

Advanced anti-cheat, cross-device passports, durable recreational awards,
approved BAAS/GPI and the remaining complete competition workflows are additional
work; estimates require finalized rules/scope. This run does not establish a
launch date or claim that all five competitions are ready.

## 9. Specific CEO approvals needed

No additional approval is needed to continue isolated development/tests under
this assignment. The following proposed external changes are deliberately pending:

- **Release controls:** require PR review and passing checks on main and the
  integration branch, block force pushes/deletion, separate production environment
  approval, and restrict Pages publishing to an approved public export. Confirm
  the exact settings with owner access before changing them.
- **Credential correction:** authorize an owner-controlled replacement/update of
  the GitHub diagnostic PAT at the correct secret scope, limited to read-only
  project diagnostics, followed by one status check. No token values in chat.
- **Staging/hosting:** approve an exact isolated target and HTTPS runtime only
  after cost/capacity evidence; preserve every existing project. Approve a fixed
  migration/commit manifest separately before applying or deploying.
- **NFL rules:** decide push scoring, missing-pick policy, exact ATS comparison
  and remaining ties, deadlines and approved schedule/spread/result sources.
- **Production:** approve the final combined commit and release/rollback plan
  after hosted security and recovery acceptance passes.

Any Supabase repair, restart/reset/restore, managed-schema change, purchase,
credential rotation, authentication-policy change, merge or deployment remains
subject to the CEO's explicit scope restrictions. No such action occurred.
