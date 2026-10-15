# GOATVILLE afternoon resort increment

2026-10-15. Built on PR #22; no merge, deployment or infrastructure changes.

- `resort.html` is a working six-district console, Night Circuit discovery game,
  six-sport Sports IQ game, official-theme room and 12-stop guest passport.
- `guest-passport.js` shares memory-first local-unverified souvenirs across the
  Arcade and resort. Each page/reload requires fresh opt-in before storage access.
  Version 2 has an exact bounded schema; no silent v1 migration or official awards.
- All five sports results offer a labeled, inert SVG download and copy-text/manual
  fallback. Next-room links connect the five experiences. Bracket round controls
  retain horizontal position after each pick. Championship artwork is original SVG.
- New standalone Arcade/resort CSP permits bundled scripts/styles/fonts/media and
  denies network API requests and inline scripts. Actual production response
  headers and Pope's separate opaque guest host remain a later integration review.
- The original founder MP3 stays outside the repository. Its audio-only 96 kbps
  AAC-LC fast-start MP4 derivative is 4,170,150 bytes, under the 4 MiB media cap.
  This is development integration; commercial clearance remains undocumented.

Verified locally: 45 individual source/model tests across six test files; existing
Chromium suite 72 layouts / 27 interaction groups; resort suite 120 layouts /
19 interaction groups. Zero uncaught page errors in both final browser runs.
The resort suite verifies all clues, passes/replay, answer locks, full reviews,
cross-page opt-in, clearing, blocked storage, native AAC play/pause/focus, five SVG
downloads, clipboard denial, round scroll retention, keyboard/history, no-script
fallbacks, and actual meta-CSP inline-script/outbound-fetch blocking.

Chromium mobile/touch emulation is not physical iPhone Safari or VoiceOver.
Selected screenshots and machine-readable results are in `docs/goatville-qa/`.

Pope's release tools were read at pinned commit
`a5d97b011a0c0c914c7c3290bfe9ef7e4bf994c5` into a separate temporary tool folder.
No backend files were copied into this branch. The frontend exporter now excludes
font engineering notes but retains both OFL licenses and rejects unknown types.
Final checksum packaging belongs to the subsequently authorized integration sprint.

The CEO's next instruction authorizes a dedicated integration branch reconciling
PRs #22, #29, #26, #25 and #13. Preserve this increment as a completed source input.
