# Operation GOATVILLE — infrastructure and launch readiness

**Evidence date:** October 15, 2026 (UTC unless stated)  
**Code branch:** `work/operation-goatville-20261015`, based on `codex/backend-foundations`  
**Scope:** read-only provider audit plus an isolated static guest-game prototype. No production files, Supabase data/configuration, competition screens, or creative branches were changed.

## 1. Supabase investigation

### Confirmed now

- The connected Supabase project list and direct project lookup both returned Goat-Universe (`opvoemihfyxidzbdyory`, `us-east-1`) as **`COMING_UP`** on October 15. PostgreSQL version metadata is present, but status is not healthy.
- The connected account's inventory still contains only four existing projects; the other three report `INACTIVE`. There is no separate GOAT Universe staging target in that inventory. The October 14 read-only catalog review also found zero application migrations and no application tables in the public schema; no application migration was applied during this sprint.
- A read-only unified-log query returned activity from PgBouncer, PostgreSQL, Realtime, Edge and Storage within its default 24-hour window. A separate search for prior startup-error phrases in `log_attributes` returned no matches. This bounded query does **not** establish that service startup is fixed; older documented log events remain the diagnostic evidence.
- Supabase security and performance advisor calls both returned zero lints. Advisors do not validate service health.
- The October 14 read-only investigation in `docs/SUPABASE_RECOVERY.md` recorded successful read-only PostgreSQL access, Realtime `MigrationsFailedToRun`, a 15-second DBConnection queue timeout, missing `realtime.subscription`, aborted Storage health checks and absent `storage.objects` at the time checked. No application migration was applied.
- The supplied Supabase support email screenshot says the ticket was escalated to the infrastructure team and asks for patience. It does not contain a cause, repair instruction or ETA. No further support response was available in this workspace.

### Separate GitHub authentication finding

The actual GitHub Actions job log (job `115627054496`, October 14 at `01:13:06 UTC`) confirms the status workflow sent a masked `SUPABASE_ACCESS_TOKEN` and the Supabase management API returned HTTP 401. That token authenticates the GitHub workflow to the management API; it is distinct from this connected Supabase session, which can read the project today. A seven-day token created roughly 30 days earlier is consistent with expiry, but the 401 alone cannot distinguish expiry from revocation or an incorrect secret. A replacement token may restore workflow authentication; it cannot repair a project stuck in `COMING_UP`. The secret value and GitHub secret-management endpoint are not available for inspection. Do not paste a replacement into chat or code.

### Safe next step

Keep the existing project untouched. Wait for the infrastructure team's project-specific diagnosis. Ask them to confirm the provisioning cause, managed Storage and Realtime migration state, and safest in-place repair. Do not recreate managed schemas or apply the application migration set. After provider-confirmed recovery, recheck project status, the affected services and a non-mutating query; reserve application migrations for a separately approved development project.

## 2. Security, deployment and recovery audit

| Area | Verified evidence | Status / limit |
|---|---|---|
| Public Pages | The October 14 audit recorded HTTPS 200 and byte-for-byte match with `main:index.html`. | The response is verified for that check only; repeat before release. It does not prove Pages' configured source. |
| Pages build/deploy | No Pages deployment workflow exists in the repository. Pages settings API returned 404 in the prior audit. | Publishing configuration and rollback controls remain unverified. Pages serves static assets, not the Node API. |
| Node service | Local backend, JSON APIs and a local PGlite database are present; unit/integration fixtures cover auth, permissions, game workflows and persistence. | No approved public HTTPS Node host/origin is configured or tested. |
| Environment separation | Workflows distinguish a development target and refuse the original production project ref for a development migration dry run. Local/staging configuration gates are documented. | No healthy staging project/host has been established; hosted Auth, RLS and session behavior are not accepted. |
| Secrets | Repository source uses GitHub secret references; `.gitignore` excludes local DB state. No secret values were inspected or printed. | Host secret storage, rotation, logging redaction and production credentials cannot be verified from this integration. |
| GitHub protections | Read request to the foundation branch protection endpoint returned 403 `Resource not accessible by integration`. | Branch protection/ruleset state is unknown, not presumed absent. Request an admin-side screenshot/export before launch. |
| Dependencies | Package versions are exact and a lockfile is committed. | Run `npm audit --omit=dev` in verification; this is a point-in-time advisory, not a supply-chain guarantee. |
| Mobile and accessibility | Homepage static checks cover metadata, navigation targets and breakpoints; this POC has keyboard-operable native buttons, focus-visible styling and reduced-motion CSS. | No visual browser, iPhone/Safari, Lighthouse or real network-performance acceptance is claimed. |
| Recovery | Local tests cover process restart/persistence and source documents describe a development rollout gate. | No hosted backup restore, production rollback, monitoring or incident drill has been demonstrated. |

### Production authorization boundary

No provider repair, pause/reset/restore, database migration, account provisioning, project creation, billing, secret rotation, production hosting change, merge or deployment was done. Each remains gated by the relevant explicit CEO approval and target-specific review.

## 3. Platform architecture and rule boundary

Repository evidence in `docs/CHECKPOINT.md` and `docs/SOURCES_AND_RULES.md` shows a useful shared foundation: authenticated profiles, competition drafts, membership/commissioner permissions, server-enforced UTC locks, sourced result entry, immutable historical snapshots and auditable correction flows. The first 1st & BAA and Horns & Hoops workflows have the deepest implementations. GOAT Crossover, League of Greatness and The GOAT Classic have draft records and some tested scoring helpers, but still need complete game-specific persistent entry/scoring operations and approved rulebooks/provider integrations.

Keep each competition behind a domain module/route contract with its own versioned ruleset, validation, deadlines and scoring implementation. Reuse identity, authorization, audit and snapshot primitives; never reuse one game's scoring engine as a fallback for another. Compute cross-competition BAAS/GPI as a derived, auditable layer only after the CEO approves conversion/tie/eligibility rules. No scoring or Baas rule is created by this sprint.

### Proposed integration sequence

1. Preserve competition entry and result APIs as the source of truth. Add browser mini-games as isolated static modules with a narrow host interface and no access to privileged APIs.
2. Allow guests to play locally with in-memory state. Do not create an account prompt as a prerequisite, transmit a score, or imply a saved record.
3. When hosted identity is accepted, add an optional profile opt-in for eligible achievements. A server validates allowed achievement IDs, request size, ownership, replay/idempotency and rate limits; a client score is an untrusted claim, never authority for competition standings or Baas.
4. Keep achievement storage and query policy separate from competition picks/results, with explicit retention and account deletion rules before persistence is enabled.
5. Integrate the shell through a reviewed link/card in the creative homepage branch only after the design owner accepts it. This branch does not edit `index.html`.

## 4. GOATVILLE static prototype completed

`experiments/goatville/field-vision.html` is a self-contained, 20-second scouting/reaction drill. It is responsive, uses native keyboard-operable buttons, announces status changes, supports reduced motion, and uses no images, libraries, external fonts, network calls, accounts, storage or competition APIs. Its score is temporary page state. The prototype is a technical slice, not a production game or an official GOAT Games scoring system.

Static HTML/CSS/JavaScript can immediately provide guest gameplay, local timer/score, sound-free interaction, responsive rendering, and ephemeral results. Backend services become necessary for cross-device saves, identity-bound achievements, leaderboards, moderation, durable anti-abuse enforcement or competitive prizes. Server-side validation is required before any client-submitted value affects a consequential record.

## 5. Tests, branch and integration

Run on the separate branch:

- `node --test tests/goatville-poc.test.mjs` — isolated guest-play checks.
- `npm test` — existing backend suite (63 tests on this branch).
- `npm run check` and `npm audit --omit=dev --audit-level=high`.
- `git diff --check`.

`goatville-poc.yml` runs the isolated test on relevant pull requests with read-only repository permissions. Any passing local test proves local code behavior only; it does not prove hosted Supabase, Pages configuration, mobile browser rendering or restored backups.

Current GitHub PR metadata was checked October 15: competition PR #13 and Bullpen PR #11 both change `backend/server.mjs`; Bullpen #11 and account-readiness PR #6 both change `package.json` and `.github/workflows/backend-ci.yml`. These shared-file overlaps require a combined integration/retest; exact latest-head merge conflict status was not available from the connected GitHub permission set. PR #13 is a four-commit draft with its latest update at 10:00 UTC; PR #11 and #6 remain open drafts. Homepage PR #12 remains a draft targeting `main`. The new prototype is isolated and touches none of those shared files.

Results: `node --test tests/goatville-poc.test.mjs` passed **2/2**; `npm test` passed **63/63**; `npm run check` and `git diff --check` passed; `npm audit --omit=dev --audit-level=high` reported **0 vulnerabilities**. The first prototype test run failed because its assertions assumed icon-only buttons and an opaque jsdom origin; those test-harness assumptions were corrected before the passing rerun.

## 6. Blockers and next integration sequence

### Launch blockers

- Original Supabase managed status remains `COMING_UP`; the infrastructure team has not supplied a diagnosis in the available reply.
- No approved healthy staging database, public Node host, HTTPS API origin, or tested hosted account/session path is available.
- Pages source configuration, branch protections, hosted secret controls, restore and rollback procedures are unverified.
- Three competition systems still need complete rule-approved workflows; 1st & BAA schedules/lines and unresolved policy also require verified inputs/approval.

### Nonblocking for static guest-game experimentation

- Supabase restoration and API hosting are not required to serve the isolated static prototype.
- Real device testing, product/brand review, final game design, sounds/media licensing, analytics/consent policy and any durable profile feature remain before it joins the public site.

### Recommended order

1. Finish the static site/competition draft review without merging to production.
2. Have an account administrator verify branch protection, Pages publishing source, GitHub secret presence/rotation status and recovery controls.
3. Receive Supabase's written recovery plan; establish an independent healthy development target only after cost/capacity approval.
4. Integrate the Node host/session safeguards and resolve the recorded backend/package conflicts; rerun combined tests.
5. Complete hosted Auth/RLS, permission, deadline, restore/rollback and iPhone/Safari acceptance.
6. Review unresolved competition rules and source inputs; enable only approved game paths.
7. Obtain separate CEO approval for any production migration, merge, account activation or deployment.

## 7. Remaining work estimate (engineering time after access/decisions)

- Branch/Pages/secret control evidence from an administrator: 1–2 hours.
- Supabase provider diagnosis and recovery: unknown; blocked on provider response and must be scheduled with approval.
- Healthy staging project + Node HTTPS host setup and integration: 0.5–2 engineering days, excluding procurement/account approval and provider delays.
- Resolve backend conflicts and repeat combined functional/security checks: 0.5–1 day.
- Hosted Auth/RLS, security, backup restore/rollback, device QA: 1–2 days.
- Remaining three game workflow completion and approved sourced setup: several days to multiple sprints depending on rules and upstream provider integration.
- GOATVILLE guest-game hardening/design integration: 1–3 days for a small first release; saved achievements/leaderboards require additional API, privacy, abuse and QA work.

These are planning estimates, not a launch commitment. No additional spending is assumed or authorized.
