# GOATVILLE USA — Playable World Sprint Handoff
Date: 2026-10-15
Branch: work/goatville-playground-20261015
Status: Draft implementation; not merged or deployed

## Founder-approved direction
GOAT Universe is an actual digital sports-entertainment **theme park**, not a promotional brochure.
**WHERE THE GOATS PLAY** must be an actionable product promise. Exclusive appearance; inclusive experience.
GOAT Universe is the parent; The GOAT Games are five flagship events; DSN handles sports competitions/media; GOATverse Publications holds editorial stories; GOATVILLE USA is the visitor-facing interactive digital town.

## Implemented
1. **goatville.html** — a new standalone, self-contained GOATVILLE entrance with a golden gateway, six linked destinations, Town Square, Story District, GOAT Games gateway, GOAT Arcade, GOAT TEE and passport office. Uses Manrope/Inter, black/white/gold identity, keyboard-supported tabs, mobile-responsive styles and reduced-motion settings.
2. **GOAT IQ** — a functioning six-question sports trivia game with inline responses, score, progress indication, and replay.
3. **GOAT TEE** — a fictional three-hole arcade golf precision challenge with aim, target power, breeze, ball movement, arcade points, replay and completion.
4. **GOATVILLE Passport** — three collectible stamps for exploration and completing each arcade challenge; localStorage persistence with blocked-storage fallback and a clear control. No account or server data used. No personal information collected.
5. **index.html** — an added GOATVILLE entrance portal, hero link, desktop navigation link and mobile Play link. Existing five GOAT Games information architecture remains intact.
6. **tests/goatville-playground.test.mjs** — regression contract for page routing, links, gameplay scripts, accessibility, and privacy boundaries.

## Verification
- Existing 10 homepage source tests evaluated successfully by isolated JavaScript test harness.
- GOATVILLE 10 source tests evaluated by isolated JavaScript test harness; one copy-label expectation adjusted.
- Inline scripts parse without syntax errors; internal anchors resolve and IDs are unique.
- In-memory DOM interaction simulation completed 14 checks, including perfect six-question trivia run, three accurate golf shots, final score 300/300, local stamp persistence and clearing.
- **NOT YET VERIFIED** in real Safari/Chrome on iPhone, by browser automation, or via third-party HTML preview. Developer must visually verify portrait and landscape sizes and tab focus.
- This branch has not been deployed to GitHub Pages. Current production remains unchanged.

## Next engineering collaboration
**Kodak**: Own themed world visual direction, performances/transitions, premium assets, real-browser mobile QA and modular attraction design. Coordinate by PR; don't overwrite this branch. Favor genuinely playable content over conceptual "coming soon" pages.
**Pope**: Own non-destructive accessibility, security, build/deploy workflow, tests and eventual modular backend architecture. Separate minigames must never mutate official league scoring or real player data. Keep Supabase recovery independent and preserve current data.
**Tiffany**: Own editorial/creative identity, go/no-go visual reviews, cross-attraction narrative, and integrating approved UI concepts.

## Acceptance criteria for production consideration
- Founder's signoff on creative experience and mobile screenshots.
- Functional browser tests for the two games and passport on iOS Safari and Android Chrome, with tab controls and focus order.
- Verify font-loading fallback, contrast, touch targets, performance, motion preferences and no content clipping.
- Resolve external preview link behavior and test navigation from deployed HTML at a staging origin.
- Privacy review of local storage and clear-data operation.
- No active signup, store, payments or official standings until separately tested and authorized.
- Explicit CEO approval required before merge or production deployment.

## Product safeguards
Arcade points are recreational and unrelated to the official GOAT Games.
No artificial champions, prize commitments or fabricated live scores.
The town is digital and fictional, not a real amusement park.
No external analytics, networked game data, backend writes, transactions, or Supabase connection introduced.
