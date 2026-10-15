# GOATVILLE City Atlas — Integration Handoff
**Owner:** Tiffany / frontend creative  
**Date:** 2026-10-15  
**Review branch:** `work/tiffany-city-wayfinding-20261015`  
**Draft pull request:** #29, stacked on #26 (and earlier creative PRs).

## Delivered interface

- `goatville-city.html` includes one visual map with seven **native button** destinations and one live district detail panel.
- `experience/city-atlas.css` provides the original SVG-supported illustrated map, responsive pin positions, clear selected/focus states, and reduced-motion support.
- `experience/city-atlas.js` selects a district, updates panel text using `textContent`, exposes `aria-pressed`, supports Arrow/Home/End navigation, and changes only local relative links.
- All seven district cards retain their existing identity and content and now have stable IDs: `district-athletic`, `district-campus`, `district-culture`, `district-legends`, `district-market`, `district-commons`, `district-afterdark`.
- `tests/goatville-city-atlas.test.mjs` covers all seven points, keyboard selection, route preservation, direct-link availability, and non-persistence.
- GitHub Actions `GOATVILLE isolated creative checks` runs the map tests and existing creative suites on pull request revisions.

## Frontend event/element contract

| Selector / element | Behavior |
|---|---|
| `[data-map-point]` | Approved district IDs only: athletic, campus, culture, legends, market, commons, afterdark |
| `aria-pressed` | Exactly one selected map pin; one button has `tabindex=0` |
| `#map-detail-title` | Human-readable name, announced politely on selection |
| `#map-detail-status` | Readiness marker; not evidence of a live official tournament |
| `#map-detail-description` | Static, vetted editorial text; inserted as plain text |
| `#map-detail-route` | In-page anchor to a real existing district article |
| `#map-detail-direct` | Only visible for reviewed, functional destination routes: Athletic -> `goat-games-play-lab.html`; Culture -> `goatville-cinema.html`. Hidden and href removed for unfinished districts |
| `[data-filter=all]` | The map invokes this existing button before anchor navigation, so a filtered-out district cannot stay hidden |

The map is intentionally **a fictional illustrated city**. It does not use coordinates, geolocation, real-world facility claims, a map provider, account state, or network requests.

## Handoff to Kodak — visitor experience

- Preserve the native map buttons and labels; the illustration is marked decorative for assistive technology.
- Review mobile tap-target spacing at 320, 390, and 430 CSS-pixel widths, with extra attention to center Stadium pin.
- Test map selection + district card links when the existing city filters are active.
- Refine illustration and nighttime lighting without replacing meaningful text with inaccessible picture-only hotspots.
- No automatic cinematic soundtrack or mandatory intro.

## Handoff to Pope — security and platform

- There is no authenticated or recreational API dependency for the map.
- The only executable additions are one reviewed, first-party deferred JS file and one CSS file.
- District statuses are hardcoded editorial labels, not official registration, ranking, checkout or achievement authority.
- Keep guest-game sandbox and authenticated competition boundaries unchanged.
- Continue independent Supabase recovery and staging work without coupling it to City Atlas.

## QA and release gates

Automated checks are source and simulated-DOM checks; they **do not constitute visual Chrome/Safari/VoiceOver acceptance**. Verify those manually and retest after any combined branch integration.

No production `main` changes, payments, hosted commercial media, database migrations, or new provider resources are authorized by this handoff.
