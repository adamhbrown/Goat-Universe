import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID, createHmac } from 'node:crypto';
import { application } from '../server.mjs';
import { configuration } from '../config.mjs';
import { verifiedStripeEvent, paymentRecord, checkout } from '../billing.mjs';
import { SupabaseAuth } from '../auth.mjs';
import { SupabaseDatabase } from '../database.mjs';
import { LocalDatabase } from '../database.mjs';
import { LocalAuth } from '../auth.mjs';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

let app, base; const accounts = {};
async function call(path, p, who, headers={}) {
 const response = await fetch(base+'/'+path,{method:'POST',headers:{'Content-Type':'application/json',...(who?{Authorization:`Bearer ${accounts[who].token}`} : {}),...headers},body:JSON.stringify(p)});
 return {status:response.status,data:await response.json()};
}
async function command(p,who='commissioner') { const r=await call('commands',p,who);assert.equal(r.status,200,JSON.stringify(r.data));return r.data; }
async function query(p,who='commissioner') { const r=await call('query',p,who);assert.equal(r.status,200,JSON.stringify(r.data));return r.data; }
before(async()=>{
 app=await application({...configuration({}),localPath:undefined});
 await new Promise(resolve=>app.server.listen(0,'127.0.0.1',resolve));base=`http://127.0.0.1:${app.server.address().port}`;
 for(const role of ['commissioner','participant','outsider','researcher']) {
  const user=await call('auth/signup',{email:`${role}@fixture.invalid`,password:'Fixture-Password-1234',display_name:`${role} TEST FIXTURE`});assert.equal(user.status,201);
  const login=await call('auth/login',{email:`${role}@fixture.invalid`,password:'Fixture-Password-1234'});assert.equal(login.status,200);
  accounts[role]={id:user.data.user.id,token:login.data.access_token,refresh:login.data.refresh_token};
 }
 await app.db.db.query('insert into public.goat_roles(user_id,role) values($1,$2),($3,$4)',[accounts.researcher.id,'researcher',accounts.commissioner.id,'executive']);
});
after(async()=>{await app.close();});

test('HTTP authentication, origin protection, health and production guards',async()=>{
 assert.equal((await fetch(base+'/health')).status,200);
 const portal = await fetch(base+'/play');
 assert.equal(portal.status,200);
 assert.match(portal.headers.get('content-type'),/text\/html/);
 assert.match(portal.headers.get('content-security-policy'),/script-src 'self'/);
 assert.match(await portal.text(),/GOAT GAMES/);
 const portalScript = await fetch(base+'/play.mjs');
 assert.equal(portalScript.status,200);
 assert.match(await portalScript.text(),/picks_submit/);
 assert.equal((await fetch(base+'/play.css')).status,200);
 assert.equal((await call('query',{op:'me'})).status,401);
 assert.equal((await call('query',{op:'me'},'participant',{Origin:'https://untrusted.invalid'})).status,403);
 const me=await query({op:'me'},'participant');assert.deepEqual(me.roles,[]);
 assert.throws(()=>configuration({APP_ENV:'production',BACKEND_MODE:'local'}),/local_auth_forbidden/);
 assert.throws(()=>configuration({BACKEND_MODE:'supabase',SUPABASE_URL:'https://opvoemihfyxidzbdyory.supabase.co',SUPABASE_PUBLISHABLE_KEY:'test'}),/production_project_forbidden/);
 assert.equal((await call('billing/checkout',{tier:'member'},'participant')).data.error,'payments_not_enabled');
});

test('complete 13-game / 61-point season with ranked ATS picks, MVP, standings and immutable history',async()=>{
 const league=await command({op:'league_create',name:'NFL Playoff SCORING TEST FIXTURE',sport:'NFL',season:'test',rules:{approved:false,source_reference:'Test fixture based on verified weights',tiebreaker:'ats_record',max_points:61,unresolved:[]}});
 const league_id=league.id;
 const rounds=[];
 for(const spec of [{name:'Wild Card',weights:[1,2,3,4,5,6]},{name:'Divisional',weights:[2,4,5,7]},{name:'Conference',weights:[4,9],weight_options:[[4,9],[5,8],[6,7]]},{name:'Super Bowl',weights:[7],mvp_bonus:2}]) {
  const r=await command({op:'round_create',league_id,...spec,lock_at:new Date(Date.now()+86400000).toISOString()});
  const games=[];
  for(let i=0;i<spec.weights.length;i++) games.push((await command({op:'game_create',round_id:r.id,home:`HOME ${i} TEST FIXTURE`,away:`AWAY ${i} TEST FIXTURE`,starts_at:new Date(Date.now()+172800000).toISOString(),home_spread:-3.5,source_url:'https://fixtures.invalid/explicit-test-only'})).id);
  rounds.push({...spec,id:r.id,games});
 }
 assert.equal((await call('commands',{op:'league_open',league_id,reason:'Test'},'commissioner')).data.error,'rules_approval_required');
 await command({op:'league_rules',league_id,rules:{approved:true,source_reference:'Explicit test configuration; 59 plus 2 confirmed by founder',tiebreaker:'ats_record',max_points:61,unresolved:[]}});
 await command({op:'league_open',league_id,reason:'Approve test configuration only'});
 for(const who of ['participant','commissioner']) {
  await command({op:'enroll',league_id},who);await command({op:'entry_decide',league_id,user_id:accounts[who].id,approved:true});
 }
 assert.equal((await call('query',{op:'league',league_id},'outsider')).status,403);
 for(const r of rounds) {
  await command({op:'round_open',round_id:r.id,approved:true,push_multiplier:0,missing_policy:'block',reason:'TEST POLICY, not official unresolved push rule'});
  const participantWeights=r.name==='Conference'?[5,8]:r.weights;
  const picks=r.games.map((game_id,i)=>({game_id,side:'home',weight:participantWeights[i]}));
  const params={op:'picks_submit',round_id:r.id,picks,mvp_pick:r.mvp_bonus?'MVP_TEST_FIXTURE':undefined};
  assert.equal((await call('commands',{...params,picks:picks.map(x=>({...x,weight:1}))},'participant')).data.error, r.games.length===1?'weight_allocation_invalid':'weight_allocation_invalid');
  await command(params,'participant');
  await command({...params,picks:r.games.map((game_id,i)=>({game_id,side:'away',weight:r.weights[i]})),mvp_pick:r.mvp_bonus?'OTHER_TEST_FIXTURE':undefined});
  const privateView=await query({op:'league',league_id});
  assert.equal(privateView.picks.filter(x=>x.user_id===accounts.participant.id && r.games.includes(x.game_id)).length,0,'Commissioner cannot peek before lock');
  await app.db.db.query("update public.goat_rounds set lock_at=now()-interval '1 minute' where id=$1",[r.id]);
  await app.db.db.query("update public.goat_games set starts_at=now()-interval '30 seconds' where round_id=$1",[r.id]);
  assert.equal((await call('commands',params,'participant')).data.error,'selections_locked');
  assert.equal((await call('commands',{op:'result_set',game_id:r.games[0],home_score:20,away_score:10,source_url:'https://fixtures.invalid/result'},'participant')).status,403);
  for(const game_id of r.games) await command({op:'result_set',game_id,home_score:20,away_score:10,source_url:'https://fixtures.invalid/result'});
  if(r.mvp_bonus) await command({op:'mvp_result',round_id:r.id,mvp_result:'MVP_TEST_FIXTURE',source_url:'https://fixtures.invalid/mvp'});
  await command({op:'round_finalize',round_id:r.id});
 }
 const board=await query({op:'standings',league_id});
 assert.equal(Number(board[0].points),61);assert.equal(Number(board[0].wins),13);assert.equal(board[0].user_id,accounts.participant.id);
 assert.equal(Number(board[1].points),0);assert.equal(Number(board[1].losses),13);
 const oldHistory=await query({op:'history',league_id});assert.equal(oldHistory.length,4);
 const target=rounds[0];
 await command({op:'round_reopen',round_id:target.id,reason:'Documented correction test'});
 await command({op:'result_set',game_id:target.games[0],home_score:10,away_score:20,source_url:'https://fixtures.invalid/corrected'});
 await command({op:'round_finalize',round_id:target.id});
 const revised=await query({op:'history',league_id});assert.equal(revised.length,5);assert.deepEqual(revised[0],oldHistory[0]);
 await command({op:'league_finalize',league_id});
 assert.equal((await call('commands',{op:'round_reopen',round_id:target.id,reason:'Should fail'},'commissioner')).data.error,'league_final');
});

test('database authorization denies direct writes and isolates unaffiliated readers',async()=>{
 await assert.rejects(app.db.rpc('goat_command',{op:'league_create'},null,'anon'),/permission denied/);
 await app.db.db.transaction(async tx=>{
  await tx.exec('set local role authenticated');
  await tx.query("select set_config('request.jwt.claim.sub',$1,true)",[accounts.outsider.id]);
  assert.equal((await tx.query('select * from public.goat_leagues')).rows.length,0);
  assert.equal((await tx.query('select * from public.goat_prospects')).rows.length,0);
 });
 await assert.rejects(app.db.db.transaction(async tx=>{await tx.exec('set local role authenticated');await tx.exec("insert into public.goat_roles values(gen_random_uuid(),'executive')");}),/permission denied/);
 await assert.rejects(app.db.rpc('goat_payment_event',{event_id:'evt_illegal',event_type:'test'},accounts.participant.id),/permission denied/);
});

test('CRM qualification, outreach draft, executive approval, suppression and pipeline accounting',async()=>{
 const signals=['audience_fit','commercial_fit','decision_access','timing','engagement'].map(name=>({name,value:3,evidence:'TEST research evidence'}));
 const prospect=await command({op:'crm_prospect',organization:'TEST FIXTURE BUSINESS',website:'https://fixtures.invalid',category:'advertiser',source_url:'https://fixtures.invalid/research',evidence:'Explicit test research record',signals},'researcher');
 assert.equal((await call('query',{op:'crm_report'},'participant')).status,403);
 let report=await query({op:'crm_report'},'researcher');assert.equal(report.interested,0);
 const draft=await call('outreach/prepare',{prospect_id:prospect.id},'researcher');assert.equal(draft.status,200);
 assert.equal((await call('commands',{op:'crm_decide',draft_id:draft.data.id,approved:true,reason:'Test'},'researcher')).status,403);
 await command({op:'crm_decide',draft_id:draft.data.id,approved:true,reason:'TEST approval; no message sent'});
 await command({op:'crm_interest',prospect_id:prospect.id,interest:'interested',permission:'intro_requested',response_evidence:'TEST inbound request evidence',follow_up_at:new Date(Date.now()-60000).toISOString()},'researcher');
 const opportunity=await command({op:'crm_opportunity',prospect_id:prospect.id,amount:1000,currency:'USD',probability:.5,stage:'proposal',evidence_url:'https://fixtures.invalid/opportunity'},'researcher');
 report=await query({op:'crm_report'},'researcher');assert.equal(report.interested,1);assert.equal(report.follow_ups.length,1);assert.equal(Number(report.pipeline_by_currency[0].weighted_pipeline),500);assert.equal(report.pipeline_by_currency[0].contracted_revenue,null);
 await command({op:'crm_opportunity',opportunity_id:opportunity.id,amount:1000,currency:'USD',probability:1,stage:'won',evidence_url:'https://fixtures.invalid/contract'});
 assert.equal((await call('commands',{op:'crm_opportunity',opportunity_id:opportunity.id,amount:1,currency:'USD',probability:0,stage:'lost',evidence_url:'https://fixtures.invalid/unauthorized'},'researcher')).status,403);
 report=await query({op:'crm_report'});assert.equal(Number(report.pipeline_by_currency[0].contracted_revenue),1000);assert.equal(report.pipeline_by_currency[0].weighted_pipeline,null);
 const pending=await command({op:'crm_draft',prospect_id:prospect.id,subject:'TEST',body:'TEST'},'researcher');
 await command({op:'crm_interest',prospect_id:prospect.id,interest:'declined',permission:'do_not_contact',response_evidence:'TEST suppression'},'researcher');
 assert.equal((await call('commands',{op:'crm_decide',draft_id:pending.id,approved:true,reason:'TEST'},'commissioner')).data.error,'prospect_unavailable');
 assert.equal((await call('outreach/send',{draft_id:draft.data.id},'researcher')).status,404);
});

test('consent, membership provisioning, webhook integrity and replay ordering',async()=>{
 assert.equal((await call('commands',{op:'analytics_event',event:'session_started'},'participant')).data.error,'analytics_consent_required');
 await command({op:'analytics_event',event:'session_started',consent:true},'participant');
 await command({op:'newsletter_consent',opted_in:true,consent_version:'TEST consent'},'participant');
 const now=Math.floor(Date.now()/1000), user_id=accounts.participant.id;
 const event={id:'evt_test1',created:now,type:'customer.subscription.updated',data:{object:{id:'sub_test1',metadata:{user_id},status:'active',items:{data:[{price:{id:'price_test'},current_period_end:now+86400}]}}}};
 const raw=Buffer.from(JSON.stringify(event));const signature='t='+now+',v1='+createHmac('sha256','whsec_TEST_ONLY').update(`${now}.`).update(raw).digest('hex');
 const verified=verifiedStripeEvent(raw,signature,'whsec_TEST_ONLY');assert.equal(verified.id,event.id);
 assert.throws(()=>verifiedStripeEvent(Buffer.from('{}'),signature,'whsec_TEST_ONLY'),/invalid_webhook_signature/);
 assert.throws(()=>verifiedStripeEvent(raw,signature,'whsec_TEST_ONLY',Date.now()+600000),/timestamp_expired/);
 const record=paymentRecord(verified,{member:'price_test'});await app.db.systemRpc('goat_payment_event',record);
 assert.deepEqual(await app.db.systemRpc('goat_payment_event',record),{duplicate:true});
 await app.db.systemRpc('goat_payment_event',{...record,event_id:'evt_old',event_time:now-20,status:'canceled'});
 assert.equal((await query({op:'me'},'participant')).membership.status,'active');
 await app.db.systemRpc('goat_payment_event',{...record,event_id:'evt_cancel',event_time:now+20,status:'canceled'});
 assert.equal((await query({op:'me'},'participant')).membership.status,'canceled');
 const report=await query({op:'executive_report'});assert.equal(report.newsletter_opt_ins,1);assert.equal(report.active_memberships,0);
});

test('Supabase adapter forwards the validated user token instead of service privileges',async()=>{
 const requests=[];const fake=async(url,params)=>{requests.push({url,params});return {ok:true,json:async()=>url.endsWith('/user')?{id:randomUUID(),email_confirmed_at:'confirmed'}:{result:'ok'}};};
 const config={url:'https://developmentfixture.supabase.co',publishableKey:'sb_publishable_TEST',systemKey:'sb_secret_TEST'};
 const auth=new SupabaseAuth(config,fake);const user=await auth.user('USER_TEST_TOKEN');assert.equal(user.databaseIdentity,'USER_TEST_TOKEN');
 const db=new SupabaseDatabase(config,fake);await db.rpc('goat_query',{op:'me'},user.databaseIdentity);
 assert.equal(requests[1].params.headers.Authorization,'Bearer USER_TEST_TOKEN');assert.equal(requests[1].params.headers.apikey,config.publishableKey);
 await db.systemRpc('goat_payment_event',{});assert.equal(requests[2].params.headers.Authorization,undefined);assert.equal(requests[2].params.headers.apikey,config.systemKey);
 await assert.rejects(checkout(user.id,'member',{paymentsEnabled:false}),/payments_not_enabled/);
 const liveSession=await checkout(user.id,'member',{paymentsEnabled:true,paymentLaunchApproved:true,tiers:{member:'price_TEST'},stripeSecret:'sk_test_FIXTURE',appOrigin:'https://development.invalid'},async(url,params)=>{
  assert.equal(url,'https://api.stripe.com/v1/checkout/sessions');assert.equal(params.body.get('subscription_data[metadata][user_id]'),user.id);
  return {ok:true,json:async()=>({url:'https://checkout.stripe.com/test-fixture'})};
 });assert.equal(liveSession.url,'https://checkout.stripe.com/test-fixture');
});

test('API cannot elevate metadata roles, spoof another user or invoke billing privileges',async()=>{
 const me=await query({op:'me',user_id:accounts.commissioner.id,role:'executive'},'outsider');assert.equal(me.profile.user_id,accounts.outsider.id);assert.deepEqual(me.roles,[]);
 assert.equal((await call('commands',{op:'grant_role',role:'executive',user_id:accounts.outsider.id},'outsider')).data.error,'unsupported_operation');
 assert.equal((await call('commands',{op:'goat_payment_event',user_id:accounts.outsider.id,tier:'premium'},'outsider')).data.error,'unsupported_operation');
 assert.equal((await call('query',{op:'executive_report',role:'executive'},'outsider')).status,403);
 assert.equal((await call('query',{op:"me'); drop table goat_roles; --"},'outsider')).data.error,'unsupported_query');
});

test('refresh-token rotation and logout revoke local sessions',async()=>{
 const oldToken=accounts.outsider.token,oldRefresh=accounts.outsider.refresh;
 const rotated=await app.auth.refresh({refresh_token:oldRefresh});
 await assert.rejects(app.auth.user(oldToken),/authentication_required/);
 await assert.rejects(app.auth.refresh({refresh_token:oldRefresh}),/invalid_refresh_token/);
 assert.equal((await app.auth.user(rotated.access_token)).id,accounts.outsider.id);
 await app.auth.logout(rotated.access_token);
 await assert.rejects(app.auth.user(rotated.access_token),/authentication_required/);
 await assert.rejects(app.auth.refresh({refresh_token:rotated.refresh_token}),/invalid_refresh_token/);
});

test('development database creates its directory and retains accounts across restart',async()=>{
 const folder=await mkdtemp(join(tmpdir(),'goat-persistence-'));
 const path=join(folder,'new-parent','postgres');
 let db;
 try {
  db=await new LocalDatabase(path).init();let auth=new LocalAuth(db);
  const account=await auth.signup({email:'persistence@fixture.invalid',password:'Fixture-Password-1234',display_name:'PERSISTENCE TEST'});
  const session=await auth.login({email:'persistence@fixture.invalid',password:'Fixture-Password-1234'});
  await db.close();db=await new LocalDatabase(path).init();auth=new LocalAuth(db);
  assert.equal((await auth.user(session.access_token)).id,account.user.id);
  assert.equal((await db.rpc('goat_query',{op:'me'},account.user.id)).profile.display_name,'PERSISTENCE TEST');
 } finally {if(db)await db.close();await rm(folder,{recursive:true,force:true});}
});
