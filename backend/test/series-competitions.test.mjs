import test, {before, after} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {LocalDatabase} from '../database.mjs';
import {LocalAuth} from '../auth.mjs';

// Every team, policy, event and result below is synthetic TEST data.
let db, owner, member, other, outsider;
const future = hours => new Date(Date.now() + hours * 3600000).toISOString();
const command = (p, actor = owner) => db.rpc('goat_command', p, actor);
const query = (p, actor = owner) => db.rpc('goat_query', p, actor);
before(async () => {
  db = await new LocalDatabase().init();
  const auth = new LocalAuth(db);
  [owner, member, other, outsider] = await Promise.all(['owner','member','other','outsider'].map(async name =>
    (await auth.signup({email: `${name}@series.fixture.invalid`, password: 'Series-Fixture-Password-1234'})).user.id));
});
after(async () => db.close());

const policy = key => ({approved: true, game_id: key, season: 2027,
  source_reference: 'SYNTHETIC TEST POLICY, NOT OFFICIAL RULES', unresolved: [],
  missing_policy: 'block', tie_policy: 'shared_rank',
  points_by_sport: key === 'goat-crossover' ? {NBA: {Opening: 3, Final: 7}, NHL: {Opening: 5, Final: 9}} : {MLB: {Opening: 2, Final: 4}}});
async function setup(key, configure = true) {
  const league = await command({op: 'game_draft_create', game_key: key, name: key + ' SYNTHETIC FIXTURE', season: '2027'});
  if (configure) await command({op: 'series_configure', league_id: league.id, policy: policy(key)});
  const events = Object.keys(policy(key).points_by_sport).flatMap(sport => [
    {code: sport+'-A', sport, round:'Opening', stage:1, lock_at:future(24), home_team:sport+' HOME A', away_team:sport+' AWAY A', source_url:'https://fixture.invalid/schedule'},
    {code: sport+'-B', sport, round:'Opening', stage:1, lock_at:future(24), home_team:sport+' HOME B', away_team:sport+' AWAY B', source_url:'https://fixture.invalid/schedule'},
    {code: sport+'-F', sport, round:'Final', stage:2, lock_at:future(48), home_from_code:sport+'-A', away_from_code:sport+'-B', source_url:'https://fixture.invalid/schedule'}
  ]);
  await command({op:'series_schedule_import', league_id:league.id, events});
  return {league, events:(await query({op:'league',league_id:league.id})).series_events};
}
async function enter(league, actors = [member, other]) {
  await command({op:'series_open',league_id:league.id,reason:'Explicit fixture-only approval'});
  for (const actor of actors) {
    await command({op:'enroll',league_id:league.id,user_id:owner},actor);
    await command({op:'entry_decide',league_id:league.id,user_id:actor,approved:true});
  }
}
const picksFor = events => events.map(e => ({event_id:e.id,team:e.sport+' HOME A'})).map((p,i) =>
  events[i].code.endsWith('-B') ? {...p,team:events[i].sport+' HOME B'} : p);
async function scope(actor, fn, role = 'authenticated') {
  return db.exclusive(() => db.db.transaction(async tx => {
    await tx.exec('set local role '+role);
    await tx.query("select set_config('request.jwt.claim.sub',$1,true)",[actor || '']);
    return fn(tx);
  }));
}

test('NBA/NHL and MLB schedules persist without scoring policy; opening and scoring remain gated',async()=>{
  const {league,events}=await setup('goat-classic',false);
  assert.equal(events.length,3);
  const view=await query({op:'league',league_id:league.id});
  assert.equal(view.series_config,null);assert.equal(view.league.status,'draft');
  assert.deepEqual(await query({op:'standings',league_id:league.id}),[]);
  await assert.rejects(command({op:'series_open',league_id:league.id,reason:'bypass'}),/series_policy_approval_required/);
  await assert.rejects(command({op:'series_configure',league_id:league.id,policy:{...policy('goat-classic'),approved:false}}),/series_policy_approval_required/);
  await command({op:'series_configure',league_id:league.id,policy:policy('goat-classic')});
  await enter(league);
  await assert.rejects(command({op:'series_configure',league_id:league.id,policy:policy('goat-classic')}),/rules_frozen/);
  await assert.rejects(command({op:'series_event_create',league_id:league.id}),/schedule_frozen/);
});

test('policy validation rejects incomplete sports, implicit tie/missing rules, malformed points and wrong season',async()=>{
  const league=await command({op:'game_draft_create',game_key:'goat-crossover',name:'POLICY FIXTURE',season:'2027'});
  const p=policy('goat-crossover');
  for(const bad of [{...p,points_by_sport:{NBA:p.points_by_sport.NBA}}, {...p,season:2028}, {...p,unresolved:['Unknown rule']},
    {...p,tie_policy:'coin_flip'}, {...p,missing_policy:null}, {...p,source_reference:' '},
    {...p,points_by_sport:{NBA:{Opening:-1},NHL:{Opening:1}}}, {...p,points_by_sport:{NBA:{Opening:1.5},NHL:{Opening:1}}},
    {...p,points_by_sport:{NBA:{Opening:'3'},NHL:{Opening:1}}}])
    await assert.rejects(command({op:'series_configure',league_id:league.id,policy:bad}),/series_policy_approval_required/);
  await command({op:'series_configure',league_id:league.id,policy:p});
  await command({op:'series_event_create',league_id:league.id,code:'ONLY NBA',sport:'NBA',round:'Opening',stage:1,lock_at:future(24),home_team:'H',away_team:'A',source_url:'https://fixture.invalid/schedule'});
  await assert.rejects(command({op:'series_open',league_id:league.id,reason:'NBA-only bypass'}),/series_required_sport_missing/);
});

test('combined Crossover picks, privacy, server deadlines, standings, corrections and immutable championships',async()=>{
  const {league,events}=await setup('goat-crossover');await enter(league);
  const picks=picksFor(events),args={op:'series_submit',league_id:league.id,picks};
  await command({...args,user_id:other,submitted_at:'2000-01-01T00:00:00Z'},member);
  await command(args,other);
  assert.equal((await query({op:'league',league_id:league.id})).series_picks.length,0,'Commissioner cannot inspect unlocked picks');
  assert.equal((await query({op:'league',league_id:league.id},member)).series_picks.length,6);
  assert.equal((await scope(owner,tx=>tx.query('select * from public.goat_series_picks'))).rows.length,0);
  await assert.rejects(query({op:'league',league_id:league.id},outsider),/league_access_denied/);
  await assert.rejects(command(args,outsider),/approved_entry_required/);
  await assert.rejects(command({...args,picks:[picks[0],picks[0]]},member),/unique_series_picks_required/);
  await assert.rejects(command({...args,picks:[picks[0],{...picks[1],team:'FABRICATED'}]},member),/invalid_series_selection/);
  assert.equal((await query({op:'league',league_id:league.id},member)).series_picks.length,6);
  await db.db.query("update public.goat_series_events set lock_at=now()-interval '1 second' where league_id=$1",[league.id]);
  await assert.rejects(command({...args,received_at:'2000-01-01T00:00:00Z'},member),/selections_locked/);
  await assert.rejects(command({op:'entry_decide',league_id:league.id,user_id:member,approved:false}),/enrollment_closed/);
  const finals=events.filter(e=>e.stage===2);
  await assert.rejects(command({op:'series_result',event_id:finals[0].id,winner:'NBA HOME A',source_url:'https://fixture.invalid/result'}),/feeder_results_required/);
  const results=events.map(e=>({event_id:e.id,winner:e.code.endsWith('-B')?e.sport+' HOME B':e.sport+' HOME A',source_url:'https://fixture.invalid/result'}));
  await assert.rejects(command({op:'series_results_import',league_id:league.id,results:results.map((e,i)=>i===5?{...e,winner:'UNKNOWN'}:e)}),/sourced_series_winner_required/);
  assert.equal((await query({op:'history',league_id:league.id})).length,0,'Failed batch rolls back results and history');
  await command({op:'series_results_import',league_id:league.id,results:results.toReversed()});
  const standings=await query({op:'standings',league_id:league.id},member);
  assert.deepEqual(standings.map(r=>[Number(r.points),Number(r.rank)]),[[32,1],[32,1]]);
  assert.deepEqual(standings[0].sports.map(s=>[s.sport,Number(s.points)]),[['NBA',13],['NHL',19]]);
  const history=await query({op:'history',league_id:league.id},member);
  const first=events.find(e=>e.code==='NBA-A');
  await assert.rejects(command({op:'series_result',...results.find(r=>r.event_id===first.id)}),/correction_required/);
  await assert.rejects(command({op:'series_correct',event_id:first.id,reason:'correction'},member),/commissioner_required/);
  await command({op:'series_correct',event_id:first.id,reason:'TEST upstream correction'});
  const cleared=(await query({op:'league',league_id:league.id})).series_events.filter(e=>!e.winner);
  assert.equal(cleared.length,2,'Correction invalidates the corrected series and its dependent final');
  await assert.rejects(command({op:'series_finalize',league_id:league.id}),/league_incomplete/);
  for(const e of cleared.sort((a,b)=>a.stage-b.stage)) await command({op:'series_result',event_id:e.id,winner:'NBA AWAY A',source_url:'https://fixture.invalid/corrected'});
  assert.deepEqual((await query({op:'history',league_id:league.id}))[0],history[0]);
  assert.equal(Number((await query({op:'standings',league_id:league.id}))[0].points),22);
  await command({op:'series_finalize',league_id:league.id});
  assert.equal((await query({op:'league',league_id:league.id})).league.status,'final');
  await assert.rejects(command({op:'series_correct',event_id:first.id,reason:'rewrite'}),/league_final/);
});

test('MLB championships enforce complete submissions under explicit block policy',async()=>{
  const {league,events}=await setup('goat-classic');await enter(league);
  await command({op:'series_submit',league_id:league.id,picks:picksFor(events)},member);
  await db.db.query("update public.goat_series_events set lock_at=now()-interval '1 second' where league_id=$1",[league.id]);
  await command({op:'series_results_import',league_id:league.id,results:events.map(e=>({event_id:e.id,winner:e.code.endsWith('-B')?'MLB HOME B':'MLB HOME A',source_url:'https://fixture.invalid/result'}))});
  await assert.rejects(command({op:'series_finalize',league_id:league.id}),/missing_submissions/);
  const board=await query({op:'standings',league_id:league.id});assert.equal(Number(board[0].points),8);assert.equal(Number(board[1].points),0);
});

test('cross-league ID spoofing, direct writes and internal RPC invocation cannot bypass commissioner authority',async()=>{
  const {league,events}=await setup('goat-classic');
  const owned=await command({op:'game_draft_create',game_key:'goat-classic',name:'ATTACKER OWNED FIXTURE',season:'2027'},outsider);
  await assert.rejects(command({op:'series_result',event_id:events[0].id,league_id:owned.id,owner_id:outsider,node_id:randomUUID(),winner:'MLB HOME A',source_url:'https://fixture.invalid/result'},outsider),/commissioner_required/);
  await assert.rejects(command({op:'series_submit',league_id:owned.id,picks:[{event_id:events[0].id,team:'MLB HOME A'}]},outsider),/selections_locked/);
  for(const sql of ['update public.goat_series_events set lock_at=now()', 'insert into public.goat_series_config values(gen_random_uuid(),\'{}\',now())',
    'select public.goat_series_standings($1)', 'select public.goat_series_candidates($1)', 'select public.goat_command_v3(\'{}\')', 'select public.goat_query_v3(\'{}\')'])
    await assert.rejects(scope(outsider,tx=>tx.query(sql,sql.includes('$1')?[league.id]:[])),/permission denied/);
  await assert.rejects(scope(null,tx=>tx.query("select public.goat_command('{}')"),'anon'),/permission denied/);
  const tables=await db.db.query("select c.relname,c.relrowsecurity,has_table_privilege('authenticated',c.oid,'INSERT') writes from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname like 'goat_series_%' and c.relkind='r'");
  assert.equal(tables.rows.length,3);assert.ok(tables.rows.every(t=>t.relrowsecurity&&!t.writes));
});
