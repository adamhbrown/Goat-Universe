# Source and rules register

The founder's current instructions control company naming: GOAT Universe Inc.,
Downtown Sports Nation, and GOATverse Publications. Older business documents use
Downtown Sports Network; that earlier label is not carried into new product copy.

## Competition rules

Primary workbook: `Adam's 2026 NFL Playoff League.xlsx`, current Library upload
September 25, 2026. Inspected workbook strings in sheet1 and sheet4:

| Round | Allowed confidence weights | Game points available |
|---|---|---:|
| Wild Card | 1, 2, 3, 4, 5, 6, used once each | 21 |
| Divisional | 2, 4, 5, 7, used once each | 18 |
| Conference | 4/9, 5/8, or 6/7, either game assignment | 13 |
| Super Bowl | 7 | 7 |
| Super Bowl MVP | Separate correct-player bonus | 2 |
| Total | 13 game selections plus MVP | **61** |

Founder correction on October 13, 2026: this season's scoring maximum equals
Super Bowl 61: **59 game-selection points + 2 MVP points**. This supersedes the
earlier description of 60 game-selection points. The budget validator uses 61.
The engine uses the commissioner-supplied home spread to evaluate ATS selections;
it does not fetch, invent, or silently revise spreads.

The known rules profile is `backend/rules/nfl-playoffs-61.json`. It remains a draft
because the following specifications have not been supplied:

- Push points and whether a push affects the ATS record.
- Treatment of a missing/late submission.
- Precise comparison for the ATS-record tiebreaker, and any remaining exact tie.
- Round submission deadlines, official game IDs, result sources, and spread policy.
- Handling of canceled/postponed games or revised betting lines.

Tests choose explicit TEST-only policies; those choices are not official league
rules. Current provisional sorting is points, ATS wins, then fewer ATS losses;
exactly equal records share a rank. A launch requires Adam to approve that
comparison or replace it. A commissioner must explicitly approve rules and
clear unresolved items before a league opens.

## Existing business documents reviewed

- `GOATUNIVERSE:BusinessPlan.pdf`: revenue categories, audiences, membership,
  partnerships and phased commercialization.
- `Goat_Universe_Championships_Portfolio_Edition.pdf`: five different competition
  formats feeding one annual championship through Baas.
- `Goat_Universe_Ecosystem(1).pdf`: examined the raster pages with OCR; its Baas
  payout curve is explicitly an example, not an approved competition rule.
- `GOAT_Universe_Blueprint 2(1).pdf`: recovered the current raster source and used
  OCR to inspect its business architecture and partner/revenue categories.
  No unreadable diagram has been treated as a scoring specification.

No *complete five-game annual* BAAS conversion schedule, GPI formula, membership price, advertised audience size,
payment charge, or partnership has been invented. The first implemented scoring
strategy is `ranked_ats_v1`. Shared account, league, event, history, and access
control tables support adding other sports; their scoring strategies still need
their own approved rules and implementation.

Uploaded apparel images remain source assets. Their mockup prices, manufacturing
claims and third-party logos are not used as approved sale inventory.

## Horns & Hoops — founder instructions, October 14, 2026

The current conversation is authoritative: qualifying 1; Round of 64 2; Round
of 32 3; Sweet 16 5; Elite Eight 7; Final Four 9; championship 11. One main
bracket per GOAT profile. Qualifying selections lock individually at tip.
The **entire** main bracket and combined-championship-points prediction lock
at the first Round of 64 tip, permanently. Closest predicted combined total
breaks a total-points tie; equally close entries remain tied until any further
rule is approved. No champion bonus. Qualifying participation is optional;
missed qualifying picks cannot be retroactively entered.

Do not infer a qualifying-game count from the tentative audio schedule. Import
an official sourced field/schedule. The main tree has 63 games; its points total
209. Add one available point per actual qualifying game. The 65-game / 211-point
regression fixture uses two explicitly synthetic qualifying games.

Database strategy: `ncaa_bracket_v1`, with config, tournament feeder nodes,
actor-bound picks, one main submission, graph-consistency validation, standings
and shared audit/history. Other competitions now have persistent gated drafts
and sourced scoring helpers, not approved live leagues. Their caller-provided
fixture scoring policies must never be treated as founder-approved rules.


## 1st & BAA — founder-confirmed league finishing BAAS

The founder specified the **20-entrant league cap** and the following fixed
finishing-place BAAS awards for the NFL Playoff League (places 1–20):

`100, 90, 80, 70, 65, 60, 55, 50, 45, 40, 35, 30, 25, 20, 15, 10, 5, 0, 0, 0`.

The verified, immutable lookup lives in
`backend/rules/nfl-baas.mjs`. It checks a position against the actual
field size and enforces the 20-person ceiling. Its existence **does not**
activate BAAS awards, settle exact/shared ties, establish the competition's
complete submission policies, or approve annual championship conversions for
the other four GOAT Games. No fixture BAAS awards are published as real.
