# Five-GOAT-Games release-candidate audit (read-only)

October 15, 2026 · Pope Henry I · Draft for backend integration review

This is an engineering **fail-closed candidate check**, not a game-registration toggle,
a live data import, a substitute for rule approval, or a production authorization.
It builds on the five-workspace branch `work/qa-security` / PR #13.

## Implemented

- `backend/games/release-gates.mjs` checks for exactly one snapshot for each
  canonical flagship event: 1st & BAA, Horns & Hoops, GOAT Crossover, League of
  Greatness and The GOAT Classic.
- It checks supported season identifiers, complete source-backed rule-review
  records, and each league's existing saved-setup observations. It fails closed
  on missing, duplicate, unknown, partial and malformed snapshots.
- The commissioner-facing setup observation now requires both an approval
  record and a nonempty source reference before it calls that observation
  complete. This does not prove source truth.
- `backend/scripts/audit-five-games.mjs` checks a specifically supplied local
  JSON array, at most 4 MiB, and prints **only sanitized gate results**.
  No source snapshots, tokens, member IDs, emails or raw evidence are printed.
- A suite of synthetic examples tests all five event structures, missing
  source records, duplicate competition IDs, season boundaries, malformed
  input, privacy and CLI exit codes.

## Local-only use

The operator must deliberately supply an existing JSON array of five
commissioner-authorized, private league snapshots. There is **no automatic
production export**, no API connection, and no stored sample featuring real
members. Do not check any private snapshots or credentials into GitHub.

```bash
node backend/scripts/audit-five-games.mjs /secure/local/private-snapshots.json
```

Exit 1 = blocked, 2 = recorded setup prepared for independent manual review.
There is **no success exit code for production launch**, because this tool can
never approve a production release.

A complete synthetic fixture is sufficient to exercise the audit, but it is
never official sports evidence. Snapshot fields may be missing until the
chosen commissioner export format is reviewed.

## Optional explicit annual season mapping

Do not assume the football season label equals the calendar year in which its
championship is played. The commissioner/founder can supply a reviewed year for
**each** of the five game identities. The audit then rejects a saved competition
whose season differs from its expected value. Without a mapping, the report says
`season_mapping_checked:false` and no annual season alignment is asserted.

Private local JSON (illustrative schema; numeric years are **not** authorized
production values):

```json
{
  "snapshots": [],
  "season_by_game": {
    "first-and-baa": 2027,
    "horns-and-hoops": 2027,
    "goat-crossover": 2027,
    "league-of-greatness": 2027,
    "goat-classic": 2027
  }
}
```

The array is deliberately empty here; the example is *not* a complete
candidate. The chosen years must match an approved annual competition calendar.
This does not pick annual BAAS conversions or permit mixed-season awards.

The candidate also rejects an impossible, normalized date such as February 30
or a timezone offset with invalid hours on the NCAA main-bracket lock field.
Actual scoring deadlines remain enforced transactionally by the database.

## Outstanding independent launch gates

1. Official sports sources and CEO-approved final rulebooks, including NFL
   pushes/missing picks/exact ties and Crossover/Classic scoring.
2. Hosted Auth, RLS isolation and audit-history acceptance with a healthy
   approved staging target. Original Supabase recovery remains independent.
3. Mobile/browser QA, accessible experience, scalability and shared abuse limits.
4. Tested hosted backups, recovery and rollback; operator/commissioner access.
5. Privacy and legal review before paid events, advertising or prizes.
6. Explicit CEO production release approval.

No Supabase mutation, merge, website release, registration change, official
score mutation, email, purchase or payment feature was authorized or performed.
