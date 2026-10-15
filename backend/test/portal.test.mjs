import test, {before,after} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {application} from '../server.mjs';
import {configuration} from '../config.mjs';
import {client,pickCommand} from '../portal/forms.mjs';

let app,base,owner,member,other,staff,reviewer;
const fixtures=new Map();
async function post(path,p,token) {
 const r=await fetch(base+path,{method:'POST',headers:{'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`}:{})},body:JSON.stringify(p)});
 return {status:r.status,data:await r.json()};
}
async function signup(name) {
 // Setup identities through the local adapter so fixture creation does not
 // exhaust the real HTTP auth throttle before the client integration test.
 const u={status:201,data:await app.auth.signup({email:name+'@portal.fixture.invalid',password:'Portal-Fixture-Password-1234',display_name:name})};
 const s=await post('/auth/login',{email:name+'@portal.fixture.invalid',password:'Portal-Fixture-Password-1234'});
 assert.equal(u.status,201);assert.equal(s.status,200);return {id:u.data.user.id,token:s.data.access_token};
}
async function rpc(p,who=owner,query=false) {
 const r=await post(query?'/query':'/commands',p,who.token);assert.equal(r.status,200,JSON.stringify(r));return r.data;
}
before(async()=>{
 app=await application({...configuration({}),localPath:undefined});await new Promise(r=>app.server.listen(0,'127.0.0.1',r));base=`http://127.0.0.1:${app.server.address().port}`;
 [owner,member,other,staff,reviewer]=await Promise.all(['owner','member','other','staff','reviewer'].map(signup));
 await app.db.db.query("insert into public.goat_roles values($1,'researcher'),($2,'approver')",[staff.id,reviewer.id]);
});
after(async()=>app.close());

test('portal assets serve with restrictive headers without replacing the public homepage',async()=>{
 for(const [path,type] of [['/play','text/html'],['/manage','text/html'],['/manage/ui.mjs','text/javascript'],['/manage/forms.mjs','text/javascript'],['/manage/style.css','text/css'],['/nfl61.json','application/json']]) {
  const r=await fetch(base+path);assert.equal(r.status,200);assert.ok(r.headers.get('Content-Type').startsWith(type));assert.equal(r.headers.get('Cache-Control'),'no-store');assert.match(r.headers.get('Content-Security-Policy'),/frame-ancestors 'none'/);
 }
 assert.equal((await fetch(base+'/')).status,404,'Backend never serves or overwrites the production homepage');
 const rules=await (await fetch(base+'/nfl61.json')).json();assert.equal(rules.rules.max_points,61);assert.equal(rules.rules.approved,false);
 assert.equal(rules.round_templates.reduce((sum,r)=>sum+r.weights.reduce((a,b)=>a+b,0),0),59);
});

test('profile editing uses the session actor, cannot grant roles, and validates display names',async()=>{
 await rpc({op:'profile_update',display_name:'Updated member',user_id:owner.id,role:'executive'},member);
 const me=await rpc({op:'dashboard'},member,true);assert.equal(me.account.profile.display_name,'Updated member');assert.deepEqual(me.account.roles,[]);
 assert.equal((await rpc({op:'me'},owner,true)).profile.display_name,'owner');
 for(const display_name of ['', ' '.repeat(4),'a'.repeat(81),null,42]) assert.equal((await post('/commands',{op:'profile_update',display_name},member.token)).status,400);
 assert.equal((await post('/commands',{op:'profile_update',display_name:'Spoofed'})).status,401);
});

test('dashboard shows pending invitation status without exposing private games or picks',async()=>{
 const league=await rpc({op:'league_create',name:'PORTAL PRIVACY FIXTURE',sport:'NFL',season:'fixture',rules:{approved:true,max_points:1,source_reference:'fixture only',tiebreaker:'ats_record',unresolved:[]}});
 const round=await rpc({op:'round_create',league_id:league.id,name:'fixture',weights:[1],lock_at:new Date(Date.now()+86400000).toISOString()});
 const game=await rpc({op:'game_create',round_id:round.id,home:'HOME FIXTURE',away:'AWAY FIXTURE',starts_at:new Date(Date.now()+172800000).toISOString(),home_spread:0,source_url:'https://fixture.invalid/event'});
 await rpc({op:'league_open',league_id:league.id,reason:'Test only'});
 await rpc({op:'enroll',league_id:league.id},member);
 const pending=await rpc({op:'dashboard'},member,true);assert.equal(pending.leagues[0].entry_status,'pending');
 assert.equal((await post('/query',{op:'league',league_id:league.id},member.token)).status,403);
 assert.equal((await rpc({op:'dashboard'},other,true)).leagues.length,0);
 await rpc({op:'entry_decide',league_id:league.id,user_id:member.id,approved:true});
 await rpc({op:'round_open',round_id:round.id,approved:true,push_multiplier:0,missing_policy:'zero',reason:'Explicit fixture policy'});
 await rpc({op:'picks_submit',round_id:round.id,picks:[{game_id:game.id,side:'home',weight:1}]},member);
 const leagueView=await rpc({op:'league',league_id:league.id},owner,true);assert.equal(leagueView.submissions.length,0);assert.equal(leagueView.entries[0].display_name,'Updated member');assert.equal(leagueView.picks.length,0);
 assert.equal((await rpc({op:'league',league_id:league.id},member,true)).submissions.length,1);
 fixtures.set('league',league.id);
});

test('direct standings and internal RPC helpers cannot bypass private-league authorization',async()=>{
 const lid=fixtures.get('league');
 async function direct(fn,who,role='authenticated') {
  return app.db.exclusive(()=>app.db.db.transaction(async tx=>{
   await tx.exec('set local role '+role);await tx.query("select set_config('request.jwt.claim.sub',$1,true)",[who?.id || '']);
   return tx.query(`select public.${fn}($1)`,[fn.startsWith('goat_standings')?lid:JSON.stringify({op:'league',league_id:lid})]);
  }));
 }
 await assert.rejects(direct('goat_standings',other),/league_access_denied/);
 await assert.rejects(direct('goat_standings',null,'anon'),/permission denied/);
 for(const fn of ['goat_standings_internal','goat_query_v1','goat_command_v1']) await assert.rejects(direct(fn,owner),/permission denied/);
 await direct('goat_standings',member);
});

test('research queue enforces single active claim, actor-bound leases, evidence and retry ownership',async()=>{
 assert.equal((await post('/commands',{op:'research_claim'},member.token)).status,403);
 assert.equal((await post('/commands',{op:'research_job',query:'   '},staff.token)).status,400);
 const queued=await rpc({op:'research_job',query:'TEST public advertiser research'},staff);
 const [a,b]=await Promise.all([rpc({op:'research_claim'},staff),rpc({op:'research_claim'},staff)]);
 const job=a.job || b.job;assert.ok(job);assert.equal(job.id,queued.id);assert.equal(Number(!!a.job)+Number(!!b.job),1);
 const finish={op:'research_finish',job_id:job.id,lease_token:job.lease_token,status:'completed',result:{summary:'TEST result',sources:['https://fixture.invalid/source']}};
 assert.equal((await post('/commands',{...finish,lease_token:randomUUID()},staff.token)).status,403);
 await app.db.db.query("insert into public.goat_roles values($1,'researcher')",[other.id]);
 assert.equal((await post('/commands',finish,other.token)).status,403);
 assert.equal((await post('/commands',{...finish,result:{summary:'No source',sources:[]}},staff.token)).status,403);
 const records=await rpc({op:'crm_records'},staff,true);assert.equal(records.research_jobs[0].lease_token,undefined);
 await assert.rejects(app.db.exclusive(()=>app.db.db.transaction(async tx=>{await tx.exec('set local role authenticated');return tx.query('select lease_token from public.goat_research_jobs');})),/permission denied/);
 await app.db.db.query("update public.goat_research_jobs set lease_until=now()-interval '1 second' where id=$1",[job.id]);
 assert.equal((await post('/commands',finish,staff.token)).status,403);
 const reclaim=(await rpc({op:'research_claim'},other)).job;assert.equal(reclaim.attempts,2);assert.notEqual(reclaim.lease_token,job.lease_token);
 await rpc({...finish,lease_token:reclaim.lease_token},other);
 assert.equal((await rpc({op:'crm_records'},reviewer,true)).research_jobs[0].status,'completed');
 assert.equal((await post('/commands',{...finish,lease_token:reclaim.lease_token},other.token)).status,403);
 assert.equal((await post('/outreach/send',{},staff.token)).status,404);
});

test('pick form validates all games, allocation alternatives, positive integer rankings and MVP',()=>{
 const round={id:'r',weight_options:[[4,9],[5,8],[6,7]],mvp_bonus:0};const games=[{id:'a',round_id:'r'},{id:'b',round_id:'r'}];
 const rows=[{game_id:'a',side:'home',weight:5},{game_id:'b',side:'away',weight:8}];
 assert.deepEqual(pickCommand(round,games,rows),{op:'picks_submit',round_id:'r',picks:rows});
 for(const invalid of [rows.slice(1),[rows[0],rows[0]],rows.map(x=>({...x,weight:4})),[{...rows[0],side:''},rows[1]],[{...rows[0],weight:5.1},rows[1]]]) assert.throws(()=>pickCommand(round,games,invalid));
 assert.throws(()=>pickCommand({...round,mvp_bonus:2},games,rows,''),/MVP/);
 assert.equal(pickCommand({...round,mvp_bonus:2},games,rows,' FIXTURE_MVP ').mvp_pick,'FIXTURE_MVP');
});

test('portal client rotates once for concurrent expired requests and revokes session on logout',async()=>{
 const requests=[];let expired=true;
 const mock=async(path,options)=>{
  requests.push({path,options});
  if(path==='/auth/login') return {ok:true,status:200,json:async()=>({access_token:'old',refresh_token:'refresh_old'})};
  if(path==='/auth/refresh') {await new Promise(r=>setTimeout(r,5));expired=false;return {ok:true,status:200,json:async()=>({access_token:'new',refresh_token:'refresh_new'})};}
  return {ok:!expired,status:expired?401:200,json:async()=>expired?{error:'authentication_required'}:{ok:true}};
 };
 const c=client(mock);await c.login({});await Promise.all([c.query({op:'me'}),c.query({op:'dashboard'})]);
 assert.equal(requests.filter(x=>x.path==='/auth/refresh').length,1);
 assert.equal(requests.filter(x=>x.path==='/query').at(-1).options.headers.Authorization,'Bearer new');
 await c.logout();await c.query({op:'me'});assert.equal(requests.at(-1).options.headers.Authorization,undefined);
});

test('portal client performs real local registration, login, dashboard, profile and logout via HTTP',async()=>{
 const c=client((path,options)=>fetch(base+path,options));
 const registered=await c.signup({email:'client@portal.fixture.invalid',password:'Client-Fixture-Password-1234',display_name:'New portal member'});
 assert.equal(registered.confirmation_required,false);
 await c.login({email:'client@portal.fixture.invalid',password:'Client-Fixture-Password-1234'});
 assert.equal((await c.query({op:'dashboard'})).account.profile.display_name,'New portal member');
 await c.logout();
 await c.login({email:'member@portal.fixture.invalid',password:'Portal-Fixture-Password-1234'});
 await c.command({op:'profile_update',display_name:'Portal HTTP member'});
 const d=await c.query({op:'dashboard'});assert.equal(d.account.profile.display_name,'Portal HTTP member');assert.equal(d.leagues.length,1);
 await c.logout();await assert.rejects(c.query({op:'dashboard'}),/authentication_required/);
});

test('auth throttle remains active and does not block valid account queries',async()=>{
 let limited=false;
 for(let i=0;i<4;i++) {
  const r=await post('/auth/login',{email:'absent@fixture.invalid',password:'Bad-Fixture-Password-1234'});
  if(r.status===429) {limited=true;break;}
  assert.equal(r.status,401);
 }
 assert.equal(limited,true);
 assert.equal((await post('/query',{op:'me'},owner.token)).status,200);
});

test('explicit push and missing policies, tied championship ranks and invalid-pick rollback',async()=>{
 // Direct RPC fixtures exercise the actual SQL without bypassing actor roles.
 const act=(p,id=owner.id)=>app.db.rpc('goat_command',p,id);
 const qry=p=>app.db.rpc('goat_query',p,owner.id);
 for(const [push,missing] of [[0,'zero'],[1,'zero'],[1,'block']]) {
  const league=await act({op:'league_create',name:'PUSH TEST FIXTURE',sport:'TEST',season:'fixture',rules:{approved:true,max_points:1,source_reference:'Fixture-only approval',tiebreaker:'ats_record',unresolved:[]}});
  const round=await act({op:'round_create',league_id:league.id,name:'Push fixture',weights:[1],lock_at:new Date(Date.now()+86400000).toISOString()});
  const game=await act({op:'game_create',round_id:round.id,home:'HOME TEST',away:'AWAY TEST',starts_at:new Date(Date.now()+172800000).toISOString(),home_spread:-3,source_url:'https://fixture.invalid/event'});
  await act({op:'league_open',league_id:league.id,reason:'Test only'});
  for(const id of [owner.id,member.id]) {await act({op:'enroll',league_id:league.id},id);await act({op:'entry_decide',league_id:league.id,user_id:id,approved:true});}
  await act({op:'round_open',round_id:round.id,approved:true,push_multiplier:push,missing_policy:missing,reason:'Not an official league policy'});
  const picks={op:'picks_submit',round_id:round.id,picks:[{game_id:game.id,side:'home',weight:1}]};
  await act(picks,member.id);
  await assert.rejects(act({...picks,picks:[{game_id:game.id,side:'invalid',weight:1}]},member.id),/check constraint/);
  assert.equal((await app.db.db.query('select side from public.goat_picks where game_id=$1 and user_id=$2',[game.id,member.id])).rows[0].side,'home','Failed replacement rolls back all deleted picks');
  if(missing==='zero') await act({...picks,picks:[{game_id:game.id,side:'away',weight:1}]});
  await app.db.db.query("update public.goat_rounds set lock_at=now()-interval '2 minutes' where id=$1",[round.id]);
  await app.db.db.query("update public.goat_games set starts_at=now()-interval '1 minute' where id=$1",[game.id]);
  await act({op:'result_set',game_id:game.id,home_score:23,away_score:20,source_url:'https://fixture.invalid/result'});
  if(missing==='block') {
   await assert.rejects(act({op:'round_finalize',round_id:round.id}),/missing_submissions/);
   assert.equal((await qry({op:'history',league_id:league.id})).length,0);
   continue;
  }
  await act({op:'round_finalize',round_id:round.id});
  const board=await qry({op:'standings',league_id:league.id});assert.equal(board.length,2);
  for(const entry of board) {assert.equal(Number(entry.points),push);assert.equal(Number(entry.wins),0);assert.equal(Number(entry.losses),0);assert.equal(Number(entry.rank),1);}
  await act({op:'league_finalize',league_id:league.id});assert.equal((await qry({op:'history',league_id:league.id})).length,2);
 }
});

test('NFL draft setup installs all four rounds atomically and never pre-approves rules',async()=>{
 const profile=await (await fetch(base+'/nfl61.json')).json();
 const params={op:'competition_setup',name:'ATOMIC NFL FIXTURE',sport:'NFL',season:'fixture',rules:{...profile.rules,approved:true},rounds:profile.round_templates.map((s,i)=>({...s,lock_at:new Date(Date.now()+(i+1)*86400000).toISOString()}))};
 const setup=await app.db.rpc('goat_command',params,owner.id);
 const league=await app.db.rpc('goat_query',{op:'league',league_id:setup.id},owner.id);
 assert.equal(league.rounds.length,4);assert.equal(league.league.rules.approved,false);assert.equal(league.league.rules.max_points,61);
 assert.equal(league.rounds.reduce((sum,r)=>sum+r.weights.reduce((a,b)=>a+b,0)+r.mvp_bonus,0),61);
 await assert.rejects(app.db.rpc('goat_command',{op:'league_open',league_id:setup.id,reason:'Bypass attempt'},owner.id),/rules_approval_required/);
 const before=(await app.db.db.query('select count(*) as count from public.goat_leagues')).rows[0].count;
 await assert.rejects(app.db.rpc('goat_command',{...params,rounds:params.rounds.map((r,i)=>i===2?{...r,weights:[-1]}:r)},owner.id),/invalid_weights/);
 assert.equal((await app.db.db.query('select count(*) as count from public.goat_leagues')).rows[0].count,before);
 await assert.rejects(app.db.rpc('goat_command',{...params,rounds:[{...params.rounds[0],lock_at:new Date(Date.now()-1000).toISOString()}]},owner.id),/invalid_deadline/);
});

test('hosted-session compatibility denies missing, revoked, expired, banned or unconfirmed sessions through RPC and direct RLS',async()=>{
 // Local compatibility fixture only, not a claim of hosted GoTrue testing.
 await app.db.db.exec('create table auth.sessions(id uuid primary key,user_id uuid,not_after timestamptz); alter table auth.users add column email_confirmed_at timestamptz default now(); alter table auth.users add column banned_until timestamptz; alter table auth.users add column is_anonymous boolean default false;');
 const sid=randomUUID();await app.db.db.query('insert into auth.sessions(id,user_id) values($1,$2)',[sid,member.id]);
 async function scoped(session_id,fn,actor=member.id) {
  return app.db.exclusive(()=>app.db.db.transaction(async tx=>{
   await tx.exec('set local role authenticated');
   await tx.query("select set_config('request.jwt.claim.sub',$1,true)",[actor]);
   await tx.query("select set_config('request.jwt.claims',$1,true)",[JSON.stringify({sub:actor,session_id})]);
   return fn(tx);
  }));
 }
 const query=tx=>tx.query("select public.goat_query('{\"op\":\"me\"}') as result");
 const read=tx=>tx.query('select * from public.goat_profiles');
 const deny=async claim=>{await assert.rejects(scoped(claim,query),/authentication_required/);assert.equal((await scoped(claim,read)).rows.length,0);};
 try {
  assert.equal((await scoped(sid,query)).rows[0].result.profile.user_id,member.id);
  assert.equal((await scoped(sid,read)).rows.length,1);
  await deny(undefined);await deny('invalid-session-id');await deny(randomUUID());
  await assert.rejects(scoped(sid,query,owner.id),/authentication_required/);
  await app.db.db.query("update auth.sessions set not_after=now()-interval '1 second' where id=$1",[sid]);await deny(sid);
  await app.db.db.query('update auth.sessions set not_after=null where id=$1',[sid]);
  await app.db.db.query('update auth.users set email_confirmed_at=null where id=$1',[member.id]);await deny(sid);
  await app.db.db.query("update auth.users set email_confirmed_at=now(),banned_until=now()+interval '1 day' where id=$1",[member.id]);await deny(sid);
  await app.db.db.query('update auth.users set banned_until=null,is_anonymous=true where id=$1',[member.id]);await deny(sid);
  await app.db.db.query('update auth.users set is_anonymous=false where id=$1',[member.id]);
  await app.db.db.query('delete from auth.sessions where id=$1',[sid]);await deny(sid);
 } finally {await app.db.db.exec('drop table auth.sessions;');}
});
