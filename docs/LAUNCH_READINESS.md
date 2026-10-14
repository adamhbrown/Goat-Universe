# Operation Launch Readiness — October 14, 2026

Owner: Pope Henry I, launch-readiness track. Branch: `work/launch-readiness`.
Base: `codex/backend-foundations` at
`aa61f90a06e1d58aa433030df4769197fe5f4206` (latest fetched when this track began).
Target of this draft PR: **development branch**, not `main`.

This handoff reports implemented changes and open gates. It is not a production
launch certificate. The public homepage, competition engines, scoring rules,
schedules, scores and Baas policy are unchanged. Nothing was merged or deployed.
No hosted schema, Auth configuration, email, payment or external outreach was
changed or triggered.

## Implemented in this track

- `/play` and `/manage` now share the tested in-memory session client. Concurrent
  expired requests share one rotation; stale responses cannot replace a newer
  account or rebuild a signed-out private view. Failed refresh clears the view.
- Sign-out erases browser credentials immediately. Expired access can refresh
  solely to revoke the old server session. Failure is reported as **server
  sign-out unconfirmed**, rather than claiming all sessions were revoked.
- Safari `pagehide` removes tokens, typed login passwords and private panels
  before back/forward caching. Reloading, returning after navigation or moving
  between portals requires sign-in. Backgrounding alone does not deliberately
  sign a user out. No localStorage/sessionStorage persistence was added.
- The player portal now has recovery requests, password visibility controls,
  clear length guidance and a link to account/commissioner management. Duplicate
  account submissions are blocked; passwords clear after success and failure.
- Mobile forms retain zoom, use email keyboard hints and non-capitalized email,
  have minimum tap heights, safe-area padding, contained wide tables and skip
  links. Commissioner deadlines name the browser's IANA time zone. Text remains
  escaped and the existing restrictive content security policy stays in place.
- Email validation accepts harmless surrounding whitespace, normalizing case
  consistently before local or hosted account calls.
- Hosted staging now rejects missing, insecure or malformed origins (paths,
  fragments, credentials and query strings are forbidden). Port configuration
  is checked. Manual development migration guards validate the HTTPS origin
  **before** applying a schema change.
- A non-root Node 24 Docker image packages only backend code and migrations.
  Its read-only health probe rejects missing/incorrect schema health. CI builds
  the image and verifies that unconfigured startup fails. No deploy job exists.

## Evidence and verification limits

The current local suite passes **73 tests, 0 failures, 0 skips**. JavaScript
syntax checks and production dependency audit pass (0 reported vulnerabilities).
The exact final commit and remote CI outcome are recorded in the draft PR.
Coverage includes the existing 60 tests plus session races, delayed login/data,
failed revocation, player recovery retry, duplicate-submit behavior, cache
cleanup, hosting origin validation and container-health exit behavior.

**JSDOM is not Safari.** There is no installed browser-control capability or
Docker daemon in this workspace. Actual iPhone/desktop layout, keyboard,
password-manager behavior, email-app navigation, private mode, accessibility,
landscape and Docker image execution are still acceptance gates. CI performs
container build/startup checks; it does not test hosted Supabase or real email.
Provider responses in account tests are mocks, not delivery evidence. The
management diagnostic has separate tests for credential denial, scope denial,
provisioning state, transport errors and sensitive-output redaction.

## Read-only infrastructure finding

At **2026-10-14 12:01 UTC**, Supabase still reported `COMING_UP` for
`opvoemihfyxidzbdyory` (`us-east-1`). PostgreSQL started at 09:04:44 UTC and
answered the read-only catalog query. `auth.users` and `auth.sessions` exist;
`storage.objects` and `realtime.subscription` are absent; public table count is 0.

The 09:00–12:05 UTC log window shows managed Storage migrations repeatedly
failing (latest returned event 11:21:33 UTC), aborted Storage health requests,
and Realtime `MigrationsFailedToRun` with 15-second connection-queue timeouts
(latest returned Realtime failure 11:11:43 UTC). A later read-only connection
snapshot showed three idle client backends and one active client backend;
that snapshot does not establish historical pool capacity or a root cause.
No matching PostgreSQL/PgBouncer fatal/error/failure messages were returned by
the targeted filter. This is not proof those services are healthy.

**Inference:** startup/provisioning of managed services has not completed. The
connector's SQL path working does not prove Auth, PostgREST, Storage or Realtime
is ready. The evidence does not establish which underlying platform issue is
responsible. Do not diagnose it as a GOAT application migration defect: no app
tables or app migrations have been installed there.

Do not reset/pause/restore this project, apply migrations to it, or manually
create managed Storage/Realtime relations. The prepared support note is in
`SUPABASE_RECOVERY.md`; sending it needs Adam's authorization. The prior GitHub
Actions management-token 401 is a separate credential problem. The CEO
subsequently supplied a seven-day-expiry lead; workflow/log evidence and
recommended credential handling are in `SUPABASE_TOKEN_DIAGNOSIS.md`. A tested
read-only management diagnostic now distinguishes 401, 403 and project state.

## What prevents hosted registration now

1. No dedicated, healthy development Supabase target is configured. The existing
   protected project remains in incomplete managed-service startup.
2. This runtime has no development `SUPABASE_URL`, publishable key or HTTPS
   `APP_ORIGIN`. The read-only deployment preflight is **blocked**.
3. No Node API host is configured. GitHub Pages hosts the static public site;
   it cannot run this Node server. The backend intentionally does not serve `/`.
4. Application migrations and hosted Auth/RLS acceptance have not run on a
   dedicated target. Local PostgreSQL and Auth mocks cannot replace those checks.
5. SMTP, sender, exact callback allowlist and custom token-hash templates need
   verification. `AUTH_EMAIL_ENABLED` remains false. No test emails were sent.
6. Real iPhone/desktop acceptance and operational controls remain open.

## Staged release plan

| Stage | Deliverable and exit evidence | Authorization/dependency |
|---|---|---|
| 0 — Review | Review separate readiness PR with competition-platform changes. Green tests and container CI. | No merge without Adam's approval. |
| 1 — Isolated development | Healthy dedicated Supabase target and one HTTPS Node origin serving `/play`, `/manage`, `/auth/*` and APIs together. Migration dry run then development apply, health and anonymous-denial checks. | Adam selects/approves target and hosting; review plan/cost before any project/branch/service creation. Protected credentials. |
| 2 — Approved test accounts | Configure confirmations and token-hash templates, then enable email only for approved test inboxes. Verify signup, confirmation, login, refresh, reset, wrong/expired/reused links, cross-user RLS and revocation through direct Data API. | Explicit email-test approval, verified sender/provider and exact redirect URLs. |
| 3 — Playable private beta | One approved competition completes entry, approval, picks, server-side locks, results, standings and correction/archive acceptance. Commissioner and two ordinary test accounts; real mobile/desktop acceptance and outage/recovery drill. | Founder-approved rules and sourced schedule/lines/results from platform track. No invented dates or teams. |
| 4 — Initial public playable release | Approved competition only; all five official games remain visible with truthful availability. HTTPS, gateway rate protection, monitored backups, restore evidence, privacy/terms/support and founder brand sign-off. | Explicit production merge/deploy/launch approval. Registration does not imply paid access. |
| 5 — Commercial activation | Separate provider sandbox acceptance, refund/dispute/tax/eligibility review, price and membership approval, verified webhook idempotency, monitored rollout. | Separate express payment authorization. External outreach requires separate express permission. |

The first playable competition is the founder's selection after rules and
schedule readiness. Local NFL and NCAA workflows exist; this track neither
approves their unresolved policies nor chooses real fixtures.

All five games stay represented: **1st & BAA**, **Horns & Hoops**,
**GOAT Crossover** (combined NBA/NHL), **League of Greatness**, and
**The GOAT Classic**. Unfinished games must stay closed, with truthful labels.
No annual Baas allocation or payout is approved by this release plan.

## Before any real people can register

- [ ] Confirm target is healthy and separate from `opvoemihfyxidzbdyory`; no
      production data/credentials in the development app.
- [ ] Review/merge approved readiness changes into development, resolve overlaps
      with Tiffany's UI work, and rerun CI against the combined exact commit.
- [ ] Configure exact HTTPS origin, host/TLS, secret injection, log redaction and
      protected CI environment/reviewers. Build and run image on the chosen host.
- [ ] Dry-run then apply reviewed migrations only to the confirmed dev target.
      Verify health, anonymous denial and ordinary-member direct/RPC isolation.
- [ ] Verify hosted confirmation requirement and sender/templates/allowlist.
      Approve specific test inboxes before enabling `AUTH_EMAIL_ENABLED=true`.
- [ ] Exercise account creation, duplicate/unknown email behavior, explicit
      confirmation, scanner/prefetch GET, expiry/reuse, wrong credentials, reset,
      refresh rotation, logout and password-change revocation on actual provider.
- [ ] Verify Safari email-app to callback flow, keyboard/autofill, 320/375/390px
      and landscape layouts, zoom, focus, status announcements, table scrolling,
      league join/picks and commissioner forms. Retest background/resume and Back.
- [ ] Establish HTTPS gateway access controls and durable per-client rate limits.
      Current in-process socket-IP limiter is not distributed; behind a proxy it
      may treat every visitor as one address. Do not blindly trust client XFF.
- [ ] Record tested backup/restore, monitoring, incident owner, rollback commit,
      retention/deletion policy and a usable support/account-recovery channel.
- [ ] Founder/counsel review: participation age/territories, rules and eligibility,
      any prizes/promotions/entry fees, privacy and terms, consent/data retention,
      minors, dispute handling and data-provider permissions. This is a review
      dependency, not a legal clearance or approval of any contest.
- [ ] Brand review: five official names, GOAT Universe/Downtown Sports Nation/
      GOATverse Publications, authentic permitted imagery, truthful availability,
      no unapproved prices, fabricated audience claims, sponsors or Baas promises.
- [ ] Keep `PAYMENTS_ENABLED=false`, payment approval false and no outbound sender.
      Newsletter preference storage is not permission to start a campaign here.

## Safest next deployment step

Review this draft PR first. With Adam's authorization and protected credentials,
select a healthy dedicated development database and existing/approved Node
container host. Deploy the reviewed exact commit there with email and payments
**off**, run the read-only preflight, then schedule approved-inbox Auth acceptance.
Do not repoint or modify the public GitHub Pages homepage during this step.

Supabase's current first-party documentation reviewed during the investigation:

- https://supabase.com/docs/guides/auth/auth-smtp
- https://supabase.com/docs/guides/deployment/going-into-prod
- https://supabase.com/docs/guides/auth/auth-email-templates
- https://supabase.com/changelog/realtime-schema-locked-down-against-modification
- https://supabase.com/changelog/cbc-tls-ciphers-deprecated

The recent TLS deprecation is a future compatibility review item, not evidence
of this provisioning failure. Managed Realtime schema restrictions reinforce
leaving that service's migration state to Supabase.
