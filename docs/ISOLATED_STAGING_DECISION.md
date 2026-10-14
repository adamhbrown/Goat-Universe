# Isolated staging decision — October 14, 2026

Active owner: Pope Henry I. Current priority: infrastructure and staging, not
rebuilding account features. Candidate branch: `work/pope-isolated-staging-20261014`.

## Current verified inventory

Organization `downtown-sports` (`mfdvazvckhhxjhnhmpxc`) is on the Free plan.

| Project | State | Action in this session |
|---|---|---|
| Goat-Universe (`opvoemihfyxidzbdyory`) | COMING_UP | Read-only inspection only; preserve |
| Downtown Sports Pulse | INACTIVE | None |
| Downtown Sports Inc | INACTIVE | None |
| DSI World Cup Shootout 2026 | INACTIVE | None |

No development branches were returned. PostgreSQL on the protected GOAT project
has been running since 09:04:44.436 UTC. A current aggregate snapshot returned
four client connections, one active client and zero lock waiters. This does not
establish historical pool saturation, a provisioning root cause, or platform
health. Managed-service failures and absent relations remain documented in
`SUPABASE_RECOVERY.md`. Reconnecting or replacing the Actions PAT does not repair
managed Storage/Realtime startup.

## Proposed development target — needs owner approval before creation

| Item | Exact proposal |
|---|---|
| Name | GOAT Universe Staging |
| Organization | downtown-sports |
| Region | us-east-1 |
| Type | New independent development project, not a branch of the unhealthy project |
| Maximum authorized additional cost proposed | $0; stop if an upgrade, paid compute or payment is required |
| Existing projects | Do not reset, restore, pause, delete, migrate or repurpose any |
| Email / payments | Disabled throughout initial preparation |
| Account data | No copying of production users, credentials or content |

Current first-party pricing lists Free at $0/month with a limit of two active
projects, and branching is not included in Free. This makes a new independent
Free project the candidate to inspect, rather than a paid branching workflow.
This is NOT an account-specific cost/availability guarantee. The connector's
project/branch `get_cost` tools returned UNAVAILABLE (`not returned by tools/list`).
An owner-approved creation flow must confirm available quota and zero additional
cost before any resource is created. Stop rather than upgrade or remove an old
project to obtain capacity.

Pricing checked: https://supabase.com/pricing
No purchase, resource creation, plan change or provider contact was performed.

## Prepared infrastructure gate

`npm run check:staging-infrastructure` reads ONLY the proposed development
project's Management API metadata. It blocks missing/malformed refs, the
protected existing GOAT reference, missing/rejected credentials, scope denial,
wrong project/organization, throttling and incomplete provisioning.

Only `ACTIVE_HEALTHY` returns `ready_for_migration_review`. That wording does
not certify all service endpoints, hosted accounts or the application. The
manual development migration workflow now checks this gate after dry-run and
before applying schema changes. Existing branch, exact-ref, HTTPS-origin and
credential guards remain in place. The workflow has not been dispatched.

Three regression cases cover protected targets, non-mutating health requests,
credential/scope errors, response redaction and project/organization mismatch.
The infrastructure branch's full local suite passes 95 tests, zero failures or
skips; syntax and whitespace checks pass. Current-head CI is recorded in its
draft PR. The paused resilience checkpoint is separate and is not being
integrated into this infrastructure candidate.

## Execution sequence after explicit approval

1. Confirm the proposed organization/region and zero-cost quota in the creation
   flow. Create only the approved fresh development project; retain all existing
   projects. Use secure generated credentials without printing/pasting them.
2. Verify management status ACTIVE_HEALTHY; check Auth, Data API, Storage and
   Realtime startup read-only. Do not repair managed schemas manually.
3. Record the new project ref and organization in the protected development
   configuration. Inject its publishable key/database credential securely.
   Separately replace a management PAT only after credential authorization.
4. Select an approved Node/container host and exact separate HTTPS origin.
   GitHub Pages cannot run this server. The existing tested Docker image and
   `HOSTED_DEVELOPMENT.md` are ready; no Node host is currently configured.
5. Review the final combined commit and Kodak's verified migration set before
   applying it to the NEW target. Crossover/Classic persistence remains
   unverified until Kodak's tests pass. Do not install an unreviewed changing
   migration set just to get a green health result.
6. Run migration dry-run, management-health gate, explicit development apply,
   schema/anonymous checks and two-member hosted RLS acceptance. Each hosted
   mutation/deployment remains within the CEO's express authorization.
7. Keep email/payment flags false. Real verification/recovery delivery requires
   approved sender/templates/redirects, designated test inboxes and separate
   email-test authorization. Real iPhone testing follows a working HTTPS host.

## Existing-project recovery remains separate

The provider provisioning failure is not safely repairable by fabricating
Storage/Realtime tables, resetting databases or changing app security code.
The prepared support request in `SUPABASE_RECOVERY.md` is ready for owner review;
it has not been sent. Provider contact/repair needs authorization. A fresh
development target can unblock isolated testing while the protected original
project's provisioning remains under investigation.
