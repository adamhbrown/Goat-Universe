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

## Authorized development target — creation remains conditional

| Item | Exact proposal |
|---|---|
| Name | GOAT Universe Staging |
| Organization | downtown-sports |
| Region | us-east-1 |
| Type | New independent development project, not a branch of the unhealthy project |
| Maximum authorized additional cost | $0; stop if an upgrade, paid compute or payment is required |
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
The CEO authorized the exact project above only after explicit zero-cost and capacity confirmation. The signed-in dashboard confirms Free, an enabled spend cap, no payment method and $0 prior invoices. The creation form is prepared with the approved name and us-east-1, but does not explicitly certify an available free slot. No project was created, purchased or changed.

## Prepared infrastructure gate

`npm run check:staging-infrastructure` reads ONLY the proposed development
project's Management API metadata and service health. It blocks missing/malformed refs,
all four existing project references, missing organization identity, missing/rejected
credentials, scope denial, wrong project/organization, throttling and incomplete provisioning.

Only overall `ACTIVE_HEALTHY` followed by exactly one healthy status for each of
Database (`db`), PostgREST (`rest`), Auth (`auth`), Storage and Realtime returns
`ready_for_migration_review`. Missing/duplicate service records, invalid JSON,
unrecognized statuses and partial startup fail closed. The deprecated `healthy`
boolean cannot override `status`. Two GETs share one 15-second deadline; redirects
are rejected. Raw errors, metadata and credentials are never included in reports.

This does not certify the application, managed-schema contents, email delivery,
or deployed Edge Functions. The documented health endpoint does not expose an
Edge Functions service enum; verify that separately before any hosted acceptance.
No migration or hosting action is authorized by a successful check. The manual
migration workflow has not been dispatched.

Official API contract checked October 14, 2026:
https://supabase.com/docs/reference/api/v1-get-services-health

Eight regression tests cover preservation, partial startup, missing/duplicate
service evidence, deprecated flags, response redaction, both endpoint failures,
identity checks and bounded non-mutating transport. Full suite: 100 tests passed,
zero failures or skips; syntax and whitespace checks passed. Current-head CI is
confirmed by [GitHub CI run 38601861630](https://github.com/adamhbrown/Goat-Universe/actions/runs/38601861630)
for code commit `ae4d40080feac9a8331772ae4109a5e8db3933a7`, including Docker
build, non-root inspection and refusal of unconfigured hosted startup. The
workflow now runs this health gate before CLI linking or migration dry-run. The paused account-resilience checkpoint
remains separate.

## Remaining execution sequence within authorization

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
On October 14 at approximately 12:43 p.m. Eastern, one CEO-authorized support
ticket was submitted for the original project, category Other, severity Normal
(system impaired; no production outage asserted), affected services Storage and
Realtime. Supabase visibly confirmed "Support request sent" and said it would
reply to the owner's account email. The confirmation page showed no number; the owner subsequently supplied the
email acknowledgment identifying **SU-507996**. That email is an acknowledgment,
not a technical diagnosis; no findings have arrived. The request included verified error timestamps, missing managed
relations and the separate workflow 401; it requested diagnosis and an in-place
recovery recommendation only. Temporary human/AI support access was disabled.
No credentials, secrets, HAR files or raw payloads were shared. Any repair,
restart, migration, credential change or resource modification still requires
separate CEO approval. A fresh
development target can unblock isolated testing while the protected original
project's provisioning remains under investigation.
