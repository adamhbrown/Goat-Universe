# Hosted development runbook — prepared, not deployed

This application is a Node server, not a static export or Worker. Preserve the
existing GitHub Pages public site. The smallest change is to run the backend,
player portal and management portal together at **one separate HTTPS origin**,
backed by a healthy dedicated Supabase development project. Keep the same-origin
API guard; do not solve hosting by allowing arbitrary CORS.

A non-root Dockerfile is provided. No hosting provider, subscription, account,
project, branch or infrastructure resource was created. Choose an existing
approved container host first; obtain Adam's authorization before creation,
charges or deployment. A managed branch is an option only after the base project
is healthy and its availability/cost has been reviewed. No pricing assumption is
made. Do not deploy the local PGlite/password adapter to real users.

## 1. Select and protect development resources

- Use a healthy dedicated development Supabase target. Never apply GOAT
  migrations to the currently protected `opvoemihfyxidzbdyory` project.
- Record the approved HTTPS origin, e.g. `https://<development-host>`, without a
  path or trailing slash. `/play` is the participant entry path; `/manage` is
  the commissioner/account workspace. Backend `/` deliberately returns 404.
- Store secrets in the provider/environment secret store. Never paste keys into
  source, Docker build arguments, shell arguments, PR comments or screenshots.
  Publishable keys are distinct from server billing keys. This app needs no
  billing/service-role key for ordinary competition/account/CRM requests.
- Set GitHub `development` environment reviewers/protection. The migration
  workflow is manual only and must be registered on the default branch before
  it can be dispatched for the development ref; this merge needs approval.

Required environment values for the proposed app host:

| Variable | Value |
|---|---|
| `BACKEND_MODE` | `supabase` |
| `APP_ENV` | `staging` |
| `NODE_ENV` | `production` (runtime optimization; separate from app release stage) |
| `HOST` | `0.0.0.0` inside the container |
| `PORT` | `8787` or the approved host's integer port |
| `APP_ORIGIN` | Exact approved HTTPS origin |
| `SUPABASE_URL` | Dedicated development project's HTTPS API URL |
| `SUPABASE_PUBLISHABLE_KEY` | Development publishable key, injected at runtime |
| `AUTH_EMAIL_ENABLED` | `false` until email setup and tests are approved |
| `PAYMENTS_ENABLED` | `false` |
| `PAYMENT_LAUNCH_APPROVED` | `false` |
| `PRODUCTION_LAUNCH_APPROVED` | `false` |

Do not provide Stripe secrets or `SUPABASE_BILLING_SECRET_KEY` to this unpaid
beta. Origin validation rejects accidental paths, credentials, queries and
fragments so email callbacks and POST origin checks cannot drift apart.

## 2. Prepare reviewed schema on development only

Configure protected GitHub development values:

- Variables: `SUPABASE_DEV_PROJECT_REF`, `GOAT_DEV_APP_ORIGIN`.
- Secrets: `SUPABASE_ACCESS_TOKEN`, `SUPABASE_DEV_DB_PASSWORD`,
  `SUPABASE_DEV_PUBLISHABLE_KEY`.

The existing previous management token returned 401; the working ChatGPT
Supabase connector does not replace that Actions secret. An owner must configure
a valid appropriately scoped management credential securely.

After approval, the prepared manual workflow checks the exact development ref,
explicit apply confirmation, branch and HTTPS origin before running tests,
linking, dry-running, applying migrations and checking anonymous denial. Do not
run it from `main` or redirect it to the protected existing project. No workflow
was dispatched by this track. It neither hosts the server nor configures Auth.

## 3. Build and run the reviewed image

The image installs only production dependencies with install scripts disabled,
uses the unprivileged `node` user, and contains backend code plus tracked app
migrations. It does not contain the public homepage, .env files or Git history.
Image tags should identify the exact reviewed commit; pin the base-image digest
in the chosen host's release process after verifying provenance.

Build command (no credentials required):

```sh
docker build --tag goat-backend:<reviewed-commit> .
```

Run through the approved host's runtime secret injection with the values above;
terminate TLS at its HTTPS gateway and forward the same origin. Do not use a
CLI `-e KEY=secret` example or print the environment. Restrict direct container
exposure to the trusted gateway. Use one instance for the first controlled beta;
process-local throttles are not suitable for distributed public registration.

Health uses `GET /health` and the container probe exits nonzero for a missing,
unavailable or unexpected application schema. A healthy container is **not**
proof of email delivery or complete service provisioning. Monitor structured
status, not token/password request bodies. Configure graceful SIGTERM handling
(the existing server closes database/server connections), restart policy and
HTTPS gateway timeouts/rate protection.

This workspace has no Docker daemon, so local image build/run was not performed.
The PR's CI includes a real Docker build, non-root-user inspection and a startup
failure check without credentials. Record that CI result before deployment.

## 4. Run read-only hosted checks

On the configured development runtime, without passing credentials as arguments:

```sh
npm run check:deployment
```

Exit 2 is blocked/incomplete, not a hosted pass. With an approved existing
ordinary-member token securely supplied in `GOAT_ACCEPTANCE_ACCESS_TOKEN`, the
checker can also verify that member's Auth identity, private profile RPC/direct
reads and denial of executive RPCs. It creates no account and sends no email.
Never paste the token into the command. Remove the acceptance token after use.

Supply a second distinct ordinary member session through
`GOAT_SECOND_ACCEPTANCE_ACCESS_TOKEN` to check both directions of profile RLS
and caller-ID spoofing through `goat_query`. Both accounts must be confirmed,
non-staff accounts on the dedicated development project. Reports omit account
IDs, raw credentials and provider error bodies. Missing either test account
keeps acceptance incomplete. No account is created by the checker.

`APP_ENV=staging` with `NODE_ENV=production` is supported for this read-only
preflight, matching the optimized container runtime above. A production
`APP_ENV` or the protected existing Supabase target remains forbidden.

## 5. Approve and test email before opening registration

Follow `ACCOUNT_ACTIVATION.md`: verify SMTP/sender and service limits, exact
Auth Site URL/redirect allowlist and fragment token-hash signup/reset templates.
Do not use unsupported implicit-session links. Verify confirmation stays on.
Only after approved test inboxes and explicit authorization exist should staging
set `AUTH_EMAIL_ENABLED=true`. This enables external Auth emails; it is separate
from commercial communication and payment approval. Verify actual delivery,
expiry/reuse, scanner behavior, reset, session revocation and direct Data API
RLS with at least two ordinary accounts and a commissioner before any beta.

## Rollback and release evidence

Record commit/image digest, migration set, secret/config revision, health and
acceptance results. Roll back the app image to the last reviewed compatible
commit if acceptance fails; disable email first if links or recovery misbehave.
Do not reverse database migrations or reset data as an automatic rollback.
Keep any beta private/unadvertised until all gates in `LAUNCH_READINESS.md` pass.
Production needs its own reviewed target, configuration and explicit approval;
this runbook does not authorize a production merge or deployment.
