// Read-only engineering audit of five *saved* GOAT Games snapshots.
// This is not an entry gate, data verifier, administrator approval, or launch command.
// It never reads credentials, touches a database, sends network requests, or writes scores.
import {GOAT_GAMES} from '../rules/goat-games.mjs';
import {setupProgress} from './overview.mjs';
import {auditApprovedEntryCollisions} from './eligibility-audit.mjs';

const KEYS = Object.freeze(GOAT_GAMES.map(game => game.id));
const SEASONS = /^20(?:2[6-9]|[3-9][0-9])$/;
const REQUIRES_EXTERNAL = Object.freeze([
  'Verified primary sports data and founder-signed rulebook for every competition',
  'Hosted Auth/RLS and cross-account acceptance on an isolated healthy target',
  'Proven backup/restore, secrets, abuse limits and deployment rollback',
  'Real-device accessibility and mobile performance acceptance',
  'Legal and commercial review before any paid participation or prizes',
  'Explicit Founder/CEO authorization before merge or production release'
]);

function seasonIsValid(value) {
  if (typeof value !== 'string' && typeof value !== 'number') return false;
  return SEASONS.test(String(value));
}
function isValidTimestamp(value) {
  if (typeof value !== 'string') return false;
  const m=/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(Z|[+-]\d{2}:\d{2})$/.exec(value);
  if (!m) return false;
  const year=Number(m[1]),month=Number(m[2]),day=Number(m[3]);
  const leap=year%4===0&&(year%100!==0||year%400===0);
  const days=[31,leap?29:28,31,30,31,30,31,31,30,31,30,31];
  if (month<1||month>12||day<1||day>days[month-1]||Number(m[4])>23||
      Number(m[5])>59||Number(m[6])>59) return false;
  if (m[7]!=='Z') {
    const h=Number(m[7].slice(1,3)),min=Number(m[7].slice(4,6));
    if(h>23||min>59)return false;
  }
  return Number.isFinite(Date.parse(value));
}
function validateSeasonMap(seasonByGame) {
  if (seasonByGame === undefined) return null;
  if (!seasonByGame || typeof seasonByGame !== 'object' || Array.isArray(seasonByGame) ||
      Object.keys(seasonByGame).sort().join('|') !== [...KEYS].sort().join('|') ||
      KEYS.some(key => !seasonIsValid(seasonByGame[key])))
    throw new Error('invalid_annual_season_map');
  // Founder/commissioner supplies the annual mapping; never assume the NFL's
  // season label is the same as the calendar year of its February championship.
  return seasonByGame;
}

// Global commissioner-league exclusivity is a business policy, not an implied
// technical rule. Accept only an explicitly founder-reviewed decision.
function validateEligibilityPolicy(policy) {
  if(policy === undefined) return null;
  if(!policy || policy.approved!==true ||
     !['allow_multiple_leagues','one_league_per_game_season'].includes(policy.mode) ||
     typeof policy.source_reference!=='string' || policy.source_reference.trim().length<4)
    throw new Error('eligibility_policy_approval_required');
  return policy.mode;
}

function recordedRulesAreComplete(rules) {
  return Boolean(rules && rules.approved === true &&
    Array.isArray(rules.unresolved) && rules.unresolved.length === 0 &&
    typeof rules.source_reference === 'string' && rules.source_reference.trim().length >= 4);
}

/**
 * @param {Array<object>} snapshots - sanitized individual league snapshots
 * supplied by a trusted commissioner-side read, never by a visitor's browser.
 * @returns {{status: string, data_prepared: boolean, can_launch: false,
 *            games: Array<object>, external_approvals_required: Array<string>}}
 */
export function auditFiveGameCandidate(snapshots, {seasonByGame,eligibilityPolicy} = {}) {
  if (!Array.isArray(snapshots) || snapshots.length > 100)
    throw new Error('invalid_competition_candidate');
  const expectedSeasons = validateSeasonMap(seasonByGame);
  const membershipMode=validateEligibilityPolicy(eligibilityPolicy);
  const eligibility=auditApprovedEntryCollisions(snapshots);
  // Exclusive membership can never be certified from incomplete or partial
  // snapshots. Count all malformed evidence, including unknown leagues.
  const exclusiveAuditIncomplete=membershipMode==='one_league_per_game_season' &&
    (eligibility.incomplete_entry_records>0 || !eligibility.absence_of_collisions_certified);
  const grouped = new Map(KEYS.map(key => [key, []]));
  let unknown = 0;
  for (const snap of snapshots) {
    const key = snap?.league?.game_key;
    if (typeof key !== 'string' || !grouped.has(key)) {
      unknown++;
      continue;
    }
    grouped.get(key).push(snap);
  }
  const games = KEYS.map(game_key => {
    const records = grouped.get(game_key);
    const issues = [];
    if (records.length !== 1) {
      issues.push(records.length === 0 ? 'missing_competition_snapshot' : 'duplicate_competition_snapshot');
      if(eligibility.conflicts_by_game[game_key]>0 && !membershipMode)
        issues.push('eligibility_policy_review_required');
      if(eligibility.conflicts_by_game[game_key]>0 && membershipMode==='one_league_per_game_season')
        issues.push('duplicate_approved_game_season_entry');
      return Object.freeze({game_key, saved_setup_complete:false, issues:Object.freeze(issues)});
    }
    const data = records[0];
    if(eligibility.conflicts_by_game[game_key]>0 && !membershipMode)
      issues.push('eligibility_policy_review_required');
    if(eligibility.conflicts_by_game[game_key]>0 && membershipMode==='one_league_per_game_season')
      issues.push('duplicate_approved_game_season_entry');
    // Only an approved exclusive-membership policy makes completeness a
    // blocking rule, and even complete snapshots never certify all users.
    if(membershipMode==='one_league_per_game_season' &&
       (!Array.isArray(data.entries) || data.entries.some(e=>!e || e.status==='approved' &&
         (typeof e.user_id!=='string'||!e.user_id.trim()||!data.league.id))))
      issues.push('entry_audit_incomplete');
    if (!seasonIsValid(data.league.season)) issues.push('invalid_season');
    if (expectedSeasons && seasonIsValid(data.league.season) &&
        Number(data.league.season) !== Number(expectedSeasons[game_key]))
      issues.push('annual_cycle_season_mismatch');
    if (game_key === 'horns-and-hoops' &&
        !isValidTimestamp(data.bracket_config?.main_lock_at))
      issues.push('invalid_main_bracket_lock');
    if (!recordedRulesAreComplete(data.league.rules)) issues.push('rules_or_source_not_approved');
    let observations = [];
    try {
      // Even a fully recorded setup is merely an observation; source truth
      // and commissioner permissions require independent verification.
      observations = setupProgress(data);
      if (!Array.isArray(observations) || observations.some(c => c.complete !== true))
        issues.push('saved_setup_incomplete');
    } catch {
      // Malformed, partial or stale snapshots must fail closed, not crash an audit.
      issues.push('malformed_saved_setup');
    }
    return Object.freeze({
      game_key, saved_setup_complete:issues.length === 0,
      observations_checked:observations.length,
      issues:Object.freeze(issues)
    });
  });
  const data_prepared = unknown === 0 && snapshots.length === KEYS.length &&
    !exclusiveAuditIncomplete && games.every(game => game.saved_setup_complete);
  // The distinction is intentional: even perfectly populated records are NOT
  // permissions to enroll, score, award currency, deploy, or activate payments.
  return Object.freeze({
    status:data_prepared?'manual_review_required':'blocked',
    data_prepared,
    can_launch:false,
    unknown_snapshots:unknown,
    season_mapping_checked:Boolean(expectedSeasons),
    eligibility_policy_reviewed:Boolean(membershipMode),
    eligibility_policy_mode:membershipMode||'not_decided',
    exclusive_membership_evidence_incomplete:exclusiveAuditIncomplete,
    // Counts only: never return raw profiles or member identifiers.
    member_eligibility_audit:eligibility,
    games:Object.freeze(games),
    external_approvals_required:REQUIRES_EXTERNAL
  });
}
