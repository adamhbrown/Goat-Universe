# ONE UNIVERSE — Nightly Founder Build Protocol

**Owner:** Office of the Founder & CEO, GOAT Universe  
**Adopted:** October 18, 2026  
**Initial nightly integration:** [PR #47](https://github.com/adamhbrown/Goat-Universe/pull/47)  
**Public launch target:** October 31, 2026 if accepted and release gates pass; otherwise early November. Neither date is authorization to go public.

## Non-negotiable outcome

During the day, Tiffany works on homepage/arrival, navigation and prominent proprietary GPI; Pope works on cinematic City, Stadium and Creative Media; Kodak works on authenticated accounts, five official GOAT Games, competition engines and backend integrity. They may use separate branches during the day.

**Every night, deliver one combined, reproducible founder candidate.** It must be possible to traverse the same actual application from arrival to Games, member account, GPI, City, Stadium and Media. The nightly report must say **exactly** whether the same candidate was deployed to the owner-private interactive founder-preview URL. If there is no verified hosted deployment, label the GitHub PR **source-only**, provide any verified screenshots, and name the missing publisher/integration gate. Never call GitHub source or a screenshot an interactive hosted preview.

## Source ownership and integration

1. Read and freeze all current source heads, project/site versions, ongoing PRs, and the last accepted integrated candidate.
2. Integrate **into one existing nightlies line**, not a disconnected replacement website. Record exact source SHA/PR. Never silently drop previously integrated working backend/security/GST features.
3. Treat overlapping changes as manual review conflicts. No overwrite-by-order shortcuts. Preserve all original author branches and assets.
4. Keep founder-preview and GitHub app as two separate sources until a verified deployment synchronization/hosting path connects them.
5. Verify the real resulting tree, including all of the five official GOAT Games, before assuming individual branch CI results apply.
6. Run the exact combined integration and backend suites, HTML/assets allowlist/CSP checks, and independent City/Media and GPI/mobile checks. Use physical iPhone/Safari acceptance before public launch.
7. Publish *only* to the already-authorized owner-private founder-preview audience using a supported Site/hosting publisher and only after verification. Preserve project identity and rollback. Never merge to `main` as a workaround—GitHub Pages may publish it publicly.
8. Show one nightly founder report with **one consolidated candidate link**, a real hosted preview link only if verified updated, tested commit and exact pass/fail numbers, screenshots when available, remaining failures, and next critical acceptance step.
9. All public-launch gates remain closed until explicit founder acceptance of the visual experience, account privacy and hosted authentication, working official competitions and rules, licensed/approved media, payment compliance, mobile accessibility, and rollback/recovery.
10. No automatic outreach, signups, billing, Supabase migrations, live score imports, company commitments or investor solicitation. Revenue and partnership promotion resumes after the founder-approved public launch readiness decision.

## Nightly founder walkthrough

1. **Arrival:** one clear ENTER THE UNIVERSE entry; luxury black/white/gold mobile experience.
2. **GOAT GAMES:** five official competitions front and center, not practice promotions.
3. **My League / Account:** real signup/sign-in and secure authorized league navigation when hosted; never present local-only test accounts as real.
4. **GPI:** large proprietary brand; personal, block, county, state and region rankings only from real verified membership/geography and results. If data are insufficient, show a real empty/not-yet-ranked state.
5. **Goatville City → Stadium:** cinematic founder-approved visual standard and purposeful navigation.
6. **Media:** real approved songs, films, League of Greatness storytelling and publication links, with honest asset/rights status.
7. **Return path:** every experience can navigate back to the Games and account, without dead ends.

## October 18 initial integration

Base: PR #39 / `ecdc3a43`.  
Tiffany: PR #45 / `4eaa7f22` (16 files).  
Pope: PR #46 / `81abebeb` (8 files).  
Kodak: PR #44 / `d968af42` (4 files).  
Combined draft: PR #47 / `review/nightly-universe-20261018`.  
Integration correction: restored three GST time assets removed from the public file allowlist during the combined overlay.

**Important:** GitHub integrated CI and visual evidence must be checked against the latest HEAD, not a prior passing source branch. The actual owner-private Sites project is not updated by this PR; it needs a supported publisher before claiming a nightly live preview. No production release is authorized.
