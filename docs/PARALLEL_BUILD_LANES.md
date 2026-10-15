# GOAT Universe — parallel build lanes (October 14, 2026)

Purpose: develop in parallel without overwriting work or prematurely exposing users.

## Shared baseline
- Repository: `adamhbrown/Goat-Universe`.
- Public site: `main` — never update, deploy or merge without founder approval.
- Integration baseline: `codex/backend-foundations` (draft PR #1).
- Workers use separate branches and open **draft PRs targeting `codex/backend-foundations`**, never `main`.
- Latest audited baseline head: `aa61f90a06e1d58aa433030df4769197fe5f4206`, 60 passing CI tests. Verify tests again after changes.
- Existing Supabase project `opvoemihfyxidzbdyory` reports `COMING_UP`. Do not migrate, reset, manually change managed service tables, purchase resources or expose credentials. External outreach, email, payments and public registration remain disabled.

## Team and ownership
### Tiffany Jane — VP, GOAT Games
- Branch: `codex/backend-foundations`.
- Own `backend/rules/`, scoring implementations, competition architecture and tests, commissioner/player competition workflows.
- Five competition brands remain 1st & BAA, Horns & Hoops, GOAT Crossover (one combined NBA/NHL event), League of Greatness, and The GOAT Classic.
- Do not invent events, spreads, dates, results or unapproved Baas allocations. Local tests do not constitute production launch.

### Pope Henry I — CTO, infrastructure & identity
- Branch to create: `work/launch-readiness`.
- Own hosting/deployment readiness, account activation, Supabase diagnosis, staging preflight, real-device browser acceptance. No provider mutations or service purchases.
- Before editing shared `backend/server.mjs`, `backend/config.mjs` or `backend/portal/manage.mjs`, coordinate with TJ.

### QA / Security analyst — independent verification
- Branch created: `work/qa-security`.
- Own additional tests in `backend/test/`, audit notes, authentication/authorization/deadline regression coverage. Avoid altering business-rule implementation without coordinating.
- Verify actor-scoped permissions, direct RLS, league boundaries, lock times, session revocation, XSS, and the absence of outbound requests.

### Commercial / CRM analyst — GOAT business desk
- Branch created: `work/commercial-crm`.
- Own `backend/console/crm.*`, CRM-specific tests and documentation, with explicit no-send protections.
- Strengthen pipeline records, evidence, approvals, reminders and reporting. Leads must be real sourced records, not inventions; pipeline is not booked revenue.

## Integration protocol
1. Branch from latest `codex/backend-foundations`, scope edits strictly to the assigned lane and coordinate on shared files.
2. Run `npm test` and `npm run check` plus relevant special preflight; attach actual results and exact commit in a draft PR.
3. Target drafts into `codex/backend-foundations`. No worker self-merges to the integrated branch or pushes to `main`.
4. TJ and founder assess conflicts, source approvals, legal/brand issues, hosted acceptance and integration sequence.
5. No claim of live accounts, paid users, emails, deployed portal or Supabase repair until independently verified.

Additional workers require separate user-started Work sessions; creating a branch does not itself start a worker.
