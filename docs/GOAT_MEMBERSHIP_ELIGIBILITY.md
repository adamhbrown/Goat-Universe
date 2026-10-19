# One GOAT account across multiple commissioner leagues — policy checkpoint

**Date:** October 19, 2026 · Kodak engineering lane  
**State:** REVIEW ONLY — the founder has not approved an exclusivity rule.

## What is implemented

The read-only helper `backend/games/eligibility-audit.mjs` examines authorized
league snapshots and privately counts instances where one account has approved
entries in more than one commissioner league for the *same* GOAT Game and season.
It returns **aggregate counts only**. It does not expose member IDs, emails or
league IDs; it does not touch Supabase; and it never edits enrollment.

The five-game preparation checker `backend/games/release-gates.mjs` treats an
overlap as `eligibility_policy_review_required` until the founder approves a
policy. A reviewer can explicitly supply a policy with:
- `mode: "allow_multiple_leagues"` — treat multiple commissioner-league
  memberships as allowed for eligibility review.
- `mode: "one_league_per_game_season"` — flag such overlaps as a conflict.
- `approved: true` and a nonblank `source_reference` are both mandatory.

**Neither mode is the default**. This preserves the ability to participate in
multiple distinct commissioner leagues until business rules are reviewed.

## Important distinction

The annual GOAT Universe Championships must be able to distinguish
(1) membership in different *local commissioner leagues* from
(2) a certified result in each of the five *official championship events*.

Participating in multiple local pools may be legitimate. Awarding BAAS twice
from the same official event is a separate integrity concern. The existing
annual championship schema attaches at most one certified league snapshot per
GOAT Game to an annual championship. It must not silently add multiple awards
without an approved conversion/aggregation rule.

Do not create a unique DB constraint across all commissioner leagues until
the founder explicitly chooses a membership policy. If exclusivity is approved,
future enforcement must be transactional, scope-aware and race-tested in a
new reviewed migration; this reporting helper alone is NOT enforcement.

## Privacy, coverage and release limitations

- Snapshots may be partial. No value of `absence_of_collisions_certified`
  becomes true solely because a supplied list has zero collisions.
- Malformed or missing `entries` collections increase
  `incomplete_entry_records`; they never mean "zero members".
- Two accounts used by one natural person cannot be detected by this helper.
- The release checker always returns `can_launch:false`. No payment, public
  site, enrollment, outreach or hosted database action is authorized here.
- No real user data is present in the regression tests; identities are fixtures.

## Founder decision needed before production policy enforcement

Should one verified GOAT account be permitted to participate in multiple
commissioner-operated leagues for the same GOAT Game/season, and if yes, how
are **official championships** and **GPI/BAAS** calculated without double
counting? A decision should specify scope (local/private leagues vs official
event), effective season, certification and source. Do not invent an answer.


## Offline release-review input

`node backend/scripts/audit-five-games.mjs private-snapshots.json` accepts
the original bare snapshot array or a wrapper with `snapshots`,
`season_by_game` and optional `eligibility_policy`:

```json
{
  "snapshots": [],
  "eligibility_policy": {
    "mode": "allow_multiple_leagues",
    "approved": true,
    "source_reference": "REPLACE WITH DOCUMENTED FOUNDER DECISION"
  }
}
```

This is an **illustrative schema, not an approved founder policy**. If the
policy is absent, overlapping memberships are a review question. Invalid or
unapproved policy objects fail closed and do not dump private input fields.
The command remains offline and never returns `can_launch: true`.
