# GOATVILLE experience mechanics

Development prototypes, 2026-10-15. No official competition rules, entries or results
are changed. Original code and presentation are reviewable assets; ordinary sports
rules, weighted averages, brackets, game physics and other generic ideas are not
claimed as exclusively ownable.

## Implemented interaction systems

**Confidence Ladder — football war room.** Four fictional ATS decisions pair with
an always-valid permutation of ranks 1–4. Choosing an occupied rank swaps the two
assignments, keeping the visitor's hierarchy intact. A deliberate reveal resolves
fixed fictional finals against the displayed spreads and produces a 0–10 practice
card. No stakes, real odds, live results or official points are involved. A separate
8-team exhibition bracket provides an additional playoff exploration surface.

**Crown Path — basketball bracket lounge.** Seven winner decisions progressively
unlock a condensed 8-team exhibition. Choosing a higher-numbered seed increments
an upset counter. Changing an earlier participant clears each downstream match on
that branch, even if the previous winner remains eligible. The other branch is
preserved. A deliberate championship reveal finishes the local challenge.

**Twin Arena Card — GOAT Crossover.** Four independent fictional best-of-seven
series, two basketball and two hockey, combine winner and series-length calls into
a single visual prediction card. Incomplete cards cannot be revealed. The card
records predictions, not claimed outcomes or an official combined scoring system.

**Clubhouse Decisions — League of Greatness.** Five starter choices each present two
fictional athletes with contrasting profiles and illustrative projections. A local
matchup reveal uses fixed demonstration performances, producing a win, tie or loss
based on those choices. Preset franchise identities change the clubhouse name.
The trophy gallery is explicitly a presentation concept; no titles are awarded.
The read-only integration path is described without enabling accounts or imports.

**October Path — GOAT Classic.** The same dependency-aware bracket engine supports
seven series predictions. Division-round series allow 3–5 games; later rounds allow
4–7. Both the winner and series length are required. Changes clear affected
predictions and lengths together. The championship card shows the visitor's
projected clubs and total games, not real postseason outcomes.

**GOAT TEE.** Three original courses use deterministic 120 Hz simulation, 8-unit ball
radius, wall/rock collisions, constant rolling friction and stronger sand friction.
Aim works with a native range control or tap-to-aim; power has a separate native
range. The game has no timer. Reduced motion resolves the same shot immediately.
A missed 10-putt hole is marked unfinished with an asterisk. The final scorecard
reports cups sunk honestly, then offers replay. No storage, rewards or official
scoring is used for golf.

**GOATVILLE Passport.** A shared first-party journal now connects the five sports
rooms, six Night Circuit discovery stops and Sports IQ (12 permitted stamps).
`assets/guest-passport.js` exposes a memory-first `createJournal(getStorage)` API.
Only `remember(true)` acquires storage. Version 2 uses
`goatville-kodak-guest-journal-v2`, literal `local-unverified`, exact schema fields,
a 4 KiB read bound, unique catalog IDs and three preset franchise identities.
Each page/reload requires explicit opt-in again before restoration. The older v1
sports-only key is not silently migrated. Opt-out deletes the opted-in saved copy;
clear also resets current memory and identity. No account, official award or ledger
is connected. Cross-tab concurrent reconciliation remains future work.

**The Night Circuit.** Six district dossiers pair a readable lore clue with three
answer choices. Wrong answers allow another attempt; correct answers collect one
unverified discovery souvenir. Island and Lodge remain explicitly world previews:
the clue works, but no underlying resort/ski attraction is claimed.

**Sports IQ / Six-Sport Switch.** Each replay draws one of four original rule
prompts for football, basketball, hockey, baseball, golf and fictional-format
fantasy (24 prompts, six per round). Answers lock immediately, passing counts as
incorrect, and the result includes all six explanations. There is no timer or real
athlete/result data. The phone play view compacts the header and answered options.

**Practice keepsakes.** Each sports result can download a portable self-contained
SVG or copy plain text with a manual-copy fallback. Cards escape dynamic XML,
carry fictional/local-unverified labels, and make no network request. Round-jump
controls and preserved bracket scroll position keep mobile selections in place.

**GPI lab.** Three sliders expose the effect of an illustrative blend: form 40%,
moment 35%, resolve 25%. The lab is labeled fictional and is separate from the
unpublished official GOAT Power Index methodology. No real athlete receives a
rating. The Baa Board continues to await verified data and has no invented ranks.

## Cinematic media component

`GoatCinema` in `assets/cinematic-media.js` initializes each `[data-cinematic]`
container. The homepage is usable immediately; an explicit visitor action opens
the optional 8-second arrival study. Close, Escape, immediate entry and replay are
available. Sound is off by default. The optional soundtrack is the founder-supplied **GOATUNIVERSE**, designated the
official theme by the founder. Its source is assigned only after a sound/play
action. CLUB GOAT also has a full native audio player. A synthesized cue remains
available as a component fallback when no theme player is installed.

Reduced motion presents a still arrival. Leaving the tab pauses the experience.
Missing media or failed playback retains the original visual study and entry.
The dialog restores focus on close and targets the world guide on entry.

For a verified video, set `data-video-src` and optional `data-captions-src` before
initialization. Use short, optimized, captioned assets; supply a poster. The native
video uses `playsinline`, `muted`, `preload="none"` and controls. The component caps
an entrance segment at 15 seconds (default 8). Test the exact file on Safari before
release. No founder video is included. The supplied theme has a 96 kbps AAC-LC, audio-only fast-start MP4 derivative
under the proposed 4 MiB media budget, with embedded cover art and metadata removed.
The founder’s designation is recorded; commercial clearance is not independently
documented and remains a release item.
`assets/goatville/media-manifest.json` records the three requested films as disabled
with unknown sources and unverified rights.

## Source and visual provenance

- Reviewed the user's Drive **GOAT Universe Master Book**, particularly the
  GOATVILLE lore and visual standards, and Canva **GOAT Universe Grand Book**,
  **Grand Proposal**, and **Immersive Sports Saga**.
- Inspected retrieved page previews: the populated visual pages use bold type,
  midnight black, gold stadium lighting and an adult sports-production tone. Many
  Saga page previews were blank; they supplied no location detail to reproduce.
- The Master Book grounds the wider directory: GOAT Stadium, University, Sports
  Complex, The Baa Report, Radio, TV, Market, Vault, Hall of Fame, Arena and Commons.
- The founder's supplied chat references informed broadcast typography, direct BAA
  language and architectural atmosphere. The athlete image, its personal data and
  its unverified statistics are not reproduced in the application.
- The night-plan illustration, sports line art, code, motion study and fallback
  synthesized cue are original work for this sprint. The entrance gate artwork and
  official theme are founder-supplied assets, integrated for development review. Existing bundled font licenses
  are preserved. No licensed league marks or theme-park imagery were added.
- No video/audio files were found in the initial attached library or connected
  Drive media search. The founder subsequently supplied GOATUNIVERSE.mp3 directly.
  The three named founder films remain an integration dependency;
  commercial clearance must be verified independently of possession of a file.

## Integration boundaries

This branch started at `f25b780a01ad27603fb31ea7f022026d1f9814f2`. It carries forward
the subsequent typography branch's small CSS/license/documentation fixes, without
merging any branch. Review against `work/kodak-luxury-typography-20261015`.

Coordinate with Tiffany's draft [PR #16](https://github.com/adamhbrown/Goat-Universe/pull/16):
her `goatville.html`, trivia, golf and passport are a separate proposal. This branch
does not overwrite them. Before integration, select a single arrival, golf engine
and passport schema; reconcile routes and local storage intentionally. Preserve
her editorial work through review rather than replacing her branch.

Pope owns account/league/Supabase infrastructure. These static prototypes contain
no backend or production infrastructure changes. Official game formats, scoring,
qualification, accounts, authenticated rosters and verified standings require
separate implementation and review. Merge and deployment remain unauthorized.


## Pope's supplied guest contract

The handoff's strict catalog, opaque sandbox, source-bound messages and per-run
session protocol are a proposed later integration. This branch neither copies nor
modifies `backend/` and does not claim that its five first-party prototype rooms
already run under that host. Adopt the reviewed host/child contract after joint
review, with `sandbox="allow-scripts"`, explicit lazy mount, teardown, focus return
and actual CSP response headers on a separate recreational origin. Classic scripts
are already used here. Never pass identity, tokens or competition authority into
guest games, and never import local stamps into the official award ledger.

The static export utility includes only `index.html`, `play.html`, `resort.html` and reviewed
`assets/`; it excludes backend, Git, docs, tests, credentials and operational files.
Its budget checks mirror the supplied initial file/image/code/media limits. This
is a packaging check, not a deployment authorization, full secret audit, CSP audit
or measured Core Web Vitals result.
