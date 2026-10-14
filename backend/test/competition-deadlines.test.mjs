import test,{before,after} from 'node:test';
import assert from 'node:assert/strict';
import {LocalDatabase} from '../database.mjs';

let db,owner,member;
const future=new Date(Date.now()+86400000).toISOString();
const command=(p,actor=owner)=>db.rpc('goat_command',p,actor);
before(async()=>{
 db=await new LocalDatabase().init();
 // Auth is tested elsewhere. These synthetic principals exercise real roles.
 const r=await db.db.query("insert into auth.users(id,email) values(gen_random_uuid(),'deadline-owner@fixture.invalid'),(gen_random_uuid(),'deadline-member@fixture.invalid') returning id");
 [owner,member]=r.rows.map(r=>r.id);
});
after(async()=>db.close());
async function nfl(){
 const league=await command({op:'league_create',name:'DEADLINE REGRESSION FIXTURE',sport:'TEST',season:'2027',rules:{approved:true,max_points:1,tiebreaker:'ats_record',source_reference:'SYNTHETIC TEST POLICY',unresolved:[]}});
 const round=await command({op:'round_create',league_id:league.id,name:'Fixture',weights:[1],lock_at:future});
 const game=await command({op:'game_create',round_id:round.id,home:'FIXTURE H',away:'FIXTURE A',starts_at:future,home_spread:0,source_url:'https://fixture.invalid/schedule'});
 await command({op:'league_open',league_id:league.id,reason:'TEST ONLY'});
 await command({op:'enroll',league_id:league.id},member);await command({op:'entry_decide',league_id:league.id,user_id:member,approved:true});
 await command({op:'round_open',round_id:round.id,approved:true,push_multiplier:0,missing_policy:'zero',reason:'Explicit fixture-only policies'});
 return {league,round,game};
}
async function crossDeadline(update,params,p,actor){
 return db.exclusive(()=>db.db.transaction(async tx=>{
  // Transaction starts before cutoff; wall time moves past it. This models a
  // queued commissioner lock without needing two PGlite connections.
  await tx.query(update,params);
  await tx.exec('select pg_sleep(0.04)');
  await tx.exec('set local role authenticated');
  await tx.query("select set_config('request.jwt.claim.sub',$1,true)",[actor]);
  return tx.query('select public.goat_command($1::jsonb)',[JSON.stringify(p)]);
 }));
}

test('NFL pick deadlines use wall time even when transaction began before cutoff; rejected changes roll back',async()=>{
 const f=await nfl();const picks={op:'picks_submit',round_id:f.round.id,picks:[{game_id:f.game.id,side:'home',weight:1}]};
 await command(picks,member);
 await assert.rejects(crossDeadline("update public.goat_rounds set lock_at=clock_timestamp()+interval '10 milliseconds' where id=$1",[f.round.id],{...picks,picks:[{game_id:f.game.id,side:'away',weight:1}],submitted_at:'2000-01-01T00:00:00Z'},member),/selections_locked/);
 assert.equal((await db.db.query('select side from public.goat_picks where game_id=$1',[f.game.id])).rows[0].side,'home');
});
test('NFL entry approval cannot cross a deadline in an old transaction',async()=>{
 const f=await nfl();await assert.rejects(crossDeadline("update public.goat_rounds set lock_at=clock_timestamp()+interval '10 milliseconds' where id=$1",[f.round.id],{op:'entry_decide',league_id:f.league.id,user_id:member,approved:false},owner),/enrollment_closed/);
});
test('NCAA qualifying picks use each tip time rather than transaction-start time',async()=>{
 const league=await command({op:'game_draft_create',game_key:'horns-and-hoops',name:'QUALIFYING DEADLINE FIXTURE',season:'2027',main_lock_at:future,schedule_source:'https://fixture.invalid/schedule'});
 const node=await command({op:'bracket_node_create',league_id:league.id,code:'Q',stage:0,starts_at:new Date(Date.now()+3600000).toISOString(),home_team:'FIXTURE H',away_team:'FIXTURE A',source_url:'https://fixture.invalid/schedule'});
 // Isolate the qualifying-deadline branch; the complete 63-node opening gate
 // and tournament simulation are covered in march-madness.test.mjs.
 await db.db.query("update public.goat_leagues set status='open' where id=$1",[league.id]);
 await db.db.query("insert into public.goat_entries values($1,$2,'approved',now())",[league.id,member]);
 await assert.rejects(crossDeadline("update public.goat_bracket_nodes set starts_at=clock_timestamp()+interval '10 milliseconds' where id=$1",[node.id],{op:'bracket_qualifying_pick',node_id:node.id,team:'FIXTURE H'},member),/selections_locked/);
 assert.equal((await db.db.query('select * from public.goat_bracket_picks where node_id=$1',[node.id])).rows.length,0);
});
test('all legacy implementation functions retain denied execution privileges after deadline hardening',async()=>{
 const r=await db.db.query("select p.proname,has_function_privilege('authenticated',p.oid,'EXECUTE') member_execute,has_function_privilege('anon',p.oid,'EXECUTE') anon_execute,p.proconfig from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname ~ '^goat_(command|query)_v[0-9]$'");
 assert.ok(r.rows.length>=10);assert.ok(r.rows.every(r=>!r.member_execute&&!r.anon_execute));
 assert.ok(r.rows.every(r=>r.proconfig.some(v=>v.startsWith('search_path='))));
});
