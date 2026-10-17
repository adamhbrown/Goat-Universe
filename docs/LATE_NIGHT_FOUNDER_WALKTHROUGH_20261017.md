# GOATVERSE HOLDINGS INC. — founder review card

**GO for local founder review. NO-GO for merge, shared hosting, hosted migrations or production.**

Candidate: `work/late-night-goatville-20261017`, based on [draft PR #37](https://github.com/adamhbrown/Goat-Universe/pull/37) at `3ff7010ece2d5e3b26f4ae94d67f692f986625ca`. The original PR and its branch are preserved. See [sprint evidence and gates](LATE_NIGHT_REVIEW_20261017.md) for the reviewed commit, screenshots and test results.

On the same desktop that has Node.js 22+, open this checkout and run:

```sh
npm ci --ignore-scripts
npm run universe
```

Open **http://127.0.0.1:8787/**. Stop with Ctrl+C. The address belongs to that computer; there is no approved shared URL or iPhone URL. Accounts and drafts persist in `.local/one-universe`. Close the application before copying that directory; never replace an existing database to upgrade.

| Stop | Exactly what to click | What Adam can review |
| --- | --- | --- |
| Arrival | **ENTER GOATVILLE** | Existing cinematic arrival leads into the city. Optional arrival study and theme require user action. GST stays visible. |
| City / headquarters | Scroll to **GOATVERSE HOLDINGS INC. / HEADQUARTERS** | Named skyline tower, seven district cards, and direct routes to competition, accounts, editorial and the private boundary. |
| GOAT GAMES | **OPEN LEAGUE WORKSPACE** → choose a competition | **1st & BAA**, **Horns & Hoops**, **GOAT Crossover**, **League of Greatness**, **The GOAT Classic**. Homepage/stadium discovery panels also link to each workspace. |
| Local account and draft | On `/games`, enter a review email, a 12–200 character password and a display name → **Create account** → enter the password again → **Sign in**. Choose a game → fill **Competition name** and **Season year** → **Create draft**. | A real local account and saved draft, with no seeded password or official result. Reload and sign in again to check persistence. Separate private pages require another sign-in. |
| Attractions | **EXPLORE UNIVERSE** → Sports Practice Rooms, Resort, Stadium, Playground, Spotlight Circuit or Field Vision | Guest challenges and practice mechanics have their own status. Their scores do not populate official competition records. |
| Cinema | Explore menu → **THE CINEMATIC STUDIO** | Select your own local media files. No upload or fabricated founder film. Cleared founder films are still needed for the intended film program. |
| Editorial / DSN | City headquarters → **PUBLICATIONS & STORIES** or **DOWNTOWN SPORTS NATION** | These open arrival sections `#media` and `#dsn`. Publications opens the existing separate site in a new tab; close that tab to return. DSN currently has editorial/calendar content, not a separate complete application. |
| Bullpen boundary | City headquarters → **BULLPEN · AUTHORIZED SEATS ONLY** | A sign-in shell; ordinary account registration grants no seat. Do not bind a founder seat during this tour. |
| Return | **Goatville city** at the top of private pages; **EXPLORE UNIVERSE → GOATVILLE CITY** from public scenes | Complete the loop back to the city. |

**Naming decision recorded:** Adam approved revising public “GOATVILLE USA” wording to **Goatville** on October 17. Company: **GOATVERSE HOLDINGS INC.**; platform: **GOAT Universe**; interactive world: **Goatville**. Existing all-caps visual wordmarks remain; historical documents retain their wording. Competition names and approved supporting taglines are preserved.

**Review decisions:** accept or annotate the visitor journey, skyline/headquarters, clock and competition labels; then perform physical iPhone/Safari and accessibility review. A later host/cost/origin proposal, hosted Auth/RLS and restore evidence, migration review, and explicit release authorization remain separate gates.
