// All examples in this suite are synthetic offline data, not official schedules,
// player identities, approvals, competition results or release authorizations.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {GOAT_GAMES} from '../rules/goat-games.mjs';
import {auditFiveGameCandidate} from '../games/release-gates.mjs';

const ids=GOAT_GAMES.map(game=>game.id);
const rulebook=JSON.parse(await readFile(new URL('../rules/nfl-playoffs-61.json', import.meta.url),'utf8'));

function fixture(game_key) {
  const data={
    league:{game_key,season:2027,status:'draft',
      rules:{approved:true,unresolved:[],source_reference:'SYNTHETIC-TEST-SOURCE'}},
    rounds:[],games:[],bracket_nodes:[],fantasy_teams:[],fantasy_matchups:[],
    series_events:[],series_config:{policy:{approved:true,source_reference:'SYNTHETIC-TEST-SOURCE'}}
  };
  if(game_key==='first-and-baa') {
    data.rounds=rulebook.round_templates.map((r,i)=>({...r,id:'R'+i}));
    data.games=data.rounds.flatMap(r=>r.weights.map((_,i)=>({id:r.id+'G'+i,round_id:r.id})));
  } else if(game_key==='horns-and-hoops') {
    data.bracket_config={main_lock_at:'2027-03-18T12:00:00Z'};
    data.bracket_nodes=[32,16,8,4,2,1].flatMap((count,i)=>Array.from({length:count},()=>({stage:i+1})));
  } else if(game_key==='league-of-greatness') {
    data.fantasy_teams=Array.from({length:12},(_,i)=>({id:'T'+i}));
    data.fantasy_matchups=Array.from({length:14},(_,w)=>Array.from({length:6},(_,i)=>({
      week:w+1, home_id:'T'+(i*2), away_id:'T'+(i*2+1)
    }))).flat();
  } else data.series_events=(game_key==='goat-crossover'?['NBA','NHL']:['MLB']).map(sport=>({sport}));
  return data;
}
const prepared=()=>ids.map(fixture);

test('five-game audit begins blocked for missing and duplicate snapshots',()=>{
  const empty=auditFiveGameCandidate([]);
  assert.equal(empty.status,'blocked');assert.equal(empty.can_launch,false);
  assert.deepEqual(empty.games.map(g=>g.game_key),ids);
  assert.ok(empty.games.every(g=>g.issues.includes('missing_competition_snapshot')));
  const duplicate=auditFiveGameCandidate([fixture(ids[0]),fixture(ids[0]),...ids.slice(1).map(fixture)]);
  assert.equal(duplicate.status,'blocked');
  assert.ok(duplicate.games[0].issues.includes('duplicate_competition_snapshot'));
  const unexpected=auditFiveGameCandidate([...prepared(),{league:{game_key:'not-a-real-goat-game'}}]);
  assert.equal(unexpected.status,'blocked');assert.equal(unexpected.unknown_snapshots,1);
  for(const malformed of [null,{},undefined,{league:{game_key:42}}]){
    const result=auditFiveGameCandidate([...prepared(),malformed]);
    assert.equal(result.status,'blocked');
    assert.equal(result.unknown_snapshots,1);
  }
  for(const bad of [null,{},Array(101).fill({})]) assert.throws(()=>auditFiveGameCandidate(bad),/invalid_competition_candidate/);
});

test('complete synthetic data can only reach manual review, never authorize launch',()=>{
  const report=auditFiveGameCandidate(prepared().reverse());
  assert.equal(report.status,'manual_review_required');
  assert.equal(report.data_prepared,true);
  assert.equal(report.can_launch,false);
  assert.equal(report.games.length,5);
  assert.ok(report.games.every(g=>g.saved_setup_complete&&g.observations_checked>=3&&!g.issues.length));
  assert.ok(report.external_approvals_required.some(v=>/CEO authorization/.test(v)));
  assert.ok(report.external_approvals_required.some(v=>/Hosted Auth\/RLS/.test(v)));
  assert.ok(Object.isFrozen(report));
  assert.ok(Object.isFrozen(report.games));
  assert.doesNotMatch(JSON.stringify(report),/SYNTHETIC-TEST-SOURCE|T0|approved_by|access_token/i);
});

test('all five competitions require actual recorded structures and cannot claim readiness from only approved flags',()=>{
  for(const key of ids){
    const snapshots=prepared(),item=snapshots.find(x=>x.league.game_key===key);
    if(key==='first-and-baa') item.games.pop();
    if(key==='horns-and-hoops') item.bracket_nodes.pop();
    if(key==='league-of-greatness') item.fantasy_matchups.pop();
    if(key==='goat-crossover') item.series_events.pop();
    if(key==='goat-classic') item.series_config.policy.approved=false;
    const report=auditFiveGameCandidate(snapshots);
    assert.equal(report.status,'blocked',key);
    assert.ok(report.games.find(g=>g.game_key===key).issues.includes('saved_setup_incomplete'),key);
  }
});

test('missing founder rule signoff, unresolved items and source reference always block the candidate',()=>{
  for(const change of [
    rules=>{rules.approved=false;},
    rules=>{rules.unresolved=['PUSH POLICY PENDING'];},
    rules=>{rules.unresolved=undefined;},
    rules=>{rules.source_reference='';},
    rules=>{rules.source_reference='  ';}
  ]) {
    const snapshots=prepared();change(snapshots[0].league.rules);
    const report=auditFiveGameCandidate(snapshots);
    assert.equal(report.status,'blocked');
    assert.ok(report.games[0].issues.includes('rules_or_source_not_approved'));
    assert.equal(report.can_launch,false);
  }
});

test('malformed timestamps, invalid season and damaged saved snapshots fail closed without exception',()=>{
  const snapshots=prepared();
  snapshots[0].league.season=2025;
  snapshots[1].bracket_config.main_lock_at='nonsense';
  snapshots[2].series_events='bad';
  snapshots[3].fantasy_teams=null;
  snapshots[4].series_config=null;
  const report=auditFiveGameCandidate(snapshots);
  assert.equal(report.status,'blocked');assert.equal(report.can_launch,false);
  assert.ok(report.games[0].issues.includes('invalid_season'));
  for(const key of ids.slice(1)) assert.ok(report.games.find(g=>g.game_key===key).issues.length>0,key);
});

test('founder-supplied annual season map detects unintended cross-season attachments without assuming labels',()=>{
  const mapping=Object.fromEntries(ids.map(game=>[game,2027]));
  const preparedReport=auditFiveGameCandidate(prepared(),{seasonByGame:mapping});
  assert.equal(preparedReport.season_mapping_checked,true);
  assert.equal(preparedReport.data_prepared,true);
  assert.equal(preparedReport.can_launch,false);
  const differentSeason=prepared();
  differentSeason[0].league.season=2026;
  const blocked=auditFiveGameCandidate(differentSeason,{seasonByGame:mapping});
  assert.equal(blocked.status,'blocked');
  assert.ok(blocked.games[0].issues.includes('annual_cycle_season_mismatch'));
  const alternate={...mapping,'goat-classic':2026};
  assert.equal(auditFiveGameCandidate(prepared(),{seasonByGame:alternate}).data_prepared,false);
  assert.throws(()=>auditFiveGameCandidate(prepared(),{seasonByGame:{...mapping,'unexpected-game':2027}}),/invalid_annual_season_map/);
  assert.throws(()=>auditFiveGameCandidate(prepared(),{seasonByGame:{...mapping,'first-and-baa':2025}}),/invalid_annual_season_map/);
  assert.throws(()=>auditFiveGameCandidate(prepared(),{seasonByGame:{...mapping,'first-and-baa':'2027Q1'}}),/invalid_annual_season_map/);
});

test('bracket lock rejects normalized nonexistent calendar days, impossible leap days, offsets and times',()=>{
  const bad=[
    '2027-02-30T12:00:00Z','2027-02-29T12:00:00Z',
    '2027-03-18T24:00:00Z','2027-03-18T12:61:00Z',
    '2027-03-18T12:00:00+99:00','2027-03-18T12:00:00'
  ];
  for(const lock_at of bad) {
    const snapshots=prepared();
    snapshots[1].bracket_config.main_lock_at=lock_at;
    const report=auditFiveGameCandidate(snapshots);
    assert.equal(report.data_prepared,false,lock_at);
    assert.ok(report.games[1].issues.includes('invalid_main_bracket_lock'),lock_at);
  }
  const valid=prepared();valid[1].bracket_config.main_lock_at='2028-02-29T12:00:00-05:00';
  assert.equal(auditFiveGameCandidate(valid).data_prepared,true);
});

test('audit does not mutate caller data or promote sandbox game points to official standings',()=>{
  const candidate=prepared(),before=JSON.stringify(candidate);
  const result=auditFiveGameCandidate(candidate);
  assert.equal(JSON.stringify(candidate),before);
  assert.equal(result.can_launch,false);
  assert.equal('baas' in result,false);
  assert.equal('gpi' in result,false);
});

test('offline audit CLI never declares a launch or prints private snapshot content',async()=>{
  const {spawnSync}=await import('node:child_process');
  const {mkdtemp,writeFile,rm}=await import('node:fs/promises');
  const {tmpdir}=await import('node:os');
  const {join}=await import('node:path');
  const dir=await mkdtemp(join(tmpdir(),'goat-five-game-test-'));
  const run=filename=>spawnSync(process.execPath,[new URL('../scripts/audit-five-games.mjs',import.meta.url).pathname,filename],
    {encoding:'utf8',timeout:15000});
  try{
    const filename=join(dir,'private-fixture.json');
    const snapshots=prepared();
    snapshots[0].league.private_email='member-secret@example.invalid';
    await writeFile(filename,JSON.stringify(snapshots));
    const ok=run(filename);
    assert.equal(ok.status,2,ok.stderr);
    const result=JSON.parse(ok.stdout);
    assert.equal(result.data_prepared,true);
    assert.equal(result.can_launch,false);
    assert.doesNotMatch(ok.stdout,/member-secret@example\.invalid|SYNTHETIC-TEST-SOURCE/);
    snapshots[0].league.rules.unresolved=['pending official policy'];
    await writeFile(filename,JSON.stringify(snapshots));
    const blocked=run(filename);
    assert.equal(blocked.status,1,blocked.stderr);
    assert.equal(JSON.parse(blocked.stdout).status,'blocked');
    const mapping=Object.fromEntries(ids.map(game=>[game,2027]));
    await writeFile(filename,JSON.stringify({snapshots:prepared(),season_by_game:mapping}));
    const mapped=run(filename);
    assert.equal(mapped.status,2,mapped.stderr);
    assert.equal(JSON.parse(mapped.stdout).season_mapping_checked,true);
    mapping['goat-classic']=2026;
    await writeFile(filename,JSON.stringify({snapshots:prepared(),season_by_game:mapping}));
    assert.equal(run(filename).status,1);
    await writeFile(filename,'{bad-json');
    const corrupted=run(filename);
    assert.equal(corrupted.status,1);
    assert.equal(corrupted.stdout,'');
    assert.match(corrupted.stderr,/snapshot_json_invalid/);
    assert.doesNotMatch(corrupted.stderr,/bad-json|member-secret/);
  }finally{await rm(dir,{recursive:true,force:true});}
});
