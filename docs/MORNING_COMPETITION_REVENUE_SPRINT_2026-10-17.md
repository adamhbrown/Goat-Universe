# GOAT Universe — Morning Build Sprint (October 17, 2026, 8:30–11:30 ET)

## Founder mandate
The five GOAT Games are the business and monetization engine. GOATville is the immersive setting, not a substitute for working competitions. Preserve all existing work and founder decisions. National county-by-county acquisition is a scalable distribution strategy, **not** a local graphics or poster service.

## Source of truth and safety
Start from draft PR #37 (work/one-universe-integration-20261015); inspect before changing. Do not merge, deploy, modify production, run hosted migrations, enable payments/email, or contact prospects without founder approval. No invented leagues, user counts, demand, financial projections, or official scores. Protect user privacy and comply with email/SMS marketing and platform rules. Preserve all five games and original source branches. PR #37 reports 366 local tests passing, but hosted, iPhone, migration and security gates remain open.

## 8:30–9:15 — Competition product
Inventory /games and /manage plus backend scoring and persistence. Create a gap matrix for each game: League of Greatness, 1st & BAA, Horns & Hoops, GOAT Crossover, GOAT Classic. Trace participant journey (discover > join/request > league assignment > make picks > lock > score > BAAs/GPI > standings > championship), marking actual implementation versus demo. Implement the highest-value safe end-to-end improvement with regression tests. Do not invent or alter scoring rules without founder confirmation.

## 9:15–10:00 — One connected universe
Use the integrated same-origin app, not a new throwaway website. Improve nav and handoff among arrival, games, manage, rankings, media, Publications and Goatville. Distinguish working links from planned experiences. Keep existing visual assets. Audit phone viewport, accessibility, loading and performance. No unauthenticated access to private management.

## 10:00–10:45 — Revenue engine and national county strategy
Build an auditable model with explicit assumptions and no fabricated traction. Candidate streams (require legal/payment validation): (1) competition participation or season passes where permitted, (2) premium commissioner/league subscriptions, (3) sponsor placements in competitions and media, (4) premium insights and archives, (5) white-label leagues for organizations. Model revenue = active paying leagues × net ARPA + paid participants × net fee + contracted sponsorships; subtract processing, prizes, fulfillment, support, acquisition, infrastructure, and taxes. Do not assume cash-prize contests or paid picks are legal nationwide; jurisdiction-by-jurisdiction review and age controls before launch.

Build a county-level acquisition database design: county FIPS, state, target segment, public organization source URL, verified business contact, outreach permission/status, owner, next action, response, opt-out, campaign, conversion and attribution. Prioritize counties using transparent signals, not fake rankings. Automate public-data research, deduplication, qualification, drafting, CRM logging and follow-up reminders. Keep first outbound campaign in human-review mode; enforce opt-outs, rate limits and compliance. Never scrape private data or auto-send unapproved cold outreach.

## 10:45–11:30 — Investor-grade presentation and launch gate
Upgrade premium black/white/gold styling and typography, cinematic but fast. Make the games the primary CTA. Review visual parity on mobile and desktop; add screenshots and tests. Produce founder demo path, pricing hypothesis, 12-month scenario model (bear/base/bull with assumptions), county rollout playbook, security/privacy checklist and blockers. End with exact files changed, tests run, known gaps and a founder approval request. No release until hosting, hosted security, migrations, and iPhone acceptance gates clear.

## Role prompts
**Kodak — competition engineering:** Work on a separate feature branch from PR #37. Inspect the real scoring and persistence code. Deliver one fully tested participant-to-standings journey and document all five games' implementation gaps. Keep competition rules authoritative and unchanged absent approval. Report tests and file diffs.

**Pope — security and integration:** Independently review Kodak's branch, account/permissions, migration holds, API exposure, legal/marketing safety gates and iPhone acceptance plan. Integrate only reviewed changes into a draft PR. Do not merge or deploy. Provide a red/amber/green launch-gate report with evidence.

**Tiffany — product, revenue, growth and design:** Keep the five games front and center; map pricing options, costs, county-level outreach CRM, human-approved messaging, investor demonstration and premium visual priorities. Build tangible artifacts and identify what is implemented versus conceptual. No local poster sales strategy.

**Codex — implementation coordinator:** Read this brief and PR #37 first. Inventory source, choose a narrow testable slice, implement on a new branch, run available tests, prepare draft PR and handoff with screenshots or precise reproduction steps. Never claim production readiness from local tests.
