# Account security and staging handoff — October 14, 2026

Owner: Pope Henry I. Review branch: `work/pope-account-security-20261014`.
Target: `codex/backend-foundations`, never `main`.

## Engineering completed this session

- Logout clears local credentials and panels immediately, then waits for any
  already-running refresh before revoking the rotated server session. It does
  not submit that single-use refresh token a second time. Revocation transport
  failures are reported as unconfirmed rather than claimed as success.
- Replacement sign-in invalidates the previous account's private views even
  if authentication fails. Delayed queries and failed old rotations cannot
  disclose the old account or invalidate the new account.
- Late logout completion cannot hide a member who signed in again, in either
  `/play` or `/manage`. Stale catalog completion cannot refill a cleared private
  dashboard. Session checkpoints carry no tokens or account data.
- Ordinary hosted logout explicitly uses `scope=local`, matching local Auth.
  Password changes/recovery retain deliberate global session revocation.
- Confirmation/reset callbacks are single-flight, have a 15-second transport
  timeout, allow retry after rejection, and clear one-time hashes and typed
  passwords on Safari `pagehide`. A late response cannot revive that page.
- Management recovery requests now reject duplicate keyboard/synthetic submits.
- The read-only staging checker can verify two distinct confirmed ordinary
  members in both directions: direct profile reads must be empty for the other
  user, and caller-supplied user IDs must not change the RPC identity. It rejects
  staff/same-user fixtures, exposed profiles, spoofed identities and transport
  errors. Its output omits credentials, account IDs and provider error bodies.
- The checker accepts the documented optimized runtime (`APP_ENV=staging`,
  `NODE_ENV=production`). Production APP_ENV, unqualified production runtime,
  live payments and the protected existing database remain blocked.

Fourteen new regression test cases cover these changes. Two initially reproduced
the refresh/logout race and failure to clear an old account view; both pass
after the fixes. Final combined local suite: **92 passed, 0 failed, 0 skipped**.
`npm run check`, `git diff --check` and production dependency audit passed;
the audit reports zero vulnerabilities. Current-commit remote CI is recorded in
the draft PR after it runs. Local/DOM tests are not real iPhone acceptance or
hosted email-delivery evidence.

## Integration with PRs #2 and #4

The branch began at PR #4's `b743f1eb5b7724814b32e541f31efa24d722ddf7`, which
already includes PR #2's readiness code. The latest foundation commit
`705009d75306c8352f7ccdfee9affe5f28d6ffe2` was incorporated only into this
isolated review branch. One `manage.css` conflict was resolved by retaining
both the readiness/mobile rules and newer accessible NCAA round rules.
Foundation competition changes were preserved, not rewritten in this session.

Treat this as the combined review candidate relative to that foundation commit.
Do not apply PR #2/#4's overlapping patches again on top of it. The original
branches and PRs were not changed or closed, and no PR was merged. If either
workstream advances, inspect the new diff and retest the resulting combined tree.
Tiffany still owns member-facing experience decisions; Codex owns engines.

## Supabase: verified and unverified

- Connected management listing still reports `COMING_UP` for protected project
  `opvoemihfyxidzbdyory`, region `us-east-1`.
- Read-only SQL returns PostgreSQL 17.6. `storage.buckets`,
  `storage.migrations`, `realtime.schema_migrations`, and `public.profiles`
  resolve to NULL. Prior application-table inspection is recorded in
  `SUPABASE_RECOVERY.md`; `profiles` alone is not a check of GOAT's prefixed tables.
- Latest returned Storage migration error: 2026-10-14 11:21:33.917 UTC,
  worker v1.80.2, error `timeout expired`. Returned Realtime error attributes
  at 11:11:43.263 UTC identify the migration runner and `connection_error`.
  Earlier queue-timeout/missing-subscription evidence remains in the recovery
  document. The new log interface did not expose the requested message fields;
  this session does not claim a newly identified Realtime root cause.
- GitHub job 115627054496 was read: at 01:13:06.551 UTC it logged
  `Project status access failed (HTTP 401).` Run: https://github.com/adamhbrown/Goat-Universe/actions/runs/38494493813
- Seven-day PAT expiry is consistent with the CEO's timing, not independently
  proven secret metadata. A working connector does not replace an Actions
  secret. The PAT failure and managed-service provisioning remain separate.
- `check:management` remains blocked for missing local management credentials.
  `check:deployment` remains blocked for missing development URL, publishable
  key and HTTPS origin. Neither is presented as a successful hosted test.

Safest strategy: preserve the existing database; have the owner approve either
provider inspection/repair or a separately approved healthy development project
and HTTPS host. Do not manually recreate managed tables. Prepare/apply reviewed
app migrations only to the dedicated approved development target, never the
protected existing project. No resource creation, purchase, credential rotation,
provider contact or hosted mutation occurred.

## First-user registration gates

- [ ] Approve the combined development changes and exact reviewed commit.
- [ ] Select/authorize healthy isolated Supabase and HTTPS Node hosting targets.
- [ ] Supply protected development credentials; separately resolve the Actions
      management-token scope/expiry problem through authorized owner action.
- [ ] Confirm managed services healthy, apply reviewed development migrations,
      then pass anonymous denial and two-member Auth/RPC/direct-profile checks.
- [ ] Configure confirmation-required Auth, exact callback allowlist, approved
      sender/templates and specific acceptance inboxes. Approve email testing
      before enabling it; email and payments stay disabled now.
- [ ] Test actual signup/verification/login/recovery, duplicate/unknown emails,
      expired/reused/wrong-type links, password change and revoked-session denial
      through both RPC and direct Data API with two members and a commissioner.
- [ ] Test actual iPhone Safari and desktop: keyboard/autofill, email-app links,
      focus/zoom/landscape, Back/cache restoration, refresh/logout and reconnect.
- [ ] Verify gateway rate protection, monitoring, backup/restore evidence,
      rollback, recovery/support ownership and founder launch review described
      in `LAUNCH_READINESS.md`.

Local signup/login/profile/settings/access controls are available for regression
testing. Hosted verification and recovery have implementation/mock coverage but
require the real-provider gates above. No real-user registration is open yet.
