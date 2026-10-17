# Operation Late-Night Goatville — evidence and release gates

**GO for local founder review. NO-GO for shared hosting, main merge, hosted migration or production release.** October 17, 2026. This report describes an isolated local integration follow-up, not a launch certificate.

## Candidate and preservation

- Source [PR #37](https://github.com/adamhbrown/Goat-Universe/pull/37): draft, open, unmerged at fresh inspection; head `3ff7010ece2d5e3b26f4ae94d67f692f986625ca`.
- [PR #38](https://github.com/adamhbrown/Goat-Universe/pull/38): draft, open, unmerged; `41a0a08c707ea748d5c0ad45ac33e051ffb864ad`. GitHub comparison and local Git establish it as an ancestor of #37, 143 commits ahead and zero behind.
- Main inspected: `3667f347f99415a61ec365ee0ad5ce9a2b3e08e5`. The candidate's unconditional migration hold is absent from both inspected main migration workflows. Main's dry-run guard names only one protected project; candidate policy protects four.
- Follow-up branch: `work/late-night-goatville-20261017`. Original branches, migrations, provider accounts and hosted databases are preserved. No production data query, message, hosted migration, merge, deployment, paid activation or model activation was performed.
- The user supplied Pope's fresh read-only review of the original PR #37 SHA: 366/366 tests. It is a baseline for that SHA, not a test claim for these later changes. No separate Kodak, Pope or Tiffany agents were spawned in this execution.

## Scoped changes

Existing scenes and creative assets remain the foundation. Arrival now leads directly to the city, with a second direct league-workspace route. Each of the five competition discovery panels on arrival and stadium links to its real `/games/<game-key>` route. The Explore menu distinguishes competition workspaces from fictional practice rooms and uses unique sequential destination numbers.

The city has a named central **GOATVERSE HOLDINGS INC.** headquarters tower/sign and a headquarters directory linking accounts, leagues, DSN, Publications and the private Bullpen boundary. Private workspaces have a direct return to the city. The seven districts remain distinct, with planned areas honestly labeled.

After the code/evidence commit, Adam supplied a cinematic waterfront city panorama in the conversation: central GOATVERSE HOLDINGS tower, GOAT Arena, DSN, Publications, League of Greatness, GOAT Tee Links, the mall and Mountain Goat Ski Lodge. This is the founder's visual reference, not a screenshot of the current candidate. The candidate still uses a simplified illustrated city; the supplied panorama is not embedded or included as a repository asset. Matching that visual target remains an explicit founder/design acceptance gap.

Adam explicitly approved revising public “GOATVILLE USA” wording to **Goatville**. Public text was updated; historical reports and original source branches were not rewritten. The five canonical competition names and their existing approved supporting slogans remain. No new competition rules or licensed founder films were invented.

A fixed **Goatville Standard Time (GST)** clock appears on all ten visitor parent pages and the league, member, player and Bullpen workspaces. It uses `America/New_York`, including automatic DST; `<time datetime>` stays UTC. Timestamp displays in competition/member/Bullpen views use GST. Schedule inputs retain their explicitly labeled browser timezone and convert to UTC; input conversion and scoring/deadline authority are unchanged. The visible clock follows the device clock, as its tooltip states; server UTC still controls deadlines. With JavaScript off, an honest timezone/enable-clock label is shown.

The only new backend routes are three exact, read-only clock/format assets, available even when public-site serving is disabled. Public serving remains an explicit allowlist, now 51 files. No repository directory serving or credential access was added.

## Route audit

| Route / district | Verified role and return path | Limits |
| --- | --- | --- |
| `/` | Cinematic arrival → city; five discovery panels → individual competition routes; shared Explore | Founder visual acceptance pending. |
| `goatville-city.html` | Named headquarters; all seven districts; league/account/editorial/private directory | Skyline is an illustration of the world. |
| Athletic / GOAT Stadium | `/games`, practice lab, Field Vision and Spotlight | Practice scores remain separate. |
| Campus / GOAT University | Playground arcade skill challenge | University/Academy/GOATometer are in development. |
| Culture / GOAT Radio & TV | Cinema and separate Publications site | Founder film rights/assets pending; external editorial content not certified. |
| Legends / The Vault | Arrival `#vault` | Historical archive completeness is not accepted. |
| Market | Same-page commercial vision | Planned; no checkout. |
| Commons | Mayor Billy's playground town square | Community/member product still in development. |
| Nightlife | Playground world section | Events and entertainment roadmap; no live-event claim. |
| `goatville-stadium.html` | Preserved stadium/competition showcase → all five workspaces | Official enrollment/release remains gated. |
| `play.html`, `resort.html` | Five practice hash routes; three resort views; shared Explore | Fictional practice and guest activity only. |
| `goatville.html`, `goat-games-play-lab.html` | Playground and five-sport practice lab; shared Explore | Not official league scoring. |
| Field Vision / Spotlight | Same-origin isolated guest challenges; shared Explore | Guest simulation, no official result import. |
| Cinema | Private local-file playback; shared Explore | Missing cleared founder films remain missing. |
| `/games`, five `/games/<key>` routes | Account, drafts and competition tools; direct city return | Create account, then sign in. Rules/schedules and official scoring approvals remain required. |
| `/manage`, `/play` | Member/commissioner and participant workspaces; city return | Memory-only sessions require sign-in after page changes/reload. |
| `/bullpen` | Sign-in shell; city return; API seat boundary | HTTP 200 shell grants no records or privileged role. |
| DSN / Publications | `/#dsn`, `/#media`; Publications separate tab | Public Publications HTTP 200 freshly observed; editorial links and the external site's full journey are not browser-certified. Close its tab to return. |

## Evidence board

| Category | Evidence and practical limit |
| --- | --- |
| Working in this integrated local candidate | See fresh final verification below: source/API tests, local browser layouts and real account/draft click journey. All evidence uses local synthetic test data. |
| Present, awaiting founder / device acceptance | Existing scenes; headquarters/signage; approved naming revision; GST; continuity and competition labels. The simplified city does not yet match Adam's supplied cinematic waterfront panorama. Automated Chromium emulation does not establish physical iPhone, Safari, VoiceOver or founder taste approval. |
| Blocked pending hosting/security/founder approval | Shared HTTPS host/origin/cost; hosted Auth/RLS/session revocation; hosted restore rehearsal; three extra migrations and frozen release artifact; official rules/scoring identities; cleared founder films; paid/model activation; final merge/deployment. |

## Security and recovery gates

| Gate | Decision / evidence |
| --- | --- |
| Original data and credentials | Local starter passes its own explicit configuration, binds `127.0.0.1`, uses `.local/one-universe`, and does not read hosted credentials or `.local/postgres`. Browser acceptance uses a temporary test database. |
| Email / payments / models | Local defaults off; health and authenticated checkout regressions verified. No model worker was launched. Offline Bullpen audit reports zero verified connections. Provider-account state was not inspected or changed. |
| Registration / private access | Ordinary registration yields no roles; Bullpen APIs require an explicitly bound seat. Anonymous/protected routes and ordinary-user denial are covered by the full suite and browser journey. |
| Auth, sessions and RLS | Local regression evidence only. Real hosted revocation, cross-account denial and RLS acceptance remain blocked. No authorization policy was changed in this follow-up. |
| Migration hold | Candidate hold intentionally exits 1 with `migration_execution_blocked_pending_review` before remote CLI setup/linking. Inspected main lacks it. No workflow was dispatched. |
| Migration integrity | Offline audit matches five anchored historical hashes and flags three additional migrations: `20261014153807_series_competitions.sql`, `20261014160000_fantasy_records.sql`, `20261014163651_championships_and_deadlines.sql`. Hosted application requires a separate reviewed scope. Payment SQL remains a proposal outside automatic migrations. |
| Backup / restore | Fresh local competition and Bullpen restore regressions run in the full suite. No hosted backup/restore or recovery-time objective is proven. |
| Publication boundary | Fresh `GET /repos/adamhbrown/Goat-Universe/pages`: `build_type=legacy`, `source.branch=main`, `source.path=/`, `https_enforced=true`. Main merges can publish. Branch protections and environment approvals remain unverified. |
| Official scoring | Existing local permission/lifecycle tests run; no practice result becomes official. Exact rules, schedules, sources, commissioner identities and audit/reversal procedure need review. |

## Final verification

The reviewed branch is `work/late-night-goatville-20261017`; its immutable commit is linked from the draft candidate PR. The checks below ran locally on this follow-up source, using Node.js **v24.19.0**, Python Playwright **1.62.0** and installed Chromium.

Code and browser-evidence commit: `37e4526270935cf6443ad8760acaef27dfb3bdae`. A subsequent documentation-only commit records Adam's panorama reference and the remaining visual gap; it does not change the tested application.

| Exact command | Outcome |
| --- | --- |
| `npm ci --ignore-scripts --cache /tmp/goatverse-npm-cache` | 40 pinned packages installed; manifest/lockfile unchanged. |
| `npm run test:universe` | **370 passed; 0 failed, cancelled or skipped; 64.480 seconds**. Includes local HTTP/persistence, role/seat denial, session, competition/Bullpen restore, GST/DST, modal clock and public-site-off asset regressions. |
| `npm run check`; `npm run check:bullpen`; new shared JS syntax checks; `git diff --check` | Pass. |
| `python tests/browser-one-universe.py --output-dir docs/late-night-qa` | Pass: **52 layout checks**, 20 entry-route HTTP checks, all parent-page navigation/fragments, eight dynamic hash routes, keyboard dialog/focus, modal clock, touch-emulated account/draft persistence and Bullpen denial, and no-JavaScript city links. No unexpected page errors or HTTP failures. |
| `python tests/browser-visitor-acceptance.py --suite goatville` | Actual starter health: local development, email/payments off. Inherited arrival/sports suite: **72 layouts, 27 interaction groups**, no page errors. |
| `python tests/browser-resort.py --base-url http://127.0.0.1:8787 --output-dir docs/late-night-qa/visitor/resort` | Run by the same starter wrapper's first combined execution: **120 layouts, 19 interaction groups**, no page errors. Includes Sports IQ, discovery, passport/keepsake downloads, optional theme, no-JavaScript and CSP checks. |
| `node backend/scripts/validate-migration-hold.mjs` | Expected exit **1**: `migration_execution_blocked_pending_review`. Protective refusal, not a failed release check to bypass. |
| `node backend/scripts/check-bullpen-integration.mjs` | Expected exit **2**: `blocked_pending_approval_and_hosted_acceptance`; five anchored hashes match, three extra migrations need review, combined deployment artifact remains not frozen, connections verified = 0. |

The resort and arrival browser suites used the actual starter in one execution namespace, then stopped it. The integration click journey used a temporary database which was removed after testing. No synthetic account/draft was written to the founder's persistent database by that harness. A final visual check moved the tower sign above the foreground city title and captured the corrected mobile/desktop skyline; this was an illustration-position adjustment only.

Encountered and resolved: the default npm cache was unwritable, so installation used `/tmp`; the route harness initially treated supported hash routes as ordinary fragments; account assertions were corrected to follow the existing explicit sign-in step and actual Bullpen denial message; the inherited audio wait was changed to a function because string evaluation was blocked by CSP. No application CSP was relaxed. Earlier incomplete/failing harness attempts are not counted as passes. **No outstanding automated failures remain.**

Primary artifacts: [integration browser report](late-night-qa/browser-report.json), [arrival/sports report](late-night-qa/visitor/goatville/browser-report.json), [resort report](late-night-qa/visitor/resort/resort-browser-report.json), [actual starter health](late-night-qa/starter-and-visitor-report.json), [offline gate](late-night-qa/offline-gate.json), [verification summary](late-night-qa/verification.json).

Screenshots: [arrival, mobile](late-night-qa/arrival-390.png), [arrival, desktop](late-night-qa/arrival-1440.png), [headquarters, mobile](late-night-qa/city-390.png), [headquarters, desktop](late-night-qa/city-1440.png), [tower, mobile](late-night-qa/city-skyline-390.png), [tower, desktop](late-night-qa/city-skyline-1440.png), [local draft](late-night-qa/local-draft-390.png), [Bullpen shell](late-night-qa/bullpen-390.png). Additional practice/result screenshots are in the visitor subdirectories. No video recording was made.

Browser emulation includes 320/390/768/1440 widths in the integration harness and twelve portrait/landscape/tablet/desktop sizes in the inherited suites. This is real Chromium rendering with simulated viewport/touch, not a physical iPhone, Safari, VoiceOver, full WCAG audit or hosted acceptance.

## Next approvals

1. Founder accepts or annotates this local journey and its visual labels. Naming revision is already authorized.
2. Engineering reviews the three additional migrations, chooses/freeze-checks the exact release artifact, and prepares a specific HTTPS host/origin/cost, secrets and rollback proposal. Preserve the hold.
3. Separate explicit CEO approvals are needed later for the named infrastructure/cost, any provider or migration change, exact privileged seat bindings, paid/model activation, and eventual merge/deployment. None is requested by this evidence report.
