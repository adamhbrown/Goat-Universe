# GOAT Universe website readiness — October 14, 2026

## Scope

Read-only audit of the current GitHub Pages site, repository deployment files,
the Publications link manifest, and open website/backend draft PRs. This change
adds independent smoke checks only. It does not edit `index.html`, competition
screens, Publications content, GitHub Pages settings, or production resources.

## Evidence

- `https://adamhbrown.github.io/Goat-Universe/` returned HTTP 200 over HTTPS.
  Its 22,216-byte response matched `origin/main:index.html` byte-for-byte
  (SHA-256 `c3ca90e746c557bc713781777543b5bf3ad9ec0497b2265a7ebf005aa74f06fe`).
- The repository's default branch is `main`. No GitHub Pages deployment
  workflow exists in `.github/workflows`; the only workflow there on `main`
  concerns Supabase migrations. The public Pages API endpoint returned 404, so
  the configured Pages source/build settings could not be confirmed. The live
  byte match shows that the deployed homepage currently reflects the root page
  on `main`; it does not prove how GitHub Pages is configured to publish it.
- Static source checks on the live homepage found: one `main`, one `h1`, valid
  English language/title/mobile viewport metadata, 16 in-page links with no
  missing targets, no duplicate IDs, and no unnamed links/buttons. There are no
  `<img>` elements or local script/media references; the page imports Google
  Fonts with local system-font fallbacks.
- The public page includes responsive CSS breakpoints at 900px and 560px.
  Visual browser QA and real iPhone/Safari checks were not available in this
  environment. The existing navigation landmarks do not have accessible names,
  and no explicit `:focus-visible` or `prefers-reduced-motion` styles are
  present. These are follow-up accessibility improvements; they were left to
  the homepage owner as requested.
- The Publications site's saved link manifest declares 89 representative
  routes/assets covering the home/reader/profile/film routes and selected
  covers, first/final pages and PDFs. A fresh HTTPS HEAD check reached **89/89**
  with HTTP 200. The audit does not test every one of the 802 declared page
  images or inspect publication rendering.
- The current homepage still labels a demo preview but contains sample team
  names/GPI and a “qualifying window open” ticker. Treat those as demo copy;
  do not use them as real event, standings or entry status. Draft PR #12 replaces
  the match preview and is the homepage owner's scoped change.

## Added checks

- `tests/public-site-smoke.test.mjs` checks document metadata/landmarks,
  unique IDs, in-page navigation targets, accessible control names, image alt
  attributes, local asset references, inline JavaScript syntax and the existing
  mobile breakpoints.
- `.github/workflows/public-site-smoke.yml` runs the static checks on relevant
  pull requests, with read-only repository permissions. A weekly schedule and
  manual dispatch also check the 89 URLs in the Publications manifest.
- `scripts/check-publication-links.mjs` performs bounded, HTTPS-only HEAD
  requests to the allowlisted Publications hostname, follows same-host
  redirects, retries once, and fails with a concise list of broken links.
- The six static tests pass on both the current public homepage and Tiffany's
  draft homepage source. The live link script passed **89/89** during this
  sprint. No deployment or browser-rendering result is claimed.

## Draft PR and integration findings

Open GitHub drafts inspected on October 14:

| PR | Scope / target | Readiness and interaction |
|---|---|---|
| #12 | Tiffany homepage, targets `main` | Draft; changes only `index.html` and adds its homepage test. No overlapping files with the backend-foundation PR #1. Because the live page matches `main`, a merge could publish the homepage change. Keep draft until founder content/design review and visual/mobile acceptance. |
| #1 | Backend foundation, targets `main` | Large backend/competition baseline; does not change the root homepage relative to `main`. Keep app/backend launch review separate from the static page. |
| #11 | Bullpen, targets `codex/backend-foundations` | Draft; overlaps PR #6 in `package.json` and the CI workflow. A local merge-tree dry run of #11 with #6 reports a content conflict in `package.json`; combine scripts deliberately and rerun all checks before integration. |
| #6 | Account/session/hosting readiness, targets `codex/backend-foundations` | Draft; GitHub reports `mergeable=false`, while a local merge-tree check against the fetched foundation head found no text conflict. Refresh GitHub's mergeability and review checks before integrating. |
| #7 / #8 | Navigation integration / staging gate, each stacked on #6 | Both depend on #6. Their direct deltas touch separate files and combine without a local merge-tree conflict. PR #8 still has its own staging/capacity gates. |
| #2 / #4 / #5 | Earlier hosting, double-submit and navigation drafts | Stacked chain. PR #6 describes incorporating #2/#4; PR #7 describes replacing the navigation-only effect of #5. Do not layer the superseded changes a second time. |

Git merge-tree dry runs found no content conflicts between homepage PR #12 and
backend foundation PR #1, nor between PR #11 and the current foundation head.
These are source-tree checks, not approval to merge. The new smoke workflow is
separate from the shared backend workflow to avoid colliding with PRs #6/#11.
Since the new workflow is not yet on `main`, it will not run on PR #12 until an
approved integration makes it available on that PR's base branch.

## Launch blockers and improvements

### Blockers for a functional competition platform

- GitHub Pages serves static files; it cannot run the Node API or PostgreSQL
  persistence. Real registration, competition entry, scoring and accounts need
  an approved HTTPS Node host plus a healthy authorized database/Auth target.
- The actual GitHub Pages source/build configuration is not represented by a
  Pages workflow in this repository and the Pages settings API could not be
  read during this audit. Confirm it before selecting a production release path.
- Homepage PR #12 is a draft and targets the live default branch. It needs
  founder content/design approval and real viewport/mobile acceptance before
  any merge or publication.

### Nonblocking for the current static page

- Add accessible names to the navigation landmarks, visible keyboard focus and
  reduced-motion behavior in coordination with the homepage owner.
- Run browser screenshots at desktop/tablet/phone widths and a real
  iPhone/Safari pass before public launch claims.
- Confirm or remove the Google Fonts dependency if fully self-contained offline
  rendering is required.
- Extend Publications coverage if there is a need to verify every page image;
  the current weekly checker covers the existing 89-entry audit manifest.

## Recommended integration sequence

1. Review this smoke-test draft into `codex/backend-foundations`; it changes
   no homepage, competition UI, account or migration files.
2. Keep homepage PR #12 separate. After founder review, retarget it to the
   development integration branch for checks/preview, then make a separate
   founder-approved production publication change to `main`.
3. Integrate and review the backend baseline separately. Resolve the
   `package.json` overlap between PR #6 and Bullpen PR #11 as one combined
   candidate, then retest the account/session and Bullpen suites together.
4. Review PR #7 and PR #8 on top of #6; do not duplicate the superseded #2/#4/#5
   stack. Keep the staging capacity, $0 cost, target health, host and
   target-specific approval gates intact.
5. Only after hosting is approved and verified, deploy the Node service outside
   GitHub Pages, complete account/security/recovery acceptance, and request
   separate CEO approval for any production release.

No merge, migration, resource creation, paid service, or production deployment
was performed by this audit.
