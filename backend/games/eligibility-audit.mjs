// Read-only duplicate-entry evidence for an integrated GOAT Universe release.
// A profile may belong to many leagues across sports/seasons, but the founder's
// ONE verified entry per official GOAT Game per season must not silently become
// two annual-championship finishes. This auditor does NOT enforce registration,
// identify two different accounts belonging to the same real person, or mutate DB.
import {GOAT_GAMES} from '../rules/goat-games.mjs';

const GAME_KEYS = new Set(GOAT_GAMES.map(game=>game.id));

/**
 * Input: trusted snapshots of leagues with optional approved entries:
 * [{league:{id,game_key,season},entries:[{user_id,status}]}].
 * Snapshots must cover all candidate leagues to certify absence of collisions.
 * Return counts only: never expose user IDs, email addresses or private records.
 */
export function auditApprovedEntryCollisions(snapshots) {
  if (!Array.isArray(snapshots) || snapshots.length>1000)
    throw new Error('invalid_entry_audit_input');
  const indexed=new Map();
  const groupsByGame=Object.fromEntries(GOAT_GAMES.map(game=>[game.id,0]));
  let reviewed=0,incomplete=0;
  for(const snapshot of snapshots){
    const league=snapshot?.league;
    if(!league||!GAME_KEYS.has(league.game_key))continue;
    if(!Array.isArray(snapshot.entries)){
      incomplete++;
      continue;
    }
    for(const entry of snapshot.entries){
      if(entry?.status!=='approved')continue;
      reviewed++;
      if(typeof league.id!=='string'||!league.id.trim()||
         !/^20\d\d$/.test(String(league.season))||
         typeof entry.user_id!=='string'||!entry.user_id.trim()){
        incomplete++;continue;
      }
      const key=JSON.stringify([league.game_key,String(league.season),entry.user_id]);
      if(!indexed.has(key))indexed.set(key,{game_key:league.game_key,leagues:new Set()});
      indexed.get(key).leagues.add(league.id);
    }
  }
  let collisionGroups=0;
  for(const record of indexed.values()){
    if(record.leagues.size>1){
      collisionGroups++;
      groupsByGame[record.game_key]++;
    }
  }
  return Object.freeze({
    approved_entries_inspected:reviewed,
    incomplete_entry_records:incomplete,
    duplicate_game_season_entry_groups:collisionGroups,
    conflicts_by_game:Object.freeze(groupsByGame),
    // False when the input is empty, incomplete or a partial selection.
    absence_of_collisions_certified:false
  });
}
