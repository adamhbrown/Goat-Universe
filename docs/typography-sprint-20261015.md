# GOAT Universe — typography review, 2026-10-15

Review branch: `work/kodak-luxury-typography-20261015`.
Baseline: Tiffany's `work/tiffany-goat-games-homepage-20261014` at
`b794a151c32587d9fa2a245543131f5758fe351f` (draft PR #12).
The initial snapshot was `1c1234b`; Tiffany's concurrent typography refinement was
retained before layering this pass on top.
This branch targets Tiffany's branch. No merge or production deployment is authorized.

## Changes

- Manrope headlines/navigation and Inter body/controls, bundled locally with OFL
  licenses. Removed external font requests and condensed font fallbacks.
- Restored the requested opening sequence: GOAT UNIVERSE PRESENTS; THE GOAT
  GAMES; WHERE THE / GOATS PLAY. The two tagline lines are explicit, balanced
  spans. Added the approved supporting sentence and DISCOVER THE GOAT GAMES CTA.
- More deliberate weights, tracking, line heights and section spacing throughout
  the existing homepage; body copy is 16px. Supporting metadata remains smaller.
- Grid subrows align adjacent cards' title, subtitle, copy and links. Traditional
  grid rows provide a fallback; single-column mobile cards use natural heights.
- More space in native disclosure summaries and bodies; visible summary keyboard
  focus; 44px GOAT Mode and link controls. Preserved safe areas and reduced motion.
- Gold/black/white identity, numbered cards, contrasting backgrounds, page sections,
  navigation, disclosures and GOAT Mode's existing behavior are retained.

No game engines, Supabase, production configuration, payment services, publications
destination or competition rules were changed.

## Verification performed on the final design

- `node --test tests/goat-games-homepage.test.mjs`: passed. This runtime's isolated
  reporter groups the suite as one file. `node tests/goat-games-homepage.test.mjs`
  separately reports **10 assertions, 10 passed, 0 failed**.
- `git diff --check`: passed.
- Real headless Chromium checked 320×568, 375×667, 390×844, 430×932, 667×375,
  844×390, 932×430, 768×1024, 900×900, 1024×768, 1200×900 and 1440×1000.
- Both bundled fonts loaded. No document horizontal overflow, visible text
  overflow or text clipping was detected at those sizes. Adjacent card content
  rows were measured to align within 1px. Each hero tagline span measured one line.
- All five card links opened the correct disclosure at every size. GOAT Mode
  switched on/off with the correct `aria-pressed` state at every size.
- Keyboard skip link/Enter, GOAT Mode/Enter, disclosure/Space and reduced-motion
  behavior passed. No JavaScript page errors occurred.
- Screenshots were inspected for iPhone portrait, landscape cards, opened
  description panels, desktop hero and desktop cards.

These are responsive Chromium checks, not a physical iPhone Safari or VoiceOver
test. Safari/WebKit is unavailable in this runtime. The repository's existing CI
workflow concerns Supabase migrations and was not run for this website-only sprint.

## Founder preview

The draft PR and committed branch are the review source. A browser preview uses
the public HTML Preview viewer against the committed HTML and bundled assets.
It is a review preview, not the production website. Preview load verification and
the exact committed URL are reported with the final handoff.

CEO approval remains required before merge or production deployment.
