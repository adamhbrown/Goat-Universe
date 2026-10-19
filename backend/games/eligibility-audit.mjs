// Read-only evidence about multiple commissioner-league memberships for one
// GOAT account in the same official GOAT Game and season. This is NOT a rule
// forbidding those memberships: the founder has not selected a membership
// exclusivity policy. Do not mutate enrollment, invent rules or disclose IDs.
import {GOAT_GAMES} from '../rules/goat-games.mjs';

const GAME_KEYS = new Set(GOAT_GAMES.map(game=>game.id));
const SEASON = /^20\d\d$/;
const STATUSES = new Set(['approved','pending','rejected']);
const validId = x => typeof x==='string' && x.trim().length>0 && x.length<=150;

/**
 * Trusted commissioner-side snapshots of the leagues under examination.
 * [{league:{id,game_key,season},entries:[{user_id,status}]}]
 * Unknown records and missing entry collections are NOT treated as empty.
 *
 * These observations cover only supplied snapshots. They cannot demonstrate
 * that all leagues or unique natural persons were inspected. Only aggregate
 * counts are returned; no raw account IDs, league IDs, or emails escape.
 */
export function auditApprovedEntryCollisions(snapshots){
  if(!Array.isArray(snapshots)||snapshots.length>1000)
    throw new Error('invalid_entry_audit_input');
  const indexed=new Map();
  const groupsByGame=Object.fromEntries(GOAT_GAMES.map(g=>[g.id,0]));
  let reviewed=0,incomplete=0,scannedLeagues=0;
  for(const snapshot of snapshots){
    const league=snapshot?.league;
    if(!league||!GAME_KEYS.has(league.game_key)){
      incomplete++;continue;
    }
    scannedLeagues++;
    const validLeague=validId(league.id)&&SEASON.test(String(league.season));
    if(!validLeague)incomplete++;
    if(!Array.isArray(snapshot.entries)){
      incomplete++;continue;
    }
    for(const entry of snapshot.entries){
      if(!entry||!STATUSES.has(entry.status)){
        incomplete++;continue;
      }
      if(entry.status!=='approved')continue;
      reviewed++;
      if(!validLeague||!validId(entry.user_id)){
        incomplete++;continue;
      }
      const key=JSON.stringify([league.game_key,String(league.season),entry.user_id]);
      if(!indexed.has(key))indexed.set(key,{game_key:league.game_key,leagues:new Set()});
      indexed.get(key).leagues.add(league.id);
    }
  }
  let overlapping=0;
  for(const record of indexed.values()){
    if(record.leagues.size>1){
      overlapping++;
      groupsByGame[record.game_key]++;
    }
  }
  return Object.freeze({
    inspected_league_snapshots:scannedLeagues,
    approved_entries_inspected:reviewed,
    incomplete_entry_records:incomplete,
    duplicate_game_season_entry_groups:overlapping,
    conflicts_by_game:Object.freeze(groupsByGame),
    policy_decision_needed:overlapping>0,
    // A snapshot set is not a trusted, complete census of members or leagues.
    absence_of_collisions_certified:false
  });
}
