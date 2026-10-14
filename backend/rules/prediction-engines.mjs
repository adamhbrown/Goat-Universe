// Foundational event/series-prediction scorer for the three GOAT Games
// beyond NFL Playoffs and Fantasy. This is NOT an approved contest rulebook.
// No scoring can proceed without a caller-supplied, explicitly approved policy
// and final, sourced outcomes. This module creates no database or external calls.

const SPORT_REQUIREMENTS = Object.freeze({
  'horns-and-hoops': Object.freeze(['NCAA_MBB']),
  'goat-crossover': Object.freeze(['NBA','NHL']),
  'goat-classic': Object.freeze(['MLB'])
});
function fail(code) { throw new Error(code); }
function identity(value) {
  return typeof value === 'string' && value.trim() && value.length <= 150;
}
function timestamp(value) {
  const parts = typeof value === 'string' && /^(\d{4})-(\d\d)-(\d\d)T(\d\d):(\d\d):(\d\d)(?:\.\d+)?(?:Z|[+-]\d\d:\d\d)$/.exec(value);
  if (!parts) fail('goat_invalid_timestamp');
  const [, year, month, day, hour, minute, second] = parts.map(Number);
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const days = [31,leap ? 29 : 28,31,30,31,30,31,31,30,31,30,31];
  // Date.parse silently normalizes February 30 and 24:00 into another date.
  // A normalized, nonexistent deadline must never authorize a submission.
  if (month < 1 || month > 12 || day < 1 || day > days[month-1] || hour > 23 || minute > 59 || second > 59)
    fail('goat_invalid_timestamp');
  const time = Date.parse(value);
  if (!Number.isFinite(time)) fail('goat_invalid_timestamp');
  return time;
}
function httpsEvidence(value) {
  if (typeof value !== 'string' || /\s/.test(value)) return false;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && Boolean(url.hostname) && !url.username && !url.password;
  } catch { return false; }
}
function verifyPolicy(gameId, season, policy) {
  const required = SPORT_REQUIREMENTS[gameId];
  if (!required) fail('goat_game_not_supported');
  if (!policy || policy.approved !== true || policy.game_id !== gameId ||
      policy.season !== season || !Number.isInteger(season) || season < 2026 ||
      !identity(policy.source_reference)) fail('goat_scoring_policy_not_approved');
  if (!['block','zero'].includes(policy.missing_policy) || policy.tie_policy !== 'shared_rank')
    fail('goat_missing_or_tie_policy_not_approved');
  const matrix = policy.points_by_sport;
  if (!matrix || typeof matrix !== 'object' || Array.isArray(matrix) ||
      Object.keys(matrix).sort().join('|') !== [...required].sort().join('|'))
    fail('goat_scoring_matrix_invalid');
  for (const sport of required) {
    const weights = matrix[sport];
    if (!weights || typeof weights !== 'object' || Array.isArray(weights) || !Object.keys(weights).length)
      fail('goat_scoring_matrix_invalid');
    for (const points of Object.values(weights))
      if (!Number.isSafeInteger(points) || points < 0) fail('goat_scoring_points_invalid');
  }
  return required;
}
/**
 * Synthetic input schema:
 * participants: member id strings;
 * events: [{id,sport,round,options:[sideA,sideB],winner,locked_at,finalized_at,verified,evidence_url}];
 * predictions: [{member_id,event_id,selection,submitted_at}].
 *
 * Event may mean a single NCAA tournament game, or an NBA/NHL/MLB playoff
 * series. The supplied round and weights must match a reviewed season rulebook.
 */
export function scoreVerifiedPredictions({game_id,season,policy,participants,events,predictions}) {
  const sports = verifyPolicy(game_id,season,policy);
  if (!Array.isArray(participants) || !participants.length || !Array.isArray(events) ||
      !events.length || !Array.isArray(predictions)) fail('goat_scoring_input_invalid');
  if (participants.some(x=>!identity(x)) || new Set(participants).size!==participants.length)
    fail('goat_participant_invalid');
  const eventLookup = new Map(), seenSports = new Set();
  for (const event of events) {
    if (!event || !identity(event.id) || eventLookup.has(event.id) ||
        !sports.includes(event.sport) || !identity(event.round) ||
        !Object.hasOwn(policy.points_by_sport[event.sport],event.round) ||
        !Array.isArray(event.options) || event.options.length !== 2 ||
        event.options.some(x=>!identity(x)) || new Set(event.options).size!==2 ||
        !event.options.includes(event.winner) || event.verified !== true ||
        !httpsEvidence(event.evidence_url))
      fail('goat_event_unverified');
    if (timestamp(event.finalized_at) < timestamp(event.locked_at)) fail('goat_result_before_lock');
    seenSports.add(event.sport);
    eventLookup.set(event.id,event);
  }
  // A GOAT Crossover title must depend on BOTH sports; not a disguised NBA-only pool.
  if (sports.some(sport=>!seenSports.has(sport))) fail('goat_required_sport_missing');
  const members = new Map(participants.map(member_id=>[member_id,{
    member_id,points:0,correct:0,entered:0,breakdown:[]
  }]));
  const picks = new Set();
  for (const p of predictions) {
    if (!p || !identity(p.member_id) || !members.has(p.member_id) ||
        !identity(p.event_id) || !eventLookup.has(p.event_id)) fail('goat_prediction_invalid');
    const key = JSON.stringify([p.member_id,p.event_id]);
    if (picks.has(key)) fail('goat_duplicate_prediction');
    picks.add(key);
    const event = eventLookup.get(p.event_id);
    if (!event.options.includes(p.selection)) fail('goat_prediction_invalid');
    if (timestamp(p.submitted_at) >= timestamp(event.locked_at)) fail('goat_prediction_after_deadline');
    const scored = members.get(p.member_id);
    const correct = event.winner === p.selection;
    const points = correct ? policy.points_by_sport[event.sport][event.round] : 0;
    scored.points += points;
    if (!Number.isSafeInteger(scored.points)) fail('goat_scoring_overflow');
    scored.entered++;
    if(correct)scored.correct++;
    scored.breakdown.push({event_id:event.id,sport:event.sport,round:event.round,correct,points,evidence_url:event.evidence_url});
  }
  if (policy.missing_policy === 'block' && [...members.values()].some(x=>x.entered!==events.length))
    fail('goat_submissions_incomplete');
  let rank = 0, previous = null;
  return [...members.values()].sort((a,b)=>b.points-a.points || a.member_id.localeCompare(b.member_id))
    .map((row,index)=>{
      if(row.points!==previous)rank=index+1;
      previous=row.points;
      return {...row,rank};
    });
}


/**
 * Prepare one participant's submitted picks for a future GOAT Game.
 * Unlike scoreVerifiedPredictions, outcomes are NOT needed at entry time.
 *
 * The caller MUST supply received_at from its own trusted server clock, not
 * from the participant/browser. Production database commands must still check
 * lock times transactionally to prevent races. No pick is written here.
 * A partial batch is allowed because individual games/series lock separately.
 */
export function validatePredictionBatch({game_id,season,policy,member_id,events,picks,received_at}) {
  const requiredSports=verifyPolicy(game_id,season,policy);
  if (!identity(member_id) || !Array.isArray(events) || !events.length ||
      !Array.isArray(picks) || !picks.length) fail('goat_entry_input_invalid');
  const acceptedAt=timestamp(received_at);
  const eventLookup=new Map(), coveredSports=new Set();
  for (const event of events) {
    if (!event || !identity(event.id) || eventLookup.has(event.id) ||
        !requiredSports.includes(event.sport) || !identity(event.round) ||
        !Object.hasOwn(policy.points_by_sport[event.sport],event.round) ||
        !Array.isArray(event.options) || event.options.length!==2 ||
        event.options.some(x=>!identity(x)) ||
        new Set(event.options).size!==2 ||
        !httpsEvidence(event.source_url))
      fail('goat_entry_schedule_invalid');
    timestamp(event.locked_at);
    eventLookup.set(event.id,event);
    coveredSports.add(event.sport);
  }
  // GOAT Crossover must always be configured with NBA and NHL events.
  if (requiredSports.some(sport=>!coveredSports.has(sport)))
    fail('goat_required_sport_missing');
  const seen=new Set(), sanitized=[];
  for (const pick of picks) {
    if (!pick || !identity(pick.event_id) || !eventLookup.has(pick.event_id) ||
        seen.has(pick.event_id)) fail('goat_entry_pick_invalid');
    seen.add(pick.event_id);
    const event=eventLookup.get(pick.event_id);
    if (!event.options.includes(pick.selection)) fail('goat_entry_pick_invalid');
    if (acceptedAt>=timestamp(event.locked_at)) fail('goat_prediction_after_deadline');
    sanitized.push({member_id,event_id:pick.event_id,selection:pick.selection});
  }
  // All-or-nothing validation: return a new sanitized batch only after every
  // pick is checked. Do not mutate caller objects or accept browser timestamps.
  return {game_id,season,received_at,picks:sanitized};
}

export function fantasyHeadToHeadWinner({season,home_team_id,away_team_id,home_official_score,away_official_score}) {
  if (!Number.isInteger(season) || season<2019 ||
      !identity(home_team_id) || !identity(away_team_id) || home_team_id===away_team_id ||
      !Number.isFinite(home_official_score) || !Number.isFinite(away_official_score) ||
      home_official_score<0 || away_official_score<0) fail('goat_fantasy_matchup_invalid');
  // ESPN official 2026+ home scores already have the two-point advantage.
  return {season,home_team_id,away_team_id,home_official_score,away_official_score,
    winner:home_official_score>away_official_score?home_team_id:
      away_official_score>home_official_score?away_team_id:null,
    tied:home_official_score===away_official_score,
    note:season >= 2026 ? 'Official 2026+ home scores already contain the two-point home advantage.' : 'Historical official scores are not retroactively adjusted.'};
}
