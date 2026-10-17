# One Universe — integration evidence

The deliverable is the runnable application, not this note. Start with
`npm run universe` after installing pinned dependencies, or use the delivered
application ZIP's `node backend/scripts/start-universe.mjs` command directly.

## Candidate

Branch: `work/one-universe-integration-20261015`, based on main
`3667f347f99415a61ec365ee0ad5ce9a2b3e08e5` and the controlled remediation
`41a0a08c707ea748d5c0ad45ac33e051ffb864ad`. The JSON inventory freezes all
**32 remote branch heads** and describes each selected, superseded or deferred
source. Working claims apply to the integrated tested candidate, not untested
individual branches. No source branch or live deployment was overwritten.

Included: Kodak `cc32fab` cinematic arrival/sports rooms/resort/theme/engines;
Tiffany `b018472` city, stadium, playground, Field Vision, Spotlight and cinema;
competition `fc8b02c`; staging/account safeguards `0fc2c9e`; reviewed member
navigation `f741461`; bounded APIs `c8cc745`; Bullpen/readiness/gate already in
main; exports/recovery `4595ef2`; browser harness `4ec4bd5` ported exactly.
The earlier separate reaction-drill experiment is retained on its original branch
but not silently substituted for the newer sport rooms/strategy attractions.

Conflicts were resolved only in the new integration worktree. Server routes
retain both games and Bullpen. Package scripts retain all checks and add the
combined suite. The shared session client replaces duplicate player-token code;
all eight remediation regressions still run using test-only introspection.
Protected-project guards and unconditional remote migration hold remain enforced.
The two creative homepages coexist: Kodak is the main arrival and Tiffany's
original is `goatville-stadium.html`. Original typography notes are retained
under separate names. Fonts/licenses remain bundled. Assets retain bytes.

## What runs

One Node process serves the explicit 48-file visitor allowlist plus `/manage`,
`/games`, `/play`, `/bullpen` and existing authenticated APIs. The shared menu
and no-JavaScript links connect the world to league/account tools. The local
starter opts in to public serving, binds only 127.0.0.1:8787, ignores hosted
credentials and uses its own `.local/one-universe` database. It never opens
the existing `.local/postgres` directory. Public serving remains off in normal
backend configuration. No default user, password, commissioner, CEO seat or
fictional league is installed in the runnable application.

The model is intentionally local development, not hardened independent hosting.
Authentication is separate from the original hosted Auth dataset. Browser tokens
remain in memory; moving to another full-page private workspace requires login.
Ordinary signup never grants Bullpen/CEO authority. Email/payments stay off.
The cinema studio uses user-selected local files; the source branches contain
the founder theme but not the missing cleared founder films. No nonexistent
films, rights clearance, official contest results or live AI clients are claimed.

## Verification

- **366 tests passed, 0 failed/skipped**, full combined backend and visitor suite,
  concurrency 2. Initial integration failures were resolved, not skipped: stale
  token-code test hooks, outdated root-404 expectations on the opt-in site, and
  seven-page navigation assertions after combining destinations.
- Existing syntax, Bullpen syntax, new module syntax and whitespace checks pass.
- Actual HTTP test reads all 48 public payloads and compares SHA-256 bytes to
  source. Root navigation connects to games/accounts/city/stadium/cinema.
- Root inline scripts have exact CSP hashes, not script unsafe-inline. Guest
  child pages alone permit same-origin framing; parent/private pages deny it.
  Both guest games now verify the parent against the loaded resource's origin,
  including opaque-origin tests and complete invalid-origin handshake rejection.
- Founder theme full and byte-range/suffix requests preserve bytes; invalid
  ranges return 416. HEAD metadata passes. No arbitrary path/directory serving.
- Backend source, env files, package metadata, migration SQL, docs and local
  database paths return 404 through the public site; private API denial retained.
- Integrated persistence test creates a local account and all five actor-owned
  drafts, restarts the on-disk database, and rechecks IDs/audit records. Signup
  has no founder roles; Bullpen remains denied. Other inherited tests restore
  competition snapshots/audit and all private Bullpen records/access denials.
- No Chromium executable or supported user-facing port-forwarding tool is
  available in this workspace. DOM/HTTP tests are not real browser, iPhone,
  Safari, VoiceOver or hosted security acceptance. Original unresolved local
  transport flake from earlier PR #28 is not claimed diagnosed by passing runs.

## Original data — read-only observations, not a migration

The current original project still reports COMING_UP. Unlike the earlier empty
schema checkpoint, it now has application and private Bullpen tables, and five
recorded migrations: 20261014000100, 20261014000200, 20261014092016,
20261014095916, 20261014221554. Exact SELECT counts on users/profiles/leagues/
picks/history/audit/memberships/prospects and Bullpen messages/tasks/audit were
zero; the fixed seats table has four rows. This sample does not establish that
every dataset is empty. No passwords, tokens, row contents or personal records
were fetched. Schema definitions, migration history, grants/RLS/functions, Auth
configuration, all datasets and any objects still require preservation/export
verification before a future authorized move. No hosted backup or restore was
performed. The combined local source contains later reviewed competition
migrations; they were NOT applied to the original project.

Inventory also now reports Downtown Sports Inc ACTIVE_HEALTHY, other two projects
INACTIVE. It was not repurposed. Status changes are observations, not permission
to use an existing project. No Supabase write, credential change, provider
resource, new support message, purchase, PR merge or production deployment here.

## Next gate

Review this single candidate and its live local behavior. The next public-facing
step requires an exact approved host/origin/cost and deployment authorization,
real browser/device checks, hardened Auth/session/storage and restored-backup
evidence. Official leagues require approved sourced schedules/rules and actual
commissioner acceptance. Publishing a static subset would not host the Node
application. The existence of a runnable ZIP is not a public service claim.
