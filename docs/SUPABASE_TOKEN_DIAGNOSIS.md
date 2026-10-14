# Supabase access token and COMING_UP — separate investigations

Pope Henry I / launch-readiness track, October 14, 2026.
No tokens were retrieved, disclosed, created, rotated or revoked. No secrets,
provider configuration or database state was modified.

## Findings

| Question | Evidence | Conclusion / confidence |
|---|---|---|
| Did GitHub receive 401? | Read-only status run [38494493813](https://github.com/adamhbrown/Goat-Universe/actions/runs/38494493813), job 115627054496, at 2026-10-14 01:13:06 UTC: `Project status access failed (HTTP 401).` | Confirmed management-authentication rejection. |
| Could the seven-day token explain it? | CEO reports a token may have been created about 30 days ago with seven-day expiry. Supabase supports PAT expiry. Current workflow sends the stored secret as a Bearer token. | Strongly consistent: if those dates/expiry and secret identity are correct, the token is expired. Actual expiry, revocation status and identity of the stored GitHub secret are not accessible through available tools, so expiry is not independently proven. |
| Was the September token validated successfully? | [Dry-run 36032527224](https://github.com/adamhbrown/Goat-Universe/actions/runs/36032527224), job 107744557599, 2026-09-24: `Supabase access token is present.` Then `IPv6 is not supported on your current network`. | Only token presence was checked. It is not evidence that the credential authenticated or was unexpired. The network failure is a separate issue. |
| Does a working ChatGPT Supabase connection repair GitHub's secret? | The connector currently reads the project and SQL, while the recorded Actions request failed. | No. They are distinct credential paths. Reconnecting one does not update the other. |
| Does token expiry explain COMING_UP? | A currently working connection still reports COMING_UP. The managed-service logs show Storage migration failures and Realtime queue timeouts, independent of the GitHub read request. | No evidence that PAT expiry causes the managed-service failure. Treat them separately. Underlying provisioning root cause remains unconfirmed. |

A 401 can also result from a revoked, invalid, truncated or wrong credential.
A 403 is a distinct project-access/scope denial. Neither should trigger a
reset/restore or a guess that changing the database password repairs a PAT.
A PAT is not a project publishable key, service-role key or user session token.

## Important secret-scope detail

`.github/workflows/supabase-project-status.yml` has no GitHub `environment`;
its `SUPABASE_ACCESS_TOKEN` comes from available repository/organization secrets.
The dry-run and manual development-apply jobs use the **development environment**;
a same-named environment secret can take precedence there. Updating only one
scope can leave the other workflow using an expired value.

The GitHub connector intentionally cannot reveal Actions secret values. No
attempt was made to dump them. An account owner should inspect token metadata
(name, resource scope, creation/expiry and last use) in Supabase, and the secret
scope/update metadata in GitHub, without copying token values into chat/logs.
Metadata correlation is useful but does not cryptographically prove two stored
credentials match. A fresh read-only authenticated check is the decisive test.

## Recommended fixes — prepared, require owner action/authorization

1. Review the Supabase token's expiry/revocation and current account access. If
   it is expired/revoked or its identity is uncertain, create a replacement
   scoped credential with an explicit owner-chosen lifetime. Record expiry in
   an internal credential register and arrange rotation before that date.
2. For the **existing-project status diagnostic**, grant only the existing
   project and Project Settings **Read**. Do not grant schema write, billing,
   project creation or restore permissions just to read status.
3. Configure the correct GitHub repository/organization secret for that status
   job, securely. Use separately scoped protected development credentials for
   migrations; never give the existing-project status token blanket write access.
4. For a reviewed dev `supabase link` workflow, the current Supabase docs require
   Project Settings, API Keys and API Key Secrets, all Read, on the **dedicated
   development target**. `db push` also uses the development database password;
   that credential is separately sensitive and is not constrained by PAT scopes.
   Do not run either against the existing protected project.
5. After approval/merge, run only the read-only status workflow. If authentication
   succeeds and state remains COMING_UP, the credential issue is resolved but
   provisioning is still open. If 401 persists, check token type/expiry/secret
   scope/format; if 403, check resource permissions/account access.
6. With separate authorization, send Supabase support the prepared provisioning
   evidence in `SUPABASE_RECOVERY.md`. Do not reset, restore, pause, recreate
   managed tables, or buy a replacement resource as an attempted token fix.

The replacement read-only diagnostic is `npm run check:management`, wired into
the proposed status workflow. It performs exactly one GET to the protected
project's metadata, with a bounded timeout. It reports credential rejection,
scope denial, throttling, transport failures and project state separately. It
never includes provider error bodies, raw tokens, request headers or unrelated
metadata. A 401 is labelled **expired/revoked/invalid**, not "expiry proven".

It exits 0 when that narrow management GET authenticates, even for COMING_UP.
That is deliberately distinct from `npm run check:deployment`, whose hosted
Auth/schema/RLS readiness can still be blocked or incomplete. In this workspace
`check:management` exits 2 (`credentials_required`); no local management PAT was
available or extracted. The working connector supplied the read-only evidence.

## First-party references checked

- https://supabase.com/changelog/38248-personal-access-tokens-expiration-usage-tracking
- https://supabase.com/changelog/scoped-personal-access-tokens-ga
- https://supabase.com/docs/guides/platform/personal-access-tokens
- https://supabase.com/docs/reference/api/introduction

The October scoped-token rollout explicitly says existing tokens continue until
expiry or deletion; there is no evidence that rollout itself revoked Adam's token.
