# Operation GOATVILLE — engineering handoff

2026-10-15. Development review only. Nothing merged or deployed.

Draft PR: https://github.com/adamhbrown/Goat-Universe/pull/22
Branch: `work/kodak-operation-goatville-20261015`.

Started from the requested `f25b780` design. The review history was then based on
the amended typography baseline `b4987c2`, preserving its fixes and avoiding a
history conflict. Tiffany's [PR #16](https://github.com/adamhbrown/Goat-Universe/pull/16)
and branch are untouched. Pope's backend and infrastructure are untouched.

## Implemented

| Destination | Working mechanics |
|---|---|
| 1st & BAA | Four fictional ATS picks, confidence rank swaps, scouting reveals, practice outcomes and an additional playoff bracket simulator |
| Horns & Hoops | Eight-team exhibition bracket, progressive round access, upset count, downstream invalidation, projected champion and reset |
| GOAT Crossover | Four fictional basketball/hockey series, winner and 4–7 game predictions, combined card and reset |
| League of Greatness | Five starter decisions, projections, deterministic win/tie/loss matchup, preset franchise identity, trophy-gallery concept and integration path |
| The GOAT Classic | Eight-team exhibition postseason, seven series winners/lengths, 3–5 and 4–7 game validation, dependent reset and projected championship |
| GOAT TEE | Three physics courses, tap/slider aim, power, rail/rock collisions, sand, scorecard, 10-putt unfinished-hole handling and replay |

All five sports rooms use explicitly fictional data. They are functioning practice
prototypes, not the full official tournament formats or authenticated competition
engines. No real entries, results, wagers, prizes or official awards are generated.

The homepage now provides a founder-supplied monumental entrance, an original
interactive town map with six destination routes, direct Arcade launch links, a
GOATVILLE district directory grounded in the Master Book and supplied references,
Mayor Billy GOAT/DJ BAAA/Captain GOAT/Powder GOAT introductions, and clearly labeled
working attractions versus world concepts. Existing five Games explanations,
native disclosures, publication URLs and GOAT Mode are preserved.

The optional 8-second arrival supports immediate entry/close, Escape/focus return,
replay, reduced motion, opt-in sound and optional video fallback. CLUB GOAT has the
founder-supplied **GOATUNIVERSE — Official Theme**, a full native audio player and a
direct audio link. There is no page-load audio request or forced sound. The 96 kbps
web derivative is under 4 MiB; the original attachment is retained outside the repo.

The passport starts in memory, accesses storage only after opt-in and requires
fresh opt-in after reload before restoring saved records. Saved records are
bounded, schema-checked and literally `local-unverified`; blocked/corrupt storage
falls back to memory. Clearing removes opted-in saved data and turns saving off.
The GPI lab uses illustrative inputs and weights; the official Baa Board remains
empty pending verified data. See [experience-design notes](goatville-experience-design.md).

## Verification on the final application files

- **27 source/engine tests passed:** 10 existing homepage regressions, 9 sports
  model tests and 8 golf physics tests. `node --test tests/*.test.*` passes all three
  test files; direct execution reports the 27 individual tests.
- **72 Chromium layout checks passed:** homepage plus all five rooms at 320×568,
  375×667, 390×844, 430×932, 667×375, 844×390, 932×430, 768×1024, 900×900,
  1024×768, 1200×900 and 1440×1000. Fonts loaded, no document overflow, no broken
  images and no clipped headings/choice controls detected.
- **27 browser interaction groups passed:** full five-room rounds at 390 and
  1440 widths, validation, bracket invalidation, confidence swaps, passport opt-in,
  memory-only reload, explicit restore, clear, GPI controls, keyboard tabs/history,
  full six-putt golf rounds and replay, reduced/normal motion, official-theme
  playback/pause, cinema skip/Escape, unavailable-video fallback, blocked storage
  and JavaScript-disabled navigation/native disclosures. Zero uncaught page errors.
- Screenshots inspected for phone entrance, architectural desktop entrance,
  football rooms, basketball/fantasy layout and completed golf. Selected evidence
  is in [goatville-qa](goatville-qa/); machine results are in
  [browser-report.json](goatville-qa/browser-report.json).
- `git diff --check` passed. Local allowlisted export passed the proposed budget:
  **20 public files, 4,642,403 bytes total, 224,744 HTML/CSS/JS bytes**. It excludes
  backend, Git, tests, docs and operational files. This is packaging validation,
  not a measured Core Web Vitals result or permission to deploy.

These are real headless **Chromium** results, including touch/mobile emulation.
Physical iPhone Safari, WebKit and VoiceOver were not available and are not claimed.
Supabase workflows and production checks were not run.

Earlier runs found and corrected a keyboard-tab focus bug and exposed a brittle
JavaScript-disabled fallback. The final fallback is ordinary visible HTML hidden
only after successful initialization; Play remains disabled if golf cannot load.
The final acceptance run has no known failing check. The intentionally missing
optional-video request tests error recovery and is not a production asset reference.

## Reproduce and review

```sh
node --test tests/*.test.*
node scripts/export-goatville.mjs
python tests/browser-goatville.py
```

The optional browser suite needs installed Python Playwright and Chromium. It
creates its own temporary, loopback-only server containing public files, runs the
checks, then shuts it down. It does not require a deployment, backend or account.
The export command prints a fresh `/tmp/goatville-export-*` directory. To manually
serve that export, bind a static server to loopback and stop it after inspection.

Exact immutable preview URLs and actual load verification are recorded in PR #22
and the final handoff after the last push. Third-party source previews are review
surfaces, not production deployments.

## Outstanding work, in priority order

1. Review this proposal with Tiffany's #16; select one arrival, golf implementation,
   route scheme and passport contract before integration. No branches were combined.
2. Run real iPhone Safari/VoiceOver and slow-network acceptance; measure the actual
   intended release origin and caching/media behavior.
3. Jointly review Pope's strict catalog/opaque iframe host. These first-party rooms
   are not yet integrated into it. Choose separate child entry files, lazy mount,
   teardown, focus return, exact message validation and actual CSP response headers
   on a recreational origin. Never connect souvenirs to official award authority.
4. Obtain the named founder film files: Can't Stop The Baa, Magic Movie 5 and Goat
   Country. Confirm commercial rights, captions and optimized delivery for supplied
   media. The theme's founder designation is recorded; independent commercial
   clearance is not documented. No missing films are represented as integrated.
5. Implement approved real formats, schedules, scoring, authentication and league
   data through Pope's separately reviewed infrastructure. Verified championships,
   shared rankings, cross-device identity and valuable achievements remain backend
   work; no browser prototype should be promoted into an official ledger.
6. Keep University, GOAT Kids campus, Market and other shell districts as world
   concepts until their actual experiences are built. No storefront or purchases
   were activated. Commercial and production release remain separate decisions.
