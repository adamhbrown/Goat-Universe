import test,{before,after} from 'node:test';
import assert from 'node:assert/strict';
import {application} from '../server.mjs';
import {configuration} from '../config.mjs';

let app,base,owner,a,b,outsider,league,nodes,picks;
const future=hours=>new Date(Date.now()+hours*3600000).toISOString();
const rules={approved:true,source_reference:'Founder October 14 rules; synthetic schedule fixture only',points:[1,2,3,5,7,9,11],tiebreaker:'championship_total_closest',unresolved:[]};
const db=(p,who=owner,query=false)=>app.db.rpc(query?'goat_query':'goat_command',p,who.id);
async function http(p,who=owner,query=false){const r=await fetch(base+(query?'/query':'/commands'),{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${who.token}`},body:JSON.stringify(p)});return {status:r.status,data:await r.json()};}
async function ok(p,who=owner,query=false){const r=await http(p,who,query);if(r.status!==200) { try { await db(p,who,query); } catch(e) { r.database_error=e.message; } } assert.equal(r.status,200,JSON.stringify(r));return r.data;}
before(async()=>{
 app=await application({...configuration({}),localPath:undefined});await new Promise(r=>app.server.listen(0,'127.0.0.1',r));base=`http://127.0.0.1:${app.server.address().port}`;
 const users=[];
 for(const name of ['commissioner','first','second','outsider']){
  const r=await fetch(base+'/auth/signup',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:name+'@bracket.fixture.invalid',password:'Bracket-Fixture-Password-1234',display_name:name})});assert.equal(r.status,201);const u=await r.json();
  const login=await fetch(base+'/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:name+'@bracket.fixture.invalid',password:'Bracket-Fixture-Password-1234'})});assert.equal(login.status,200);users.push({id:u.user.id,token:(await login.json()).access_token});
 }
 [owner,a,b,outsider]=users;
});
after(async()=>app.close());

async function setup(){
 const l=await db({op:'game_draft_create',game_key:'horns-and-hoops',name:'MARCH MADNESS SYNTHETIC TEST ONLY',season:'fixture',main_lock_at:future(48),schedule_source:'https://fixture.invalid/schedule'});
 const ns=[];
 for(let i=0;i<2;i++) ns.push({...await db({op:'bracket_node_create',league_id:l.id,code:'Q'+i,stage:0,starts_at:future(12+i*2),home_team:'QUAL HOME '+i,away_team:'QUAL AWAY '+i,source_url:'https://fixture.invalid/schedule'}),stage:0,team:'QUAL HOME '+i});
 for(let stage=1;stage<=6;stage++){
  const prior=ns.filter(n=>n.stage===stage-1);
  for(let i=0;i<2**(6-stage);i++){
   const game={op:'bracket_node_create',league_id:l.id,code:'R'+stage+'G'+i,stage,starts_at:stage===1?(await db({op:'league',league_id:l.id},owner,true)).bracket_config.main_lock_at:future(48+stage),source_url:'https://fixture.invalid/schedule'};
   if(stage===1){if(i<2)game.home_from=ns[i].id;else game.home_team='HOME '+i;game.away_team='AWAY '+i;}
   else {game.home_from=prior[i*2].id;game.away_from=prior[i*2+1].id;}
   ns.push({...await db(game),stage,team:stage===1?(i<2?ns[i].team:'HOME '+i):prior[i*2].team,home_from:game.home_from,away_from:game.away_from});
  }
 }
 return {league:l,nodes:ns,picks:ns.filter(n=>n.stage>0).map(n=>({node_id:n.id,team:n.team}))};
}
test('five games have separate persistent drafts and cannot bypass incomplete engine gates',async()=>{
 for(const key of ['goat-crossover','league-of-greatness','goat-classic']){
  const l=await ok({op:'game_draft_create',game_key:key,name:key+' TEST DRAFT',season:'fixture',rules:{approved:true}});
  const view=await ok({op:'league',league_id:l.id},owner,true);assert.equal(view.league.game_key,key);assert.equal(view.league.rules.approved,false);
  await ok({op:'league_rules',league_id:l.id,rules:{approved:true,max_points:61,tiebreaker:'ats_record'} });
  assert.equal((await ok({op:'league',league_id:l.id},owner,true)).league.rules.approved,false);
  for(const op of ['league_open','round_create','enroll'])assert.equal((await http({op,league_id:l.id,reason:'bypass'},owner)).data.error,'competition_engine_not_ready');
  assert.equal((await http({op:'league_rules',league_id:l.id,rules:{}},outsider)).status,403);
 }
});
test('March Madness setup validates all 63 main nodes, feeders, first tip and founder scoring',async()=>{
 ({league,nodes,picks}=await setup());
 await assert.rejects(db({op:'league_open',league_id:league.id,reason:'TEST'}),/rules_approval_required/);
 await assert.rejects(db({op:'league_rules',league_id:league.id,rules:{...rules,points:[1,1,1]}}),/founder_rules_mismatch/);
 await db({op:'league_rules',league_id:league.id,rules});
 // A complete fixture is built with source URLs, no invented real athletes.
 assert.equal(nodes.filter(n=>n.stage>0).length,63);
 await assert.rejects(db({op:'bracket_node_create',league_id:league.id,code:'bad',stage:2,home_from:nodes[0].id,away_from:nodes[1].id,source_url:'https://fixture.invalid/source'}),/invalid_bracket_feeder/);
 await db({op:'league_open',league_id:league.id,reason:'Explicit fixture launch approval'});
 for(const who of [a,b]){await ok({op:'enroll',league_id:league.id},who);await ok({op:'entry_decide',league_id:league.id,user_id:who.id,approved:true});}
 await assert.rejects(db({op:'bracket_node_create',league_id:league.id,stage:0}),/schedule_frozen/);
});
test('one full main bracket with fixed tiebreaker; validation rolls back and privacy covers APIs and direct RLS',async()=>{
 const command={op:'bracket_submit',league_id:league.id,picks,championship_total:145};
 await ok(command,a);await ok({...command,championship_total:153,user_id:a.id},b);
 const view=await ok({op:'league',league_id:league.id},owner,true);assert.equal(view.bracket_picks.length,0);assert.equal(view.bracket_submissions.length,0);
 const standings=await ok({op:'standings',league_id:league.id},owner,true);assert.equal(standings[0].championship_total,null);assert.equal(standings[1].championship_total,null);
 assert.equal((await http({op:'league',league_id:league.id},outsider,true)).status,403);
 await assert.rejects(db({...command,picks:picks.slice(1)},a),/complete_unique_bracket_required/);
 await assert.rejects(db({...command,picks:[picks[0],...picks.slice(0,62)]},a),/complete_unique_bracket_required/);
 const inconsistent=picks.map((p,i)=>i===62?{...p,team:'AWAY 31'}:p);
 await assert.rejects(db({...command,picks:inconsistent},a),/inconsistent_bracket_advancement/);
 await assert.rejects(db({...command,championship_total:null},a),/championship_total_required/);
 assert.equal((await db({op:'league',league_id:league.id},a,true)).bracket_submissions[0].championship_total,145);
 assert.equal((await app.db.db.query('select count(*) as n from public.goat_bracket_submissions where league_id=$1',[league.id])).rows[0].n,2);
 await app.db.exclusive(()=>app.db.db.transaction(async tx=>{await tx.exec('set local role authenticated');await tx.query("select set_config('request.jwt.claim.sub',$1,true)",[owner.id]);assert.equal((await tx.query('select * from public.goat_bracket_picks')).rows.length,0);assert.equal((await tx.query('select * from public.goat_bracket_submissions')).rows.length,0);}));
 for(const fn of ['goat_command_v2','goat_query_v2','goat_bracket_standings','goat_bracket_candidates'])await assert.rejects(app.db.exclusive(()=>app.db.db.transaction(async tx=>{await tx.exec('set local role authenticated');return tx.query(`select public.${fn}($1)`,[fn.includes('v2')?'{}':league.id]);})),/permission denied/);
 await assert.rejects(app.db.exclusive(()=>app.db.db.transaction(async tx=>{await tx.exec('set local role authenticated');return tx.query("update public.goat_bracket_submissions set championship_total=1");})),/permission denied/);
});
test('qualifying picks lock individually; main bracket remains editable until its single tournament lock',async()=>{
 for(const who of [a,b]) for(const n of nodes.filter(n=>n.stage===0)) await ok({op:'bracket_qualifying_pick',node_id:n.id,team:n.team},who);
 await app.db.db.query("update public.goat_bracket_nodes set starts_at=now()-interval '1 second' where id=$1",[nodes[0].id]);
 assert.equal((await http({op:'bracket_qualifying_pick',node_id:nodes[0].id,team:nodes[0].team},a)).data.error,'selections_locked');
 await ok({op:'bracket_qualifying_pick',node_id:nodes[1].id,team:nodes[1].team},a);
 const view=await ok({op:'league',league_id:league.id},owner,true);assert.equal(view.bracket_picks.length,2,'Only first qualifying game revealed, no main predictions');
 // Later entrant can still submit the main bracket without retroactive qualifiers.
 await ok({op:'enroll',league_id:league.id},outsider);await ok({op:'entry_decide',league_id:league.id,user_id:outsider.id,approved:true});
 await ok({op:'bracket_submit',league_id:league.id,picks,championship_total:100},outsider);
 await ok({op:'bracket_submit',league_id:league.id,picks,championship_total:145},a);
 await app.db.db.query("update public.goat_bracket_config set main_lock_at=now()-interval '1 second' where league_id=$1",[league.id]);
 await app.db.db.query("update public.goat_bracket_nodes set starts_at=now()-interval '1 second' where league_id=$1",[league.id]);
 assert.equal((await http({op:'bracket_submit',league_id:league.id,picks,championship_total:1},a)).data.error,'selections_locked');
 assert.equal((await http({op:'entry_decide',league_id:league.id,user_id:b.id,approved:false})).data.error,'enrollment_closed');
});
test('full sourced 65-game simulation produces 211 points, closest championship total, corrections and final archive',async()=>{
 const main=nodes.filter(n=>n.stage>0);
 assert.equal((await http({op:'bracket_result',node_id:main[32].id,home_score:80,away_score:70,source_url:'https://fixture.invalid/result'})).data.error,'feeder_results_required');
 assert.equal((await http({op:'bracket_result',node_id:nodes[0].id,home_score:80,away_score:70,source_url:'https://fixture.invalid/result'},a)).status,403);
 const broken=nodes.map(n=>({node_id:n.id,home_score:85,away_score:70,source_url:n.stage===6?'':'https://fixture.invalid/result'}));
 await assert.rejects(db({op:'bracket_results_import',league_id:league.id,results:broken}),/sourced_decisive_scores_required/);
 assert.equal((await db({op:'history',league_id:league.id},owner,true)).length,0,'Failed result import rolls back snapshots');
 assert.equal((await app.db.db.query('select count(*) n from public.goat_bracket_nodes where league_id=$1 and winner is not null',[league.id])).rows[0].n,0);
 await ok({op:'bracket_results_import',league_id:league.id,results:nodes.map(n=>({node_id:n.id,home_score:n.stage===6?80:85,away_score:70,source_url:'https://fixture.invalid/result'}))});
 let board=await ok({op:'standings',league_id:league.id},a,true);
 assert.equal(Number(board[0].points),211);assert.equal(board[0].user_id,b.id);assert.equal(Number(board[0].tiebreak_error),3);assert.equal(Number(board[1].tiebreak_error),5);
 assert.equal(Number(board.find(r=>r.user_id===outsider.id).points),209,'Optional missed qualifiers never earn retroactive points');
 const before=await ok({op:'history',league_id:league.id},a,true);assert.equal(before.length,65);
 assert.equal((await http({op:'bracket_result',node_id:main[0].id,home_score:85,away_score:70,source_url:'https://fixture.invalid/rewrite'})).data.error,'correction_required');
 assert.equal((await http({op:'bracket_correct',node_id:main[0].id})).data.error,'correction_reason_required');
 await ok({op:'bracket_correct',node_id:main[0].id,reason:'TEST documented upstream correction'});
 const cleared=(await ok({op:'league',league_id:league.id},owner,true)).bracket_nodes.filter(n=>n.stage>0&&n.winner===null);assert.equal(cleared.length,6,'Every dependent round invalidated');
 assert.equal((await http({op:'league_finalize',league_id:league.id})).data.error,'league_incomplete');
 // Re-enter sourced results after commissioner review; choose same fixtures to
 // verify tiebreaker ties remain shared rather than inventing a secondary rule.
 for(const n of cleared.sort((a,b)=>a.stage-b.stage)) await ok({op:'bracket_result',node_id:n.id,home_score:n.stage===6?79:85,away_score:70,source_url:'https://fixture.invalid/corrected'});
 const history=await ok({op:'history',league_id:league.id},a,true);assert.deepEqual(history[0],before[0]);
 board=await ok({op:'standings',league_id:league.id},a,true);assert.equal(Number(board[0].tiebreak_error),4);assert.equal(Number(board[1].tiebreak_error),4);assert.equal(Number(board[0].rank),1);assert.equal(Number(board[1].rank),1);
 await ok({op:'league_finalize',league_id:league.id});
 assert.equal((await ok({op:'league',league_id:league.id},a,true)).league.status,'final');
 assert.equal((await http({op:'bracket_correct',node_id:main[0].id,reason:'No rewrite of champion'})).data.error,'league_final');
});

test('all five league shells persist without invented dates; bracket configuration must be explicit',async()=>{
 for(const key of ['first-and-baa','horns-and-hoops','goat-crossover','league-of-greatness','goat-classic']){
  const created=await db({op:'game_draft_create',game_key:key,name:key+' UNSCHEDULED FIXTURE',season:'2027'});
  const view=await db({op:'league',league_id:created.id},owner,true);assert.equal(view.league.game_key,key);assert.equal(view.league.status,'draft');assert.equal(view.league.rules.approved,false);
  assert.equal(view.rounds.length,0);assert.equal(view.games.length,0);
  if(key==='horns-and-hoops'){
   assert.equal(view.bracket_config,null);
   await assert.rejects(db({op:'bracket_node_create',league_id:created.id}),/bracket_schedule_configuration_required/);
   await assert.rejects(db({op:'league_open',league_id:created.id,reason:'bypass'}),/bracket_schedule_configuration_required/);
   await db({op:'bracket_configure',league_id:created.id,main_lock_at:future(48),schedule_source:'https://fixture.invalid/schedule'});
   assert.ok((await db({op:'league',league_id:created.id},owner,true)).bracket_config.main_lock_at);
  }
 }
});

test('atomic schedule import rejects malformed feeders and leaves no partial schedule or audit records',async()=>{
 const fixture=(await db({op:'league',league_id:league.id},owner,true)).bracket_nodes;
 const ids=new Map(fixture.map(n=>[n.id,n.code]));
 const specs=fixture.map(n=>({code:n.code,stage:n.stage,starts_at:future(n.stage===0?12:48+n.stage),source_url:n.source_url,...(n.home_team?{home_team:n.home_team}:{home_from_code:ids.get(n.home_from)}),...(n.away_team?{away_team:n.away_team}:{away_from_code:ids.get(n.away_from)})}));
 const draft=await db({op:'game_draft_create',game_key:'horns-and-hoops',name:'BULK SCHEDULE FIXTURE',season:'fixture',main_lock_at:future(48),schedule_source:'https://fixture.invalid/schedule'});
 const broken=specs.map(n=>n.stage===6?{...n,home_from_code:'MISSING'}:n);
 await assert.rejects(db({op:'bracket_schedule_import',league_id:draft.id,nodes:broken}),/invalid_bracket_feeder/);
 assert.equal((await app.db.db.query('select count(*) n from public.goat_bracket_nodes where league_id=$1',[draft.id])).rows[0].n,0);
 assert.equal((await app.db.db.query("select count(*) n from public.goat_audit where action='bracket_node_create' and detail->>'league_id'=$1",[draft.id])).rows[0].n,0);
 await db({op:'bracket_schedule_import',league_id:draft.id,nodes:specs});
 assert.equal((await db({op:'league',league_id:draft.id},owner,true)).bracket_nodes.length,65);
 await assert.rejects(db({op:'bracket_schedule_import',league_id:draft.id,nodes:specs}),/empty_draft_schedule_required/);
});

test('qualifying-result snapshots never reveal commissioner or member championship predictions before main lock',async()=>{
 const {league:l,nodes:ns,picks:ps}=await setup();
 await db({op:'league_rules',league_id:l.id,rules});await db({op:'league_open',league_id:l.id,reason:'Privacy fixture only'});
 for(const who of [owner,a]){await db({op:'enroll',league_id:l.id},who);await db({op:'entry_decide',league_id:l.id,user_id:who.id,approved:true});await db({op:'bracket_submit',league_id:l.id,picks:ps,championship_total:155},who);}
 await app.db.db.query("update public.goat_bracket_nodes set starts_at=now()-interval '1 second' where id=$1",[ns[0].id]);
 await db({op:'bracket_result',node_id:ns[0].id,home_score:80,away_score:70,source_url:'https://fixture.invalid/result'});
 const history=await db({op:'history',league_id:l.id},a,true);assert.equal(history.length,1);
 assert.ok(history[0].snapshot.every(r=>r.championship_total===null&&r.tiebreak_error===null));
 const own=await db({op:'league',league_id:l.id},owner,true);assert.equal(own.bracket_submissions.length,1);assert.equal(own.bracket_submissions[0].user_id,owner.id);
 // RLS applies to every new bracket table; no exposed table may miss the
 // session restriction or grant participant direct writes.
 const tables=await app.db.db.query("select c.relname,c.relrowsecurity,has_table_privilege('authenticated',c.oid,'INSERT') writes,(select count(*) from pg_policy p where p.polrelid=c.oid and p.polname='live_session' and not p.polpermissive) restrictions from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname like 'goat_bracket_%' and c.relkind='r'");
 assert.equal(tables.rows.length,4);assert.ok(tables.rows.every(t=>t.relrowsecurity&&!t.writes&&t.restrictions===1));
});
