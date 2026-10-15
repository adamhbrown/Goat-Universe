import test from 'node:test';
import assert from 'node:assert/strict';
import {scoreVerifiedPredictions, fantasyHeadToHeadWinner, validatePredictionBatch} from '../rules/prediction-engines.mjs';

const locked_at='2027-03-15T17:00:00Z';
const submitted_at='2027-03-15T16:59:00Z';
const finalized_at='2027-03-16T00:00:00Z';
const event=(id,sport,round,winner='Team A')=>({
  id,sport,round,options:['Team A','Team B'],winner,locked_at,finalized_at,
  verified:true,evidence_url:'https://fixture.invalid/verified-final'
});
const pick=(member_id,event_id,selection,when=submitted_at)=>({
  member_id,event_id,selection,submitted_at:when
});
const policy=(game_id,points_by_sport)=>({
  game_id,season:2027,approved:true,source_reference:'Fixture competition rules for tests only',
  missing_policy:'block',tie_policy:'shared_rank',points_by_sport
});
test('Horns & Hoops scores sourced bracket winners with explicitly approved fixture weights',()=>{
  const p=policy('horns-and-hoops',{NCAA_MBB:{'First Round':2}});
  const args={game_id:'horns-and-hoops',season:2027,policy:p,
    participants:['alpha','bravo'],
    events:[event('g1','NCAA_MBB','First Round'),event('g2','NCAA_MBB','First Round','Team B')],
    predictions:[
      pick('alpha','g1','Team A'),pick('alpha','g2','Team B'),
      pick('bravo','g1','Team B'),pick('bravo','g2','Team A')
    ]};
  const board=scoreVerifiedPredictions(args);
  assert.deepEqual(board.map(x=>[x.member_id,x.points,x.correct,x.rank]),
    [['alpha',4,2,1],['bravo',0,0,2]]);
  assert.throws(()=>scoreVerifiedPredictions({...args,policy:{...p,approved:false}}),/goat_scoring_policy_not_approved/);
  assert.throws(()=>scoreVerifiedPredictions({...args,events:[{...args.events[0],verified:false},args.events[1]]}),/goat_event_unverified/);
  assert.throws(()=>scoreVerifiedPredictions({...args,predictions:[...args.predictions,pick('alpha','g1','Team A')]}),/goat_duplicate_prediction/);
  assert.throws(()=>scoreVerifiedPredictions({...args,predictions:[pick('alpha','g1','Team A',locked_at),...args.predictions.slice(1)]}),/goat_prediction_after_deadline/);
});
test('GOAT Crossover REQUIRES both NBA and NHL, and aggregates sport-specific sourced outcomes',()=>{
  const p=policy('goat-crossover',{NBA:{'Round One':3},NHL:{'Round One':5}});
  const games=[event('nba1','NBA','Round One'),event('nhl1','NHL','Round One')];
  const base={game_id:'goat-crossover',season:2027,policy:p,
    participants:['alpha','bravo'],events:games,
    predictions:[
      pick('alpha','nba1','Team A'),pick('alpha','nhl1','Team B'),
      pick('bravo','nba1','Team B'),pick('bravo','nhl1','Team A')
    ]};
  const board=scoreVerifiedPredictions(base);
  assert.equal(board[0].member_id,'bravo');assert.equal(board[0].points,5);
  assert.equal(board[1].member_id,'alpha');assert.equal(board[1].points,3);
  assert.throws(()=>scoreVerifiedPredictions({...base,events:[games[0]],predictions:[pick('alpha','nba1','Team A')]}),/goat_required_sport_missing/);
  assert.throws(()=>scoreVerifiedPredictions({...base,policy:{...p,points_by_sport:{NBA:{'Round One':3}}}}),/goat_scoring_matrix_invalid/);
});
test('GOAT Classic scores only verified MLB postseason series and handles point ties',()=>{
  const p=policy('goat-classic',{MLB:{'Division Series':7}});
  const base={game_id:'goat-classic',season:2027,policy:p,participants:['alpha','bravo'],
    events:[event('mlb1','MLB','Division Series')],
    predictions:[pick('alpha','mlb1','Team A'),pick('bravo','mlb1','Team A')]};
  const board=scoreVerifiedPredictions(base);
  assert.equal(board[0].points,7);assert.equal(board[1].points,7);
  assert.equal(board[0].rank,1);assert.equal(board[1].rank,1);
  assert.throws(()=>scoreVerifiedPredictions({...base,predictions:[base.predictions[0]]}),/goat_submissions_incomplete/);
  assert.throws(()=>scoreVerifiedPredictions({...base,events:[{...base.events[0],sport:'NBA'}]}),/goat_event_unverified/);
});
test('League of Greatness uses provider official fantasy scores without bonus twice',()=>{
  const result=fantasyHeadToHeadWinner({season:2026,home_team_id:'HOME',away_team_id:'AWAY',
    home_official_score:101.5,away_official_score:100});
  assert.equal(result.winner,'HOME');
  assert.equal(result.home_official_score,101.5);
  assert.match(result.note,/already contain/);
  const older=fantasyHeadToHeadWinner({season:2023,home_team_id:'HOME',away_team_id:'AWAY',
    home_official_score:100,away_official_score:101});
  assert.equal(older.winner,'AWAY');
  assert.match(older.note,/not retroactively/);
  assert.equal(fantasyHeadToHeadWinner({season:2026,home_team_id:'H',away_team_id:'A',home_official_score:100,away_official_score:100}).tied,true);
});


const nextTip='2027-04-16T18:00:00Z';
const earlyReceipt='2027-04-16T17:59:59Z';
const scheduled=(id,sport)=>({
  id,sport,round:'Opening',options:['First Club','Second Club'],
  locked_at:nextTip,source_url:'https://official.example.org/schedule'
});
const entryPolicy=(game_id,points_by_sport)=>policy(game_id,points_by_sport);

test('GOAT Crossover validates one member atomic pick batch using trusted server receipt and BOTH sports',()=>{
  const p=entryPolicy('goat-crossover',{NBA:{Opening:3},NHL:{Opening:5}});
  const events=[scheduled('NBA-1','NBA'),scheduled('NHL-1','NHL')];
  const base={game_id:'goat-crossover',season:2027,policy:p,member_id:'competitor-1',
    events,picks:[{event_id:'NBA-1',selection:'First Club'},{event_id:'NHL-1',selection:'Second Club'}],
    received_at:earlyReceipt};
  const original=JSON.stringify(base);
  const result=validatePredictionBatch(base);
  assert.equal(result.picks.length,2);
  assert.deepEqual(result.picks.map(x=>x.member_id),['competitor-1','competitor-1']);
  assert.equal(result.received_at,earlyReceipt);
  assert.equal(JSON.stringify(base),original,'input must remain unchanged');
  assert.equal(result.picks[0].selection,'First Club');
  // A participant may submit a partial batch; unselected future series can be entered later.
  assert.equal(validatePredictionBatch({...base,picks:[base.picks[0]]}).picks.length,1);
  assert.throws(()=>validatePredictionBatch({...base,events:[events[0]]}),/goat_required_sport_missing/);
  assert.throws(()=>validatePredictionBatch({...base,policy:{...p,approved:false}}),/goat_scoring_policy_not_approved/);
});

test('GOAT Classic rejects duplicates, invalid entrants, fabricated schedule, and nonexistent teams',()=>{
  const p=entryPolicy('goat-classic',{MLB:{Opening:7}});
  const base={game_id:'goat-classic',season:2027,policy:p,member_id:'competitor',
    events:[scheduled('MLB-1','MLB')],picks:[{event_id:'MLB-1',selection:'First Club'}],
    received_at:earlyReceipt};
  assert.equal(validatePredictionBatch(base).picks.length,1);
  assert.throws(()=>validatePredictionBatch({...base,picks:[...base.picks,base.picks[0]]}),/goat_entry_pick_invalid/);
  assert.throws(()=>validatePredictionBatch({...base,picks:[{event_id:'MLB-1',selection:'Third Club'}]}),/goat_entry_pick_invalid/);
  assert.throws(()=>validatePredictionBatch({...base,picks:[{event_id:'fictional',selection:'First Club'}]}),/goat_entry_pick_invalid/);
  assert.throws(()=>validatePredictionBatch({...base,member_id:''}),/goat_entry_input_invalid/);
  assert.throws(()=>validatePredictionBatch({...base,events:[{...base.events[0],source_url:'javascript:alert(1)'}]}),/goat_entry_schedule_invalid/);
  assert.throws(()=>validatePredictionBatch({...base,events:[{...base.events[0],options:['First Club','First Club']}]}),/goat_entry_schedule_invalid/);
  assert.throws(()=>validatePredictionBatch({...base,events:[{...base.events[0],sport:'NBA'}]}),/goat_entry_schedule_invalid/);
});

test('NFL-style deadline semantics: batch fails at lock or later, passes one second before lock',()=>{
  const p=entryPolicy('goat-classic',{MLB:{Opening:7}});
  const base={game_id:'goat-classic',season:2027,policy:p,member_id:'competitor',
    events:[scheduled('MLB-1','MLB')],picks:[{event_id:'MLB-1',selection:'Second Club'}],
    received_at:earlyReceipt};
  assert.equal(validatePredictionBatch(base).picks.length,1);
  assert.throws(()=>validatePredictionBatch({...base,received_at:nextTip}),/goat_prediction_after_deadline/);
  assert.throws(()=>validatePredictionBatch({...base,received_at:'2027-04-16T18:00:01Z'}),/goat_prediction_after_deadline/);
  assert.throws(()=>validatePredictionBatch({...base,received_at:'not a date'}),/goat_invalid_timestamp/);
  assert.throws(()=>validatePredictionBatch({...base,events:[{...base.events[0],locked_at:'invalid'}]}),/goat_invalid_timestamp/);
});
