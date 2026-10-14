import test,{before,after} from 'node:test';
import assert from 'node:assert/strict';
import {LocalDatabase} from '../database.mjs';
import {LocalAuth} from '../auth.mjs';

let db,owner,members,outsider;
const command=(p,actor=owner)=>db.rpc('goat_command',p,actor);
const query=(p,actor=owner)=>db.rpc('goat_query',p,actor);
const past=new Date(Date.now()-86400000).toISOString();
const source='https://fixture.invalid/espn-export';
before(async()=>{
 db=await new LocalDatabase().init();const auth=new LocalAuth(db);
 const users=[];for(let i=0;i<14;i++)users.push((await auth.signup({email:`fantasy${i}@fixture.invalid`,password:'Fantasy-Fixture-Password-1234'})).user.id);
 [owner,outsider,...members]=users;
});
after(async()=>db.close());
async function setup(year=2026){
 const league=await command({op:'game_draft_create',game_key:'league-of-greatness',name:'SYNTHETIC FANTASY SEASON',season:String(year)});
 const teams=[];
 for(let i=0;i<12;i++)teams.push((await command({op:'fantasy_team_create',league_id:league.id,user_id:members[i],franchise_key:`FIXTURE-FRANCHISE-${i}`,external_team_id:String(i),name:`FIXTURE TEAM ${i}`,source_url:source})).id);
 const matchups=[];
 for(let week=1;week<=14;week++)for(let i=0;i<6;i++)matchups.push({week,home_id:teams[i*2],away_id:teams[i*2+1],starts_at:past,source_url:source});
 return {league,teams,matchups};
}
async function open(f){
 await command({op:'fantasy_schedule_import',league_id:f.league.id,matchups:f.matchups});
 await command({op:'fantasy_open',league_id:f.league.id,approved:true,source_reference:'Verified architecture; SYNTHETIC fixture schedule and roster'});
 return (await query({op:'league',league_id:f.league.id})).fantasy_matchups;
}
const result=m=>({matchup_id:m.id,home_score:100.25,away_score:90.5,source_includes_home_bonus:true,verified:true,source_url:source});
const schedule=(pairs)=>pairs.map(([home_id,away_id])=>({home_id,away_id,starts_at:past,source_url:source}));

test('12-team, 14-week source imports are atomic and reject duplicate weekly opponents and foreign franchises',async()=>{
 const f=await setup();
 await assert.rejects(command({op:'fantasy_team_create',league_id:f.league.id}),/fantasy_twelve_teams_required/);
 await assert.rejects(command({op:'fantasy_open',league_id:f.league.id,approved:true,source_reference:'fixture'}),/fantasy_season_incomplete/);
 await assert.rejects(command({op:'fantasy_schedule_import',league_id:f.league.id,matchups:f.matchups.slice(1)}),/fantasy_14_week_schedule_required/);
 const duplicate=f.matchups.map((m,i)=>i===1?{...m,home_id:f.teams[0],away_id:f.teams[3]}:m);
 await assert.rejects(command({op:'fantasy_schedule_import',league_id:f.league.id,matchups:duplicate}),/fantasy_week_pairing_invalid/);
 assert.equal((await query({op:'league',league_id:f.league.id})).fantasy_matchups.length,0);
 const g=await setup(2025);
 await assert.rejects(command({op:'fantasy_schedule_import',league_id:f.league.id,matchups:f.matchups.map((m,i)=>i===83?{...m,away_id:g.teams[0]}:m)}),/fantasy_matchup_teams_invalid/);
 const games=await open(f);assert.equal(games.length,84);
 const view=await query({op:'league',league_id:f.league.id},members[0]);assert.equal(view.fantasy_teams.length,12);assert.equal(view.entries.length,12);
 await assert.rejects(query({op:'league',league_id:f.league.id},outsider),/league_access_denied/);
 await assert.rejects(command({op:'fantasy_team_create',league_id:f.league.id}),/roster_frozen/);
});

test('ESPN official totals never double-count home bonus; raw totals add two only from 2026; evidence is mandatory',async()=>{
 for(const year of [2025,2026]){
  const f=await setup(year),games=await open(f);
  const base={home_score:100,away_score:101,verified:true,source_url:source};
  await assert.rejects(command({op:'fantasy_result',matchup_id:games[0].id,...base}),/verified_fantasy_scores_required/);
  await command({op:'fantasy_result',matchup_id:games[0].id,...base,source_includes_home_bonus:true});
  await command({op:'fantasy_result',matchup_id:games[1].id,...base,source_includes_home_bonus:false});
  const view=await query({op:'league',league_id:f.league.id});
  const official=view.fantasy_matchups.find(m=>m.id===games[0].id),raw=view.fantasy_matchups.find(m=>m.id===games[1].id);
  assert.equal(Number(official.home_score),100);assert.equal(official.home_bonus_applied,0);
  assert.equal(Number(raw.home_score),year>=2026?102:100);assert.equal(raw.home_bonus_applied,year>=2026?2:0);
  await assert.rejects(command({op:'fantasy_result',matchup_id:games[2].id,...base,source_includes_home_bonus:true,verified:false}),/verified_fantasy_scores_required/);
  await assert.rejects(command({op:'fantasy_result',matchup_id:games[2].id,...base,home_score:-1,source_includes_home_bonus:false}),/check constraint/);
  await assert.rejects(command({op:'fantasy_result',matchup_id:games[0].id,...base,source_includes_home_bonus:true}),/correction_required/);
 }
});

test('complete fantasy season tracks records, seven supplied seeds, Wildcat upsets, Week 16 reseeding and Week 17 title',async()=>{
 const f=await setup(),games=await open(f),lid=f.league.id;
 const imports=games.map(result);
 await assert.rejects(command({op:'fantasy_results_import',league_id:lid,results:imports.map((m,i)=>i===83?{...m,source_url:'javascript:bad'}:m)}),/check constraint/);
 assert.equal((await query({op:'history',league_id:lid})).length,0);
 await command({op:'fantasy_results_import',league_id:lid,results:imports});
 const records=await query({op:'standings',league_id:lid},members[0]);
 assert.ok(records.every(r=>Number(r.played)===14));assert.ok(records.every(r=>r.rank===null&&r.seed===null),'No implicit record or playoff tiebreaker');
 assert.equal(Number(records.find(r=>r.team_id===f.teams[0]).wins),14);
 assert.equal(Number(records.find(r=>r.team_id===f.teams[0]).points_for),14*100.25);
 await assert.rejects(command({op:'fantasy_playoffs_seed',league_id:lid,team_ids:f.teams.slice(0,7),source_url:source}),/verified_fantasy_seeds_required/);
 await command({op:'fantasy_playoffs_seed',league_id:lid,team_ids:f.teams.slice(0,7),source_url:source,verified:true});
 const t=f.teams;
 await assert.rejects(command({op:'fantasy_playoff_round',league_id:lid,week:15,schedule:schedule([[t[0],t[6]],[t[2],t[5]],[t[3],t[4]]])}),/fantasy_playoff_pairing_invalid/);
 await command({op:'fantasy_playoff_round',league_id:lid,week:15,schedule:schedule([[t[1],t[6]],[t[2],t[5]],[t[3],t[4]]])});
 const wildcat=(await query({op:'league',league_id:lid})).fantasy_matchups.filter(m=>m.week===15);
 assert.equal(wildcat.length,3);assert.ok(wildcat.every(m=>m.home_id!==t[0]&&m.away_id!==t[0]),'Seed one receives the bye');
 for(const m of wildcat)await command({op:'fantasy_result',...result(m),home_score:90,away_score:100});
 await assert.rejects(command({op:'fantasy_playoff_round',league_id:lid,week:16,schedule:schedule([[t[0],t[4]],[t[5],t[6]]])}),/fantasy_playoff_pairing_invalid/);
 // Home designation follows the supplied schedule, not an invented high-seed-home policy.
 await command({op:'fantasy_playoff_round',league_id:lid,week:16,schedule:schedule([[t[6],t[0]],[t[4],t[5]]])});
 const semi=(await query({op:'league',league_id:lid})).fantasy_matchups.filter(m=>m.week===16);
 for(const m of semi)await command({op:'fantasy_result',...result(m),home_score:90,away_score:100});
 await command({op:'fantasy_playoff_round',league_id:lid,week:17,schedule:schedule([[t[0],t[5]]])});
 const final=(await query({op:'league',league_id:lid})).fantasy_matchups.find(m=>m.week===17);
 await assert.rejects(command({op:'fantasy_finalize',league_id:lid}),/fantasy_championship_incomplete/);
 await command({op:'fantasy_result',...result(final)});
 const board=await query({op:'standings',league_id:lid});
 assert.equal(board.find(r=>r.team_id===t[0]).rank,1);assert.equal(board.find(r=>r.team_id===t[5]).rank,2);
 assert.equal(board.filter(r=>r.rank===null).length,10,'Unapproved places 3–12 remain unresolved');
 await command({op:'fantasy_finalize',league_id:lid});
 assert.equal((await query({op:'league',league_id:lid})).league.status,'final');
 await assert.rejects(command({op:'fantasy_correct',matchup_id:final.id,reason:'rewrite champion'}),/league_final/);
});

test('tied playoff scores block advancement; sourced corrections preserve history and invalidate dependent rounds and seeds',async()=>{
 const f=await setup(),games=await open(f),lid=f.league.id,t=f.teams;
 await command({op:'fantasy_results_import',league_id:lid,results:games.map(result)});
 await command({op:'fantasy_playoffs_seed',league_id:lid,team_ids:t.slice(0,7),source_url:source,verified:true});
 await command({op:'fantasy_playoff_round',league_id:lid,week:15,schedule:schedule([[t[1],t[6]],[t[2],t[5]],[t[3],t[4]]])});
 const wild=(await query({op:'league',league_id:lid})).fantasy_matchups.filter(m=>m.week===15);
 for(const m of wild)await command({op:'fantasy_result',...result(m),home_score:100,away_score:100});
 await assert.rejects(command({op:'fantasy_playoff_round',league_id:lid,week:16,schedule:[]}),/fantasy_decisive_playoff_results_required/);
 const before=await query({op:'history',league_id:lid});
 await command({op:'fantasy_correct',matchup_id:games[0].id,reason:'TEST provider correction'});
 const view=await query({op:'league',league_id:lid});assert.equal(view.fantasy_seeds.length,0);assert.equal(view.fantasy_matchups.filter(m=>m.week>14).length,0);
 assert.deepEqual((await query({op:'history',league_id:lid}))[0],before[0]);
 await assert.rejects(command({op:'fantasy_result',...result(games[0]),league_id:lid,owner_id:outsider},outsider),/commissioner_required/);
 await assert.rejects(db.exclusive(()=>db.db.transaction(async tx=>{await tx.exec('set local role authenticated');await tx.query("select set_config('request.jwt.claim.sub',$1,true)",[members[0]]);return tx.query('update public.goat_fantasy_matchups set home_score=999');})),/permission denied/);
});
