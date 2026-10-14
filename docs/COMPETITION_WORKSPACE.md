# Competition workspace — October 14, 2026

Isolated branch: `work/qa-security`. Review target: `codex/backend-foundations`.
The public `index.html`, publication experience, account/security branches and
existing `/play`, `/manage` and `/crm` interfaces are preserved.

## Preview

Run `npm ci --ignore-scripts`, then `npm run dev` with the default local
development configuration. Visit `http://127.0.0.1:8787/games`.
Create a local development account, sign in, choose a game and create a draft.
No teams, schedules, scores, conversion tables or example competitions are seeded.
Local accounts do not send confirmation emails; hosted email remains gated.

Game screens:

- `/games/first-and-baa`
- `/games/horns-and-hoops`
- `/games/goat-crossover`
- `/games/league-of-greatness`
- `/games/goat-classic`

Navigation between these screens preserves the current in-memory account client.
Sign-out and Safari pagehide clear private screens. Tokens are never stored in
browser storage or game URLs. Recovery and password settings remain in the
existing account workspace. The new screens reuse its account client and bracket
module; they do not replace Pope's identity implementation.

## Actual functionality

| Property | Working development features | Remaining rules / release gates |
|---|---|---|
| 1st & BAA | Matchup and round administration; approved entries; ranked ATS editing; 59 game points plus 2 MVP points; standings; result entry, correction and final archive; corrected wall-clock locks | Official schedules/spreads; push, missing-submission, ATS-record ordering and remaining exact-tie approval. No championship-total tiebreaker was invented |
| Horns & Hoops | Existing 63-game main bracket connected to a game screen; optional individually locked qualifiers; 1/2/3/5/7/9/11 scoring; advancement validation; championship-total prediction; result imports, correction invalidation, standings and archive | Official field, qualifying schedule and source verification; physical mobile acceptance |
| GOAT Crossover | Persistent NBA/NHL series graph and sourced schedule administration; private partial pick editing; individual server locks; combined/sport standings; result management, atomic imports, downstream corrections and championship archive | Official mechanics, round matrix, missing-pick and shared-rank tie approval. No default points; both NBA and NHL must be present before opening |
| League of Greatness | 12 sourced franchises and stable franchise/ESPN IDs; validated 84-matchup regular schedule; verified score batches; W/L/T and points records; supplied seven-seed order; Week 15 Wildcat; Week 16 reseeding; Week 17 title; score provenance and corrections | Live ESPN fetching is not implemented; scores are commissioner-reviewed imports. Tied playoff games block advancement. Finishing places 3–12 and seed/record tiebreakers need official sources |
| The GOAT Classic | Persistent MLB series graph; commissioner controls; approved entries; configurable private picks, result imports, standings, corrections and title archive | Official postseason format and scoring policy; no default scoring or live results |
| Annual GOAT Championship | Certified immutable finishing positions; all-five-game conversion-policy validation; final-season attachments; BAAS rankings, shared ranks, overflow checks and final snapshot; self-only member history | Actual conversion values and tie policy need founder approval. No live BAAS awards or transactions are issued |

Empty or rule-pending workspaces say so. Draft schedule administration can proceed
without inventing scoring weights. The annual preview remains disabled until all
five reviewed conversion tables are supplied, and finalization requires all five
finished, certified competitions.

## Commissioner data contracts

All mutations use the existing authenticated `/commands` RPC endpoint. Queries
use `/query`; identity comes from the verified session, never a supplied user ID.

Series schedule JSON accepts `code`, `sport`, `round`, `stage`, `lock_at`,
`source_url`, and either each entrant's team name or feeder code/ID. NBA/NHL
feeders cannot cross sports or leagues. `series_schedule_import` and
`series_results_import` are atomic. A result requires a decisive winner from the
actual resolved entrants and an HTTPS evidence URL.

Fantasy schedule JSON accepts `week`, `home_id`, `away_id`, `starts_at`,
`source_url`. Every regular week must contain six matchups and each of the 12
franchises exactly once. Result JSON accepts `matchup_id`, `home_score`,
`away_score`, `source_includes_home_bonus`, `verified`, `source_url`.
`source_includes_home_bonus: true` leaves the official home score unchanged;
`false` adds two only for 2026 onward. Never clear this flag for an ESPN official
total that already includes home advantage. Postseason home designation and
start times come from the supplied schedule, not a guessed high-seed-home rule.

Annual finishing certification must include every approved competitor exactly
once, preserve known computed places, and cite a verified finishing policy/source.
Unresolved fantasy places require explicit sourced positions, not playoff seeds.
Annual policies are frozen after the first attachment. Championships and certified
finishes cannot be rewritten through ordinary commands.

## Defects fixed and regression evidence

- Existing NFL/NCAA deadline checks used transaction-start `now()`. A synthetic
  transaction began before a cutoff, waited beyond it, and the baseline accepted
  a late NFL pick. The hardened implementation rejects the same request with
  `selections_locked`. Regression cases also cover late entry approval and
  qualifying picks. Old implementation RPCs keep their denied execution grants.
- Prediction helpers accepted normalized nonexistent dates such as February 30
  and 24:00. Strict calendar checks now reject those values before authorization.
- Scoring evidence accepted a bare `https://` prefix and URLs containing embedded
  credentials. Entry/scoring validation now requires a valid HTTPS authority with
  no credentials or whitespace. URLs remain evidence supplied by a commissioner;
  the code does not independently certify a source's truth.

Targeted local verification: 27 tests passed together, zero failed/skipped:
series (5), fantasy (4), annual integration (3), deadline regressions (4), input
validation (2), game-screen DOM/routing (9). The earlier unmodified integration
baseline passed 63 tests. The full updated suite and three new HTTP/DOM/database
tests must be verified on the final commit; see the draft PR's CI evidence.
JSDOM checks prove functional DOM behavior, not physical iPhone rendering.

## Integration boundaries and next work

Reviewed PRs #2/#4 and the newer #6/#7 account/navigation candidates. They own
shared identity and existing player/manager screens. This change adds isolated
`backend/games/` modules, tests, three development migration files and a separate
CI workflow. Shared `backend/server.mjs` edits only serve the new allowlisted
screen/assets and aliases for reused modules; the scoring-helper edit only
hardens timestamps/evidence. Review both through this draft before integration.

The migrations were exercised only in local PGlite databases. No hosted migration,
Supabase investigation, reset, secret rotation, purchase, deployment, production
merge, public homepage edit, Bullpen work, email or payment activation occurred.
The CLI's home-directory restriction prevented its migration-creation helper;
development migration files use UTC names and remain unapplied to any hosted
project. Infrastructure must review the additive competition schema before
authorized staging use. Health retains the existing v4 account baseline and adds
`competition_schema_version: 1` for explicit acceptance of these features.

Next priorities:

1. Review the game screens with Tiffany and integrate Pope's account-security
   candidate without reapplying overlapping old PR patches.
2. Obtain the missing official competition policies, schedules and annual BAAS
   tables; populate only evidence-backed commissioner records.
3. Run approved hosted acceptance and physical iPhone/desktop checks, including
   multi-user isolation, locks, account recovery and correction workflows.

This sprint does not establish launch readiness.
