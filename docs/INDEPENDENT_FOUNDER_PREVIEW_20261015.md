# Independent founder preview and recovery evidence — October 15, 2026

This infrastructure branch is stacked on PR #27 (`a5d97b011a0c0c914c7c3290bfe9ef7e4bf994c5`). It does not merge PRs, edit creative branches, change scoring or touch a provider. The visitor source tested is PR #16 at `fcb6019358ff13eb2426368186eef040cd49d9ba`; this is a named snapshot, not a claim to include every team's latest work.

## Delivered behavior

`prepare-founder-preview.mjs` produces a **new**, explicit eight-file public export of the four visitor pages, two local font files and two font licenses. It records source hashes and only replaces the three recognized Google Fonts imports with bundled font faces. No source file is modified. Other missing files, unknown remote active dependencies, broken detected links or existing output paths fail closed. The preview is a derivative for review; typography still needs visual approval.

The exact creative snapshot initially failed the security export gate because three attraction pages imported remote font CSS and the broad selection included a developer README. The recipe preserves the font licenses, excludes that README and removes those three runtime font requests. It does not silently download missing music, films or other media.

`preview-release.mjs` inspects HTML src/href/poster/data/srcset, styles/CSS url/import references, literal JS imports/exports/fetch/Worker/new URL references and navigation fragments across exported HTML. It verifies hashes first, never loads URLs or runs scripts, inventories external navigation origins and detects root-relative path failures under a hosting prefix. It is a bounded static scanner, not a JS bundler: computed URLs, uncommon syntax, runtime DOM changes, import maps and browser behavior require separate review/network tests. Passing means only the documented detected references passed.

`portable-preview.mjs` and `scripts/serve-preview-bundle.mjs` run with **Node 22+ and no installed packages**. They require a trusted manifest digest, verify the exact public file set/security gate/hashes, load verified bytes into memory, bind through the CLI only to `127.0.0.1`, and serve GET/HEAD with correct MIME, no-store and nosniff. Private files, encoded path aliases, traversal and foreign Host headers are denied. It has no Auth/RPC/database route, request-body logger, directory listing or repository-root serving. It is a local preview server, not a production host; video range requests, TLS, production CSP and public-host operations are outside its scope.

`scripts/verify-founder-interactions.mjs` executes **trusted, reviewed** preview inline code in JSDOM and drives the actual forms/buttons. JSDOM is not a security sandbox. Do not run it against an unreviewed bundle merely because its self-supplied hashes agree. It does not enable external resource loading and is not real browser acceptance.

The existing artifact gate now accepts MP3/OGG/WAV payloads under its unchanged media/aggregate budgets. These formats have byte-preservation coverage. No audio/video asset was present in the tested creative snapshot; none is claimed in this export. Existing 4 MiB per-media/12 MiB total budgets reject oversized releases rather than omit files. Review a separate streaming/storage design for larger film/music assets.

## Reproduce from frozen source

From the infrastructure checkout, with its existing pinned development dependencies installed:

```sh
npm ci --ignore-scripts
# Supply a frozen source checkout/export of the reviewed creative SHA above.
node backend/scripts/prepare-founder-preview.mjs /absolute/creative-source /absolute/new-public-output
node backend/scripts/preview-static-release.mjs check /absolute/new-public-output TRUSTED_MANIFEST_SHA256 /
node backend/scripts/preview-static-release.mjs check /absolute/new-public-output TRUSTED_MANIFEST_SHA256 /Goat-Universe/
node backend/scripts/verify-founder-interactions.mjs /absolute/new-public-output TRUSTED_MANIFEST_SHA256
node backend/scripts/serve-preview-bundle.mjs /absolute/new-public-output TRUSTED_MANIFEST_SHA256
```

The source snapshot can be exported read-only with `git archive` for exactly `index.html`, `goatville.html`, `goatville-city.html`, `goat-games-play-lab.html` and `assets/fonts`. The recipe selects only its eight explicit files. It rejects output within source and preserves any existing output. Protect the source checkout against concurrent mutation.

For a portable folder, put the resulting release at `public/`; copy `backend/{portable-preview,static-release,static-artifact}.mjs` to `tools/`, and `backend/scripts/serve-preview-bundle.mjs` to `tools/scripts/`. Include the reviewed report/README **outside public/**. From that folder run:

```sh
node tools/scripts/serve-preview-bundle.mjs public f5e3dc4068d248d70447a93fdedcee7c045149c2607e15fe51341602d4a900e0
```

Append `/Goat-Universe/` for a subpath. Open the printed loopback URL. Stop with Ctrl+C. The checksum must match a separately trusted release record; adjacent hashes are not signatures. The ZIP/tools/report are private delivery materials; only the reviewed `public/` subtree could be a future static-host payload after authorization. A loopback URL on a desktop cannot be opened on Adam's separate iPhone.

## Measured artifact and checks

- Public payload: **8 files / 284,651 bytes**; four actual visitor pages, local fonts/licenses.
- Public manifest SHA-256: `f5e3dc4068d248d70447a93fdedcee7c045149c2607e15fe51341602d4a900e0`.
- Delivered ZIP: `GOAT-Founder-Preview-20261015.zip`, 201,114 bytes; SHA-256 `0fb4b318b69b7060cd3a6ccd12425107d35e26e0f28725a202ab846ec15514a3`.
- Root and `/Goat-Universe/`: **84 detected references each**, zero detected missing local targets/anchors. Publications remains external navigation; reachability was not reverified here.
- Extracted the ZIP into a fresh directory, reverified the manifest, and served all eight restored payloads at both prefixes with correct byte counts; private backend route returned 404. Portable runner starts outside the repo with no node_modules.
- Simulated interactions passed on the extracted artifact at both prefixes: all five practice challenges and reset, trivia 6/6, golf 300/300, guest passport completion/clear, Mayor response. These are fictional practice attractions, **not official league registration or results**.
- Infrastructure suite: **99/99 passed**, zero failed/skipped, concurrency=2. Ten new tests cover missing assets, modules, anchors, source preservation, package determinism, HTTP/private boundaries, audio bytes and standalone runner startup. Syntax and whitespace checks passed.
- PR #13 at `fc8b02cae0124f11e81bea1295f3ac57a23b3ee7`: **122/122 local tests passed**, concurrency=1, in a separate detached worktree. Includes entry/commissioner permissions, deadline locks, game isolation, scoring/corrections, private views, championship archives and sourced policy gates. It is not combined with this static preview or proven hosted.
- PR #30 at `f06247c60d6112902ae2f3b0c7af56ca7a5d64a2`: local private Bullpen dump/restore test **1/1 passed** in a separate detached worktree, checking all six private tables/bindings/audit/denials. The full PR #30 suite was not rerun here.
- No failing checks in these final runs. A deliberately incomplete/remote-font exact export was blocked as intended. The previously reported intermittent PR #28 local bracket transport failure remains unexplained; these passing runs do not establish its cause.
- Chromium remains absent in this runtime. No real-browser, iPhone/Safari, layout, screen-reader, CSP or hosted acceptance claim is made.

## Provider independence and recovery boundaries

| Component | Demonstrated now | Remaining work before real service |
|---|---|---|
| Static visitor frontend | Complete selected artifact, local fonts, root/subpath HTTP, ZIP restoration and hashes | Founder visual acceptance, real mobile/browser/network QA; approved host/origin and release review |
| Node application | Existing source/scripts remain portable development code; PR #13 local tests pass | Reviewed combined Node candidate with hosting/session safeguards; HTTPS host, monitoring, log redaction, limits and costs approved |
| PostgreSQL data | Existing competition snapshot/audit restore test passes in the 99-test suite; Bullpen private restore independently passes | These are local PGlite/WASM archives, **not native PostgreSQL pg_dump backups**. Obtain authorized native schema/data/roles/extensions backup, encrypted off-provider copy and isolated version-compatible restore evidence; include grants/RLS/functions/sequences and Auth dependencies |
| Media/storage | Included public files hashed and restored; known audio types supported within budgets | Inventory actual bucket objects, checksums, metadata, access rules and signed-URL behavior; no hosted object export/recovery verified. Do not present static frontend delivery as a substitute for managed storage |
| Auth/membership | Dedicated account/session guards exercised locally in competition tests | Do not copy tokens or assume password-hash portability. Review identity UUID mapping, provider/hash compatibility, confirmation/MFA/OAuth and reset flows, consent and revocation. Force appropriate reauthentication; keep role/seat bindings and audit provenance. Never put identities/sessions/private dumps in public export |
| Secrets/config | Preview requires none; private Node configuration stays out of export | Approved runtime secret store, least-privilege credentials, access review, rotation and encrypted backups; no secret provisioning performed |
| Provider failure | Visitor artifact restored and served independently on loopback | Verified off-provider native database/object backups, approved replacement host, recovery time/data-loss targets, isolated restore, access-denial tests, DNS/cutover/rollback rehearsal and CEO authorization |

A restore command in documentation is not recovery evidence. The public artifact and local development database rehearsals above are the evidence we have; no claim of original hosted project recovery, complete production backups or native Postgres compatibility follows.

## Current infrastructure observations

A fresh read-only inventory during this sprint still returns exactly the four preserved projects: Goat-Universe `opvoemihfyxidzbdyory` us-east-1 **COMING_UP**, and the other three **INACTIVE**. Proposed independent staging is absent. No database query, data export, reset, restore, migration, project change, token change, consent change or new support email occurred here.

Project initialization, earlier Storage migration timeouts, earlier Realtime failures, possible management-token expiration and application deployment readiness remain distinct tracks. The inventory does not diagnose the initialization failure or token 401. Ticket SU-507996 was previously escalated; no new technical response was reviewed during this sprint. No approved independent shared host/origin or free capacity is demonstrated here.

## Integration handoff and next sequence

1. Kodak identifies the exact integrated creative SHA. Run the recipe and both path audits against that snapshot; do not call this PR #16 snapshot the combined latest platform. For additional assets, extend an explicit reviewed selection/recipe; never glob the repo or weaken the private-file gate.
2. Founder reviews the delivered local experience. Keep official five-league registration distinct from fictional attraction challenges. The static visitor export does not expose the private Node competition application or Bullpen.
3. Run real desktop/iPhone/Safari and keyboard/reduced-motion acceptance, inspect the runtime network log for computed/missing assets, and review local passport privacy/consent behavior before public release.
4. For a shared preview URL, present Adam the **exact** host/owner/capacity/cost, payload digest, origin and protection/publicity settings. Obtain target-specific deployment authorization. No existing hosting authorization was inferred and no preview was published.
5. Separately integrate application PR #13, Bullpen #11/#30 and account/session/host safeguards under the application integration owner's review. Reconcile overlapping server.mjs, package.json and CI edits; review exact migrations. No self-merge or migration here.
6. Hosted accounts/official entries/private Bullpen require healthy approved infrastructure, protected config, identities, founder binding and hosted denial/revocation/persistence/recovery acceptance. Missing AI clients remain disconnected. Do not share Adam's identity or infer a live bridge between ChatGPT conversations.

Estimated remaining work: roughly 1–3 engineering hours to rebuild/review a supplied integrated creative snapshot and perform desktop browser checks; real iPhone testing depends on device/tester availability. A shared static URL needs an approved host and publication decision before an estimate is reliable. Native database/object recovery and full hosted application acceptance need access, target-specific authorization and a separate measured rehearsal; the local static preview does not unblock those automatically. No approval is needed to review this draft or run the local preview; merge/deployment/provider changes still require CEO approval.
