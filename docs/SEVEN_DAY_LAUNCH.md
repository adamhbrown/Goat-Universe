# GOAT Universe — seven-day launch challenge
**Kickoff:** October 14, 2026  
**Decision date:** October 21, 2026  
**Owner:** Founder/CEO, with Tiffany Jane (GOAT Games implementation) and Pope Henry I (infrastructure/identity).  
**Status:** Development sprint — NOT authorization to deploy, charge, email or admit the public.

## Definition of done

Aim for a **secure, genuinely usable first release**, not a promotional landing page:
- The founder can open a hosted development URL in mobile Safari and complete signup, confirmation, login, logout and recovery using an approved test inbox.
- A real participant can request entry, be approved, submit valid contest picks before the lock, see private data safely, and view standings and historical snapshots after verified results are entered.
- At least one competition has a complete sourced, tested, founder-approved end-to-end entry/scoring/correction cycle. First priority: 1st & BAA and Horns & Hoops.
- All five GOAT Games appear in the directory with honest readiness status. The GOAT Crossover, League of Greatness and GOAT Classic must not accept entries until their official rules, integrations and security checks pass.
- Commissioners cannot bypass deadlines, invent results, edit another participant's entry, or reveal hidden bracket/picks. Database RLS and HTTP authorization are separately tested.
- Public `main` site remains unchanged until founder explicit approval.
- Payments, external outreach, newsletters and paid membership remain disabled unless separately authorized and tested.

## Daily focus / exit criteria

| Date | Work | Exit check |
| --- | --- | --- |
| Oct 14 | Baseline CI, assign isolation lanes, implement trusted-clock prediction entry validator, inspect Supabase startup | Tested development branch, blockers documented |
| Oct 15 | Separate healthy staging Supabase and authentication/hosting verification; coordinate token expiry vs provider startup | A verified staging path or an honest documented blocker; never overwrite existing project |
| Oct 16 | Complete NFL and March Madness registration/enrollment/pick/standings UI journeys | Repeatable integration tests with evidence |
| Oct 17 | Develop remaining league competition contracts, records and opt-in states; integrate approved parts only | No invented rules; pending games fail closed |
| Oct 18 | Responsive Safari and desktop acceptance; polish five-game dashboard and commissioner paths | Human-reviewed device checklist and defects resolved |
| Oct 19 | Full scored season simulations, corrections, RLS, privilege, rate, lock and recovery tests | Reproducible CI with passing security regressions |
| Oct 20 | Rehearse rollout/rollback/monitoring/backups; review terms, contest eligibility, third-party marks | Signed-off release readiness or explicit blockers |
| Oct 21 | Founder go/no-go decision for limited pilot; launch only approved, accepted features | No unverified claim of production readiness |

## Critical dependencies / escalation

1. **Supabase:** Existing `opvoemihfyxidzbdyory` is COMING_UP, not reliably healthy. Read-only diagnosis showed missing managed storage/realtime objects. The earlier GitHub 401 may reflect a separately expired management token; do not treat it as proof the database is fixed. No unpause/reset/migrations/purchases without approval.
2. **Hosting:** GitHub Pages cannot serve the Node backend; a separately hosted HTTPS API and working datastore are necessary. Mobile-browser live tests cannot be declared passing based on local DOM tests.
3. **Rule approval:** 1st & BAA push/missing/ties/lines, source and league policy; Horns & Hoops sourced bracket field; unapproved Crossover/Classic scoring and annual Baas conversions. Never substitute fictional rules or sports outcomes.
4. **Trademark/legal:** Commercial use of `March Madness` and third-party logos/marks requires qualified legal/brand review; contest eligibility, promotions and payment features require separate review. Preserve historical record without claiming NCAA affiliation.
5. **External actions:** No emails, outbound CRM contacts, public signup, hosting purchases, payments or live deployment without the founder's explicit action.
6. **Parallel safety:** `work/launch-readiness` for Pope Henry; `work/qa-security` and `work/commercial-crm` are reserved branches, not running agents. Merge only reviewed draft PRs into `codex/backend-foundations` after passing CI; never auto-merge main.

## Today's verified baseline
- Before this sprint: 60 passing GitHub Actions tests at commit `aa61f90a06e1d58aa433030df4769197fe5f4206`.
- Latest team-coordination baseline `e8ab48e8c75168148107c126b95540c7425c9c1d` awaits its own CI inspection.
- Prediction-entry validation was added on the development branch Oct 14; its tests must pass before this component is called ready.
- Review `CHECKPOINT.md`, `SUPABASE_RECOVERY.md`, and `PARALLEL_BUILD_LANES.md` as the current operational sources.

### End-of-day reporting
State completed PR/commit, actual automated pass/fail result, live-hosted verification status, blockers, and what requires explicit approval. Do not inflate test coverage into production readiness.
