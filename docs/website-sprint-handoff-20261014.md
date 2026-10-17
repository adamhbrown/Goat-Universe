# GOAT Universe — Website Sprint Handoff (Oct 14, 2026)

**Scope:** public GOAT Universe homepage only. **Branch:** `work/tiffany-goat-games-homepage-20261014`, draft PR #12, targeting `main`. No merge or deployment authorized.

## What this website branch actually implements

- A prominent GOAT Games hero and five black/gold competition cards.
- Five native disclosure sections describing each competition. Each card links to an individually addressed detail; JavaScript opens the targeted section. These are **informational, not game engines**.
- A five-event seasonal calendar, replacing outdated demo league listings.
- A GOATverse Publications feature, with external site links to the URL the founder previously provided: `https://goatverse-publications.downtownadamb.chatgpt.site/`. **Current live reachability and issue-specific destinations could not be independently confirmed in the development environment**. Verify the site and exact collection routes prior to shipping.
- More accurate championship, BAAS, GPI and enrollment disclaimers. Fictional competitor rankings and fake account confirmation were removed.
- Mobile safe-area adjustments, touch target/readability improvements, keyboard focus states, skip link, accessible native disclosure, reduced-motion support.
- Website content regression suite `tests/goat-games-homepage.test.mjs`, runnable with `node --test tests/goat-games-homepage.test.mjs`. Dependency-free and intended for Node's built-in test runner.

## CEO-approved five-game identities (do not rename without approval)

1. **1st & BAA** — Goats of the Gridiron Playoff League
2. **Horns & Hoops** — Downtown's BAAsketball Showcase XXXV
3. **GOAT Crossover** — Two Sports, 1 Competition
4. **League of Greatness** — Fantasy Football Championships
5. **The GOAT Classic** — Take Your Swing at History

Master line: **THE GOAT GAMES — Where the GOATs Play**. Keep GOAT Universe as the company/ecosystem identity. Primary colors are black/white/gold. Slogan: **Can't Stop the Baa**.

## Integration boundaries — avoid conflicting edits

- **Tiffany / PR #12:** static public homepage, editorials, promotion, public navigation, mobile layouts.
- **Kodak:** game-specific interactive entry/scoring/league experiences on separate files and branch. Do not quietly change official rules or expose a demo as live.
- **Pope:** website checks, security, staging readiness and branch integration. Do not modify the original Supabase project or its data without the founder's explicit authorization.

This PR intentionally does **not** implement enrollment, payment collection, authenticated dashboards, game scoring, BAAS conversion, live leaderboard, or connectivity to the Bullpen. Those remain separate workstreams.

## Visual / functional QA before merging

- Test widths at 320, 375, 390, 430, 768, 900, 1024 and 1440 px.
- Check no horizontal overflow or text collisions at the small widths (especially the header, five cards, disclosure summaries and sticky mobile navigation).
- Verify iPhone Safari safe-area and touch targets, desktop keyboard Tab/Enter/Space, VoiceOver landmarks and disclosure announcements.
- Check the first and last menu links and all internal anchors, the visible GOAT Mode toggle and correct reduction of motion.
- Follow each of five game-card links and verify its disclosure opens and presents the correct approved title and status.
- Check all external publications links actually load on iPhone and desktop. Do not claim a broken external publishing destination works.
- Inspect social-sharing preview and ensure no fictional scores or fake athlete images.
- Run `node --test tests/goat-games-homepage.test.mjs`; compare any future repo CI status as well. Additional browser acceptance is required.
- Review all copy for unsupported qualification/scoring promises before publication.

## Release safeguards

- Existing live GitHub Pages website stays as is until CEO approves merge/deploy.
- Keep the GOATverse Publications site independent.
- Do not spend money, provision hosting, disclose API keys, perform database migrations, or activate signups/payments as part of this homepage branch.
- For any later live link to Kodak's game hubs, first verify working URL and authorization; otherwise retain the informational overview.

## Known open items

1. Visual browser QA, real iPhone Safari QA and integrated CI evidence pending.
2. User-provided GOATverse Publications destination was integrated but not reachable for independent live verification from the available runtime.
3. Game-specific working destinations to be provided by Kodak; website currently uses internal disclosures.
4. Official scoring, qualifications and season dates require sign-off; the public page deliberately uses broad seasonal descriptions.
5. CEO review of final copy, ownership language and design required before merge.
