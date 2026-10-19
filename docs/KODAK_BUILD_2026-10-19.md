# KODAK — GOAT Universe engineering sprint handoff
**October 19, 2026 · GST (America/New_York)**  
**Review:** https://github.com/adamhbrown/Goat-Universe/pull/55  
**Base:** PR #47 / `review/nightly-universe-20261018` (one integrated founder candidate)  
**Status:** Development draft only, not deployed or merged.

## Shipped to review branch

### Five-game member privacy
Extended the local HTTP member journey to verify all FIVE official GOAT Games:
- A second signed-in account cannot read the league, standings or history of
  another commissioner's private competition, even with a known league ID.
- A member cannot impersonate the commissioner by supplying owner fields.
- `member_history` ignores a supplied other user's identifier.
- Existing signup, session refresh/revocation and cross-account separation
  checks remain in place.

### Annual BAAS integrity
The official annual championship's existing DB uniqueness rule was exercised
against *two distinct, synthetically certified commissioner leagues of the
same official GOAT Game*. The first attachment contributes BAAS once; the
second fails and leaves the recorded total unchanged. Multiple commissioner
league memberships alone are not declared illegal.

### Membership/eligibility review
Added a privacy-safe read-only overlap counter that never returns member IDs,
email addresses or private league IDs. Incomplete member snapshots are not
reported as zero members. The five-game release audit accepts an optional,
source-referenced, explicitly approved founder policy, but assumes **no
default exclusivity policy**. The offline CLI can review this same input
without leaking source records.

### Founder-confirmed NFL award reference
Added the 20-member, 20-place finishing BAAS reference only for 1st & BAA:

`100, 90, 80, 70, 65, 60, 55, 50, 45, 40, 35, 30, 25, 20, 15, 10, 5, 0, 0, 0`.

This is a bounded, immutable **lookup**, not an award activation, a five-game
annual conversion table, or a new rule for tie adjudication. Other games still
require separately signed conversion policies.

## CI evidence

Exact checked head: `b1e644b0ba8d01c9ef279bda6f0b54a043fc5c53`
- Backend tests — GitHub Actions run `39231138827`: **273 passed, 0 failed**.
- One Universe integration — GitHub Actions run `39231138820`: **409 passed, 0 failed**.

Any follow-up commits, or changes to PR #47's moving base, require the checks
to be verified again. CI is local/synthetic acceptance, not a verified live
Supabase account journey or real iPhone/Safari launch acceptance.

## Nightly integration requirements

1. Review and integrate PR #55 into the same **One Universe** founder candidate,
   preserving Tiffany's navigation/GPI and Pope's City/Stadium/Media work.
2. Rerun BOTH CI suites on the exact combined candidate head, not just the
   individual branches.
3. Confirm navigation from Arrival → Games → private Member/Commissioner →
   GPI → City/Stadium → Creative Media → arrival is all one app.
4. Identify honestly whether the separate hosted Sites founder preview has
   actually received that exact candidate. A GitHub draft is SOURCE-ONLY.
5. Keep all release safeguards: no public `main` merge, hosted Supabase
   migration, payments, outreach, external signup, or deployment without
   explicit review and authorization.

## Product decisions still needed

- Does membership in two privately operated leagues of the same Game/season
  count as legitimate independent participation? How does one result enter
  official championship BAAS/GPI? See `GOAT_MEMBERSHIP_ELIGIBILITY.md`.
- Founder approval of exact-tie handling and remaining NFL competition rules.
- All five annual BAAS conversions and GPI formula/geo consent before real
  rankings or award statements.
- Healthy hosted Supabase and reliable HTTPS account service, real-device
  acceptance, media/brand rights, backups/rollback and launch review.

**Summary:** Real source changes, added tests, no fictional results, no live
accounts or billing, and no isolated replacement website.
