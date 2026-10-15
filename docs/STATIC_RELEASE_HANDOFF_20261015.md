# Verified local static releases — October 15, 2026

The public file selection can now be exported into a **new local directory**,
audited, and verified against a SHA-256 manifest. This prepares a reviewable
artifact; it performs no upload, deployment, merge or provider operation.

Branch: `work/pope-static-release-manifest-20261015`.
Base: reviewed attraction catalog `1971c86d0b09e75b185ad7776d5337a81f49f556`
(`work/pope-reviewed-attraction-catalog-20261015`, following PR #17).
Other API abuse, five-game release and creative branches were inventoried but
were not merged, modified or included in the test claim below.

## Changes

- `backend/static-release.mjs`: explicit file selection; canonical relative
  paths; no source symlinks; no overwriting outputs; bounded reads; source
  preservation; existing security/size audit; deterministic per-file hashes;
  cleanup of only a newly created failed export.
- `backend/scripts/prepare-static-release.mjs`: bounded JSON selection input
  and redacted CLI failure codes.
- `backend/scripts/verify-static-release.mjs`: requires a separately trusted
  manifest digest, then checks manifest schema, exact file set, size and every
  payload hash. Both missing and added files fail verification.
- `backend/test/static-release.test.mjs`: ten regression tests, including
  same-size tampering and replacement of both payload and adjacent manifest.
- Browser acceptance harness now serves `catalog.mjs`, which the reviewed host
  imports. Without that allowlist entry, the harness would return 404 for a
  required module. No broader repository serving was enabled.

The new manifest is `goat-release-manifest.json`, with a strict versioned schema
containing only sorted paths, byte counts and SHA-256 hashes. There is no generated
timestamp, so identical selected bytes produce the same manifest regardless of
selection order. Existing output files/directories/symlinks are preserved.

## Use after selecting reviewed public files

The source should be a frozen, reviewed checkout/export, and the output must be
outside that source directory. Its parent directory must already exist. Do not
select an entire backend repository, database directory or unreviewed glob.
Directory entries are not accepted as file selections; enumerate actual files.

A selection JSON file is simply an array of relative public filenames, for example:

```json
["index.html", "assets/app.js", "assets/style.css"]
```

```bash
node backend/scripts/prepare-static-release.mjs /absolute/reviewed-source /absolute/new-release /absolute/selection.json
node backend/scripts/verify-static-release.mjs /absolute/new-release EXPECTED_MANIFEST_SHA256
```

The prepare command exits 0 only after the existing public-export security audit
and checksum verification pass. A failed build exits 2. The verify command exits
1 on failure. Diagnostic output omits raw filesystem errors and content excerpts.

Keep the returned manifest digest in the trusted review/release record, separate
from the artifact, and use that exact digest for subsequent verification. A hash
placed beside mutable files is not a digital signature or proof of provenance.
If an attacker can replace the release **and** the trusted review record, this
checksum mechanism cannot establish authenticity. Protect the release record
through the approved GitHub/environment review process.

Output is initially private to the local owner (directory mode 0700, file mode
0600). A future authorized hosting process must copy/read it under the correct
service account; this utility does not change hosting permissions or settings.

## Actual verification

- Complete inherited backend + new suite: **89 passed, zero failed/skipped**.
  Ten tests were added in this change. These are local tests, not hosted Auth/RLS
  or real-browser acceptance.
- `npm run check`, explicit syntax checks for the new utilities and corrected
  browser script, and whitespace checks passed.
- A real export of the eight reviewed guest harness files was prepared and
  independently reverified: **14,000 payload bytes** (manifest excluded).
- Its deterministic manifest SHA-256 was:

```text
9c93a8cc032a934c3fcf936434bf32fc0e1c3a96aab963c30d9919e3df0d0539
```

- The verification CLI accepted that digest and rejected an incorrect digest.
- Tests confirmed source preservation, repeatable output, existing-output
  preservation, traversal and symlink rejection, unknown/invalid manifest fields,
  oversize rejection, and cleanup after failed secret-pattern auditing.
- Browser sandbox/CSP enforcement remains unverified in this runtime because
  Chromium is unavailable. Correcting the loader is not a claim of browser success.

The checksum only describes the selected payload. This is not a link/import
completeness checker, accessibility audit, malware detector, or production
authorization. The existing secret-pattern scanner also cannot detect every
arbitrary password or obfuscated behavior. Continue code review, browser network
and CSP testing, performance/accessibility checks and designated release approval.
The trusted-source requirement excludes hostile concurrent filesystem mutation.

## Supabase support evidence update

Gmail reading became available during this continuation, so the actual existing
SU-507996 thread was read. Supabase's October 14 response at 17:49:11 UTC confirms
that the ticket was escalated to its infrastructure team. The retrieved thread
also includes the October 15 diagnostic follow-up at 13:46:18 UTC. There was no
root-cause diagnosis or recovery procedure in the retrieved provider replies.

This supersedes the earlier report's inability to review the support thread.
It does not establish that the project is repaired. No new message, duplicate
ticket, database query, credential change or provider operation was performed
during this continuation.

## Next integration step

Review this change after the guest catalog baseline. Kodak/Tiffany can use the
utilities for a selected public export without changing their branches here.
Verify the exported bytes against the approved external digest immediately before
any separately authorized deployment. Retain the previous approved artifact and
digest as rollback evidence; this utility does not redeploy or restore anything.
