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

No Baas payout curve, GPI formula, membership price, advertised audience size,
payment charge, or partnership has been invented. The first implemented scoring
strategy is `ranked_ats_v1`. Shared account, league, event, history, and access
control tables support adding other sports; their scoring strategies still need
their own approved rules and implementation.

Uploaded apparel images remain source assets. Their mockup prices, manufacturing
claims and third-party logos are not used as approved sale inventory.
