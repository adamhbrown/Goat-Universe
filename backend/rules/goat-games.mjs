// GOAT Games catalog. Shared identity and standings architecture, not five invented rulebooks.
// Verified: GOAT Universe 2026 business plan / Championships Portfolio Edition,
// October 2026 Strategic Playbook and League of Greatness historical records.
export const GOAT_GAMES = Object.freeze([
  Object.freeze({
    id: 'first-and-baa', name: '1st & BAA', subtitle: 'Goats of the Gridiron Playoff League',
    calendar_month: 1, sport: 'NFL', strategy: 'ranked_ats_v1',
    mechanics: 'Ranked against-the-spread selections across the NFL playoffs',
    local_scoring_status: 'implemented_development',
    baas_status: 'awaiting_approved_conversion',
    notes: 'Super Bowl LXI: 59 ranked game points + 2 MVP bonus = 61. Push/missing/ties/deadlines still require policy approval.'
  }),
  Object.freeze({
    id: 'horns-and-hoops', name: 'Horns & Hoops',
    subtitle: "Downtown's BAAsketball Showcase XXXV",
    calendar_month: 3, sport: 'NCAA_MBB', strategy: 'ncaa_bracket_v1',
    mechanics: 'NCAA basketball bracket selections and round advancement',
    local_scoring_status: 'rules_pending', baas_status: 'awaiting_approved_conversion',
    notes: 'Round values, First Four handling, deadlines, score source and ties are not yet founder-approved.'
  }),
  Object.freeze({
    id: 'goat-crossover', name: 'GOAT Crossover', subtitle: 'Two Sports, 1 Competition',
    calendar_month: 4, sport: 'NBA_NHL', strategy: 'cross_sport_playoffs_v1',
    mechanics: 'Combined NBA and NHL playoff competition under one scoring format',
    local_scoring_status: 'rules_pending', baas_status: 'awaiting_approved_conversion',
    notes: 'Exactly one hybrid competition. NBA and NHL are not separate GOAT Games. Series-pick mechanics and scoring need approved sources.'
  }),
  Object.freeze({
    id: 'league-of-greatness', name: 'League of Greatness',
    subtitle: 'Fantasy Football Championships',
    calendar_month: 9, sport: 'NFL_FANTASY', strategy: 'fantasy_h2h_2026_v1',
    mechanics: '12-team head-to-head fantasy football with seven playoff berths',
    local_scoring_status: 'verified_structure', baas_status: 'awaiting_approved_conversion',
    notes: '2026 onward: 2-point home-field advantage already included in ESPN official team totals; do not double count. Week 14 last regular week, Week 15 Wildcat, Week 16 reseeded semifinals, Week 17 Bowl.'
  }),
  Object.freeze({
    id: 'goat-classic', name: 'The GOAT Classic', subtitle: 'Take your swing at history',
    calendar_month: 10, sport: 'MLB', strategy: 'mlb_postseason_v1',
    mechanics: 'MLB postseason competition',
    local_scoring_status: 'rules_pending', baas_status: 'awaiting_approved_conversion',
    notes: 'Bracket/picks, round weights, sources and tiebreaker must be confirmed before accepting real scores.'
  })
]);
const GAMES_BY_ID = new Map(GOAT_GAMES.map(g => [g.id, g]));
export function getGoatGame(id) { return GAMES_BY_ID.get(id) || null; }
export function publicCatalog() {
  return {
    title: 'THE GOAT GAMES',
    subtitle: 'Five Competitions. One Universe. One Annual Championship.',
    currency: 'Baas',
    official_annual_conversion_approved: false,
    competition_count: GOAT_GAMES.length,
    games: GOAT_GAMES.map(g => ({...g}))
  };
}
export function validateBaasPolicy(policy, expectedGameIds = GOAT_GAMES.map(g => g.id)) {
  if (!policy || typeof policy !== 'object' || policy.approved !== true) throw new Error('baas_policy_not_approved');
  if (typeof policy.source_reference !== 'string' || policy.source_reference.trim().length < 4) throw new Error('baas_source_required');
  if (!Number.isInteger(policy.season) || policy.season < 2026 || policy.season > 2100) throw new Error('baas_invalid_season');
  if (policy.tie_policy !== 'shared_rank' && policy.tie_policy !== 'commissioner_verified_rank') throw new Error('baas_tie_policy_required');
  if (!policy.conversions || typeof policy.conversions !== 'object' || Array.isArray(policy.conversions)) throw new Error('baas_conversions_required');
  const expected = [...new Set(expectedGameIds)].sort();
  if (expected.length !== GOAT_GAMES.length || expected.some(id => !GAMES_BY_ID.has(id))) throw new Error('baas_expected_games_invalid');
  if (Object.keys(policy.conversions).sort().join('|') !== expected.join('|')) throw new Error('baas_five_competitions_required');
  for (const id of expected) {
    const table = policy.conversions[id];
    if (!Array.isArray(table) || !table.length) throw new Error('baas_conversion_empty');
    if (table.length > 100000) throw new Error('baas_conversion_too_large');
    for (const value of table) if (!Number.isSafeInteger(value) || value < 0) throw new Error('baas_conversion_invalid');
    for (let i = 1; i < table.length; i++) if (table[i] > table[i - 1]) throw new Error('baas_order_invalid');
  }
  return true;
}
// No assumed points. A final verified finishing position is necessary before Baas can be awarded.
export function buildAnnualBaasStandings(policy, finishes) {
  validateBaasPolicy(policy);
  if (!Array.isArray(finishes)) throw new Error('baas_finishes_required');
  const unique = new Set(); const totals = new Map();
  for (const item of finishes) {
    if (!item || typeof item.member_id !== 'string' || !item.member_id ||
        !GAMES_BY_ID.has(item.game_id) || !Number.isInteger(item.place) || item.place <= 0)
      throw new Error('baas_finish_invalid');
    if (item.season !== policy.season || item.verified !== true || typeof item.evidence !== 'string' || !item.evidence.trim())
      throw new Error('baas_unverified_finish');
    const key = item.member_id + ':' + item.game_id;
    if (unique.has(key)) throw new Error('baas_duplicate_finish'); unique.add(key);
    const table = policy.conversions[item.game_id];
    if (item.place > table.length) throw new Error('baas_place_not_configured');
    const amount = table[item.place - 1];
    const current = totals.get(item.member_id) || { member_id: item.member_id, baas: 0, competitions: 0, breakdown: [] };
    current.baas += amount; current.competitions++;
    if (!Number.isSafeInteger(current.baas)) throw new Error('baas_total_overflow');
    current.breakdown.push({ game_id: item.game_id, place: item.place, baas: amount, evidence: item.evidence });
    totals.set(item.member_id, current);
  }
  return [...totals.values()].sort((a,b) => b.baas - a.baas || b.competitions - a.competitions || a.member_id.localeCompare(b.member_id));
}
// ESPN official 2026+ team totals already include home advantage.
export function homeAdjustedFantasyScore({ year, raw_player_points, is_home, source_includes_home_bonus = false }) {
  if (!Number.isInteger(year) || !Number.isFinite(raw_player_points) || typeof is_home !== 'boolean') throw new Error('fantasy_score_invalid');
  if (typeof source_includes_home_bonus !== 'boolean') throw new Error('fantasy_bonus_source_invalid');
  return raw_player_points + ((year >= 2026 && is_home && !source_includes_home_bonus) ? 2 : 0);
}
export function leagueOfGreatnessPlayoffSeeds(seeds) {
  if (!Array.isArray(seeds) || seeds.length !== 7 || new Set(seeds).size !== 7) throw new Error('fantasy_seven_unique_seeds_required');
  return {
    regular_season_final_week: 14,
    wildcat_week: 15,
    wildcat_bye: seeds[0],
    wildcat_matchups: [[seeds[1],seeds[6]],[seeds[2],seeds[5]],[seeds[3],seeds[4]]],
    semifinal_week: 16,
    semifinal_rule: 'reseed_highest_remaining',
    championship_week: 17
  };
}
