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
