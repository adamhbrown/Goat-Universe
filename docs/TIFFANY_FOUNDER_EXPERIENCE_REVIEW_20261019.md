# Tiffany Jane — Founder Experience Review & 2027 Championship Journey

**October 19, 2026 · Founder-only working specification**  
**Review source:** draft [PR #56](https://github.com/adamhbrown/Goat-Universe/pull/56), built upon the nightly [PR #47](https://github.com/adamhbrown/Goat-Universe/pull/47).  
**Status:** Source changes pending all checks and founder visual review. **No hosted Sites deployment.**

## Founder's north star

> “I'm making being a sports fan more entertaining.” — Adam Brown

The business is GOAT Universe: five signature competitive sports games, a proprietary GOAT Power Index, an annual championship ecosystem and Goatverse Creative Media included for every league. GOATVILLE is the immersive world supporting those core products, not the entire business.

**Brand stack:** Goatverse Holdings Inc. (company) → GOAT Universe (sports competition platform) → GOAT GAMES (five competitions) → GPI (personal ranking) → GOATVILLE (world) → Goatverse Creative Media + Publications (league storytelling) → GST (synchronized official display-time brand).

## The buyer / fan journey must feel like one universe

1. **Arrival:** one dramatic photographic, founder-approved gate and one unequivocal ENTER THE UNIVERSE call to action; no fake-looking skyline and no visitors trapped in a practice room.
2. **The five Games:** League of Greatness, 1st & BAA, Horns & Hoops, GOAT Crossover, The GOAT Classic. Each card must reach its own real workspace, not a common demo screen.
3. **Championship season:** introduce [championships.html](../championships.html), with founder's 2027 month-level calendar (January, March, April, September, October), functioning filters and real competition destination links. Never publish future exact dates as confirmed.
4. **My League:** accounts and competition entry must respect verified permissions and actual hosted auth readiness. If not open, plainly explain the next step.
5. **GPI:** huge proprietary ranking identity. The personal index and Block → County → State → Region → Global tiers must never invent member names, places or rankings. The same-block comparison requires consent and privately verified eligibility; no public street addresses.
6. **Goatville City and Stadium:** take the visitor inside a high-end world using consistent entry/exit routes. Do not replace the founder's chosen opening gate with a generic stock motif. City/Stadium remain Pope's work.
7. **Media:** GOAT Alerts, BAA Reports, magazine stories, rivalries and spotlights belong to every league as included baseline media, rather than exclusively premium upsells. Publish only rights-cleared actual assets; existing publications can be linked honestly.
8. **GST:** every Goatville clock and New York clock displays the same second by using America/New_York and DST-safe formatting from the same clock instant. Competition locks must be server-authoritative UTC, displayed in GST.

## A+ visual / interaction acceptance gates

- **First screen:** premium full-screen 390px iPhone entrance; cinematic composition, legible promise, one primary action; no small, cluttered calls to action.
- **Hierarchy:** brand words GOAT UNIVERSE, GOAT GAMES, GPI and actual league names are enormous, readable and differentiated; black, warm gold and white dominate.
- **Photographic trust:** founder-approved GOATVILLE gate imagery appears at correct aspect ratio without clipping or incorrect GOATVILLE spelling. Verify original asset explicitly before replacing a live image.
- **Navigation:** exactly four consistent primary visitor directions — Goatville / Games / Media / My League. GPI is prominent supporting access. No broken back links, hidden main actions or confusing multiple home pages.
- **Real content:** no imaginary players, standings, games, prices, sponsors, registrations, testimonials or published launch windows. Explicit development states are better than fake sample data.
- **Responsive:** 320px, 375px, 390px and desktop layouts without horizontal overflow; thumb dock clears home-indicator safe area; tap targets easy to use.
- **Accessibility:** semantic headings, focus visibility, keyboard-operable ranking tabs/filter controls, real image text alternatives, reduced-motion support, audio opt-in only.
- **Trust / rights:** only locally accessible approved images/audio; new media requires an asset provenance and commercial usage review.
- **Journey proof:** Enter → Games → Roadmap → GPI → My League → City → Stadium → Creative Media → back to Games, tested in browser not merely assumed from HTML links.

## Parallel developer handoff

| Lane | This increment | Protected scope |
| --- | --- | --- |
| **Tiffany** | New season UX, five official game routes, GST paired display, month filters, mobile screenshots, entry/GPI cross-links | Arrival, shared visitor experience, GPI, creative design, integration QA |
| **Pope** | Validate City/Stadium/Media cross-link and photo standard in nightly review | City, Stadium, Creative Media, deployment/hosting |
| **Kodak** | Validate five workspaces and permission boundaries after integration | Auth, competition rules, BAAS, backend, data integrity |
| **Adam** | Final visual approval, official wording, exact gate asset approval and public-launch go/no-go | Founder decisions |

**Existing sources remain intact.** Never publish to main/GitHub Pages, mutate Supabase, turn on payments, launch registrations, or call the separate owner-private Sites URL updated without a verified publisher and founder acceptance.

## Verification matrix

| Area | Automated evidence required | Founder acceptance still required |
| --- | --- | --- |
| Season | Exactly five verified game paths, month-filter test, deep links | Visual polish and league nomenclature |
| Clocks | GST/NYC same formatter and instant; no fixed UTC offset | Visible clock treatment |
| Entrance/GPI | Existing arrival + ranking regression tests | Correct founder-approved gateway, mobile hierarchy |
| Mobile | Chromium at 390x844 and desktop 1440x900, screenshot artifacts, no JS errors/overflow | Physical iPhone Safari/VoiceOver |
| Integration | Exact head passes One Universe and backend suites | Private hosted synchronization and complete click path |

*Do not infer a pass from an earlier commit. Record the GitHub Actions results on the exact PR #56 head, then merge to the designated nightly candidate only after review and conflict reconciliation.*
