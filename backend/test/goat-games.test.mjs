import test from 'node:test';
import assert from 'node:assert/strict';
import { GOAT_GAMES, publicCatalog, getGoatGame, validateBaasPolicy, buildAnnualBaasStandings, homeAdjustedFantasyScore, leagueOfGreatnessPlayoffSeeds } from '../rules/goat-games.mjs';

function examplePolicy() {
  // TEST FIXTURE ONLY: These values are not official Baas allocations.
  return { approved:true, season:2027, source_reference:'A fixture policy explicitly approved for tests only',
    tie_policy:'shared_rank',
    conversions:Object.fromEntries(GOAT_GAMES.map(g=>[g.id,[100,90,80,70,60]])) };
}

test('exactly five GOAT Games, one combined NBA/NHL hybrid, and no implied Baas policy',()=>{
  const ids=GOAT_GAMES.map(g=>g.id);
  assert.equal(ids.length,5);
  assert.equal(new Set(ids).size,5);
  assert.equal(GOAT_GAMES.filter(g=>g.sport==='NBA_NHL').length,1);
  assert.equal(GOAT_GAMES.some(g=>g.id==='nba-only' || g.id==='nhl-only'),false);
  assert.equal(publicCatalog().official_annual_conversion_approved,false);
  assert.equal(publicCatalog().competition_count,5);
  assert.equal(getGoatGame('first-and-baa').strategy,'ranked_ats_v1');
  assert.equal(getGoatGame('not-a-game'),null);
  assert.deepEqual(ids,['first-and-baa','horns-and-hoops','goat-crossover','league-of-greatness','goat-classic']);
});

test('Baas accumulation is blocked without reviewed policy, complete five-game tables, and audited final places',()=>{
  const p=examplePolicy();
  assert.throws(()=>validateBaasPolicy({...p,approved:false}),/baas_policy_not_approved/);
  assert.throws(()=>validateBaasPolicy({...p,source_reference:''}),/baas_source_required/);
  assert.throws(()=>validateBaasPolicy({...p,conversions:{...p.conversions,'goat-crossover':undefined}}),/baas_conversion_empty/);
  assert.throws(()=>validateBaasPolicy({...p,conversions:{...p.conversions,'goat-classic':[10,20]}}),/baas_order_invalid/);
  validateBaasPolicy(p);
  assert.throws(()=>validateBaasPolicy({...p,tie_policy:'commissioner_verified_rank'}),/baas_tie_policy_not_implemented/);
  const finish=(member_id,game_id,place)=>({member_id,game_id,place,season:2027,verified:true,evidence:'https://fixture.invalid/results'});
  const finished=[finish('A','first-and-baa',1),finish('B','first-and-baa',2),finish('B','goat-crossover',1)];
  const board=buildAnnualBaasStandings(p,finished);
  assert.equal(board.length,2);
  assert.equal(board[0].member_id,'B');
  assert.equal(board[0].baas,190);
  assert.equal(board[0].competitions,2);
  assert.equal(board[0].rank,1);
  assert.equal(board[1].baas,100);
  const tiePolicy=examplePolicy();
  tiePolicy.conversions['goat-crossover']=[10,9,8,7,0];
  const tied = buildAnnualBaasStandings(tiePolicy,[finish('A','first-and-baa',1),finish('B','first-and-baa',2),finish('B','goat-crossover',1)]);
  assert.equal(tied[0].baas,100);
  assert.equal(tied[1].baas,100);
  assert.equal(tied[0].rank,1);
  assert.equal(tied[1].rank,1);
  assert.notEqual(tied[0].competitions,tied[1].competitions);
  assert.throws(()=>buildAnnualBaasStandings(p,[finished[0],finished[0]]),/baas_duplicate_finish/);
  assert.throws(()=>buildAnnualBaasStandings(p,[{...finished[0],verified:false}]),/baas_unverified_finish/);
  assert.throws(()=>buildAnnualBaasStandings(p,[finish('A','first-and-baa',10)]),/baas_place_not_configured/);
});

test('League of Greatness 2026 home bonus never double-counts official ESPN totals',()=>{
  assert.equal(homeAdjustedFantasyScore({year:2025,raw_player_points:100,is_home:true}),100);
  assert.equal(homeAdjustedFantasyScore({year:2026,raw_player_points:100,is_home:true}),102);
  assert.equal(homeAdjustedFantasyScore({year:2026,raw_player_points:102,is_home:true,source_includes_home_bonus:true}),102);
  assert.equal(homeAdjustedFantasyScore({year:2026,raw_player_points:100,is_home:false}),100);
  assert.equal(homeAdjustedFantasyScore({year:2027,raw_player_points:90.25,is_home:true}),92.25);
});

test('League of Greatness seven-seed Wildcat playoffs are week 15, reseed week 16, final week 17',()=>{
  const b=leagueOfGreatnessPlayoffSeeds([1,2,3,4,5,6,7]);
  assert.equal(b.regular_season_final_week,14);
  assert.equal(b.wildcat_bye,1);
  assert.deepEqual(b.wildcat_matchups,[[2,7],[3,6],[4,5]]);
  assert.equal(b.semifinal_week,16);
  assert.equal(b.championship_week,17);
  assert.throws(()=>leagueOfGreatnessPlayoffSeeds([1,2,3,4,5,6,6]),/fantasy_seven_unique_seeds_required/);
});
