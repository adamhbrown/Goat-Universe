import test,{before,after} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {JSDOM} from 'jsdom';
import {application} from '../server.mjs';
import {configuration} from '../config.mjs';
import {SupabaseAuth} from '../auth.mjs';

let app,base,first,second,session,otherSession;
const OLD='Original-Fixture-Password-1234',NEW='Replacement-Fixture-Password-5678';
async function post(path,p,token){const r=await fetch(base+path,{method:'POST',headers:{'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`}:{})},body:JSON.stringify(p)});return {status:r.status,data:await r.json()};}
before(async()=>{
 app=await application({...configuration({}),localPath:undefined});await new Promise(r=>app.server.listen(0,'127.0.0.1',r));base=`http://127.0.0.1:${app.server.address().port}`;
 first=await app.auth.signup({email:'change@fixture.invalid',password:OLD,display_name:'Password fixture'});second=await app.auth.signup({email:'other@fixture.invalid',password:OLD});
 session=await app.auth.login({email:first.user.email,password:OLD});otherSession=await app.auth.login({email:first.user.email,password:OLD});
});
after(async()=>app.close());

test('local account recovery is explicit about unavailable email and GET callbacks never verify tokens',async()=>{
 const recover=await post('/auth/recover',{email:first.user.email});assert.equal(recover.status,503);assert.equal(recover.data.error,'email_recovery_unavailable_in_local_development');
 assert.equal((await post('/auth/reset',{token_hash:'FIXTURE_HASH_ONLY_0123456789',new_password:NEW})).status,403);
 for(const [path,type] of [['/auth/callback?token_hash=FIXTURE_HASH_ONLY_0123456789&type=signup','text/html'],['/auth/callback.mjs','text/javascript'],['/manage/bracket.mjs','text/javascript']]){
  const r=await fetch(base+path);assert.equal(r.status,200);assert.ok(r.headers.get('Content-Type').startsWith(type));assert.equal(r.headers.get('Referrer-Policy'),'no-referrer');assert.equal(r.headers.get('Cache-Control'),'no-store');
 }
 assert.equal((await app.auth.user(session.access_token)).id,first.user.id);
});

test('password change requires current credentials, binds identity to session and revokes every old session/refresh',async()=>{
 assert.equal((await post('/auth/password',{current_password:OLD,new_password:NEW})).status,401);
 assert.equal((await post('/auth/password',{current_password:'Wrong-Fixture-Password-1234',new_password:NEW},session.access_token)).status,401);
 assert.equal((await post('/auth/password',{current_password:OLD,new_password:'short'},session.access_token)).status,400);
 const result=await post('/auth/password',{current_password:OLD,new_password:NEW,user_id:second.user.id},session.access_token);assert.equal(result.status,200);assert.deepEqual(result.data,{password_updated:true,sign_in_required:true});
 for(const s of [session,otherSession]){await assert.rejects(app.auth.user(s.access_token),/authentication_required/);await assert.rejects(app.auth.refresh({refresh_token:s.refresh_token}),/invalid_refresh_token/);}
 await assert.rejects(app.auth.login({email:first.user.email,password:OLD}),/invalid_credentials/);
 const fresh=await app.auth.login({email:first.user.email,password:NEW});assert.equal((await app.auth.user(fresh.access_token)).id,first.user.id);
 assert.ok((await app.auth.login({email:second.user.email,password:OLD})).access_token,'User-supplied ID cannot change another account');
 const row=(await app.db.db.query('select hash,salt from dev_auth.credentials where user_id=$1',[first.user.id])).rows[0];assert.notEqual(row.hash,NEW);assert.equal(row.hash.length,128);
});

function mockAuth({emailEnabled=true,failUpdate=false,failRevoke=false,unconfirmed=false}={}){
 const calls=[],uid=randomUUID(),origin='https://development.fixture.invalid';
 const user={id:uid,email:'user@fixture.invalid',email_confirmed_at:unconfirmed?null:'2026-10-14T00:00:00Z'};
 const fake=async(url,p)=>{
  assert.ok(url.startsWith('https://developmentfixture.supabase.co/auth/v1/'));
  calls.push({url,method:p.method,headers:p.headers,body:p.body?JSON.parse(p.body):undefined});
  if(url.includes('/verify'))return {ok:!unconfirmed,json:async()=>({user,access_token:'OTP_ACCESS_FIXTURE',refresh_token:'OTP_REFRESH_FIXTURE'})};
  if(url.endsWith('/user')&&p.method==='PUT')return {ok:!failUpdate,json:async()=>user};
  if(url.includes('logout?scope=global'))return {ok:!failRevoke,json:async()=>({})};
  if(url.includes('/token?'))return {ok:true,json:async()=>({user,access_token:'REAUTH_ACCESS_FIXTURE'})};
  if(url.endsWith('/user'))return {ok:true,json:async()=>user};
  if(url.includes('/signup?'))return {ok:true,json:async()=>({user:{id:uid,email_confirmed_at:null}})};
  return {ok:true,json:async()=>({})};
 };
 return {auth:new SupabaseAuth({url:'https://developmentfixture.supabase.co',publishableKey:'sb_publishable_FIXTURE',appOrigin:origin,authEmailEnabled:emailEnabled},fake),calls,uid,origin};
}
test('Supabase email gate prevents requests; signup/recovery use fixed callback and no account enumeration or privileged key',async()=>{
 const disabled=mockAuth({emailEnabled:false});await assert.rejects(disabled.auth.signup({email:'user@fixture.invalid',password:OLD}),/auth_email_not_enabled/);await assert.rejects(disabled.auth.recover({email:'user@fixture.invalid'}),/auth_email_not_enabled/);assert.equal(disabled.calls.length,0);
 const {auth,calls,origin}=mockAuth();const signup=await auth.signup({email:'user@fixture.invalid',password:OLD,role:'executive',redirect_to:'https://attacker.invalid'});assert.deepEqual(signup,{confirmation_required:true,environment:'supabase'});
 assert.equal(new URL(calls[0].url).searchParams.get('redirect_to'),origin+'/auth/callback');assert.equal(calls[0].body.data.role,undefined);
 const known=await auth.recover({email:'user@fixture.invalid',redirect_to:'https://attacker.invalid'}),unknown=await auth.recover({email:'unknown@fixture.invalid'});assert.deepEqual(known,unknown);
 for(const call of calls){assert.equal(call.headers.apikey,'sb_publishable_FIXTURE');assert.equal(call.headers.Authorization,undefined);assert.equal(new URL(call.url).searchParams.get('redirect_to'),origin+'/auth/callback');}
});
test('confirmation verifies signup hash, exposes no session and closes the unused OTP session',async()=>{
 const {auth,calls}=mockAuth();const result=await auth.confirm({token_hash:'FIXTURE_HASH_ONLY_0123456789',type:'recovery'});assert.deepEqual(result,{email_confirmed:true,sign_in_required:true});
 assert.equal(calls[0].body.type,'email');assert.equal(calls[1].headers.Authorization,'Bearer OTP_ACCESS_FIXTURE');assert.ok(calls[1].url.endsWith('logout?scope=local'));
 await assert.rejects(auth.confirm({token_hash:'bad'}),/invalid_email_link/);
});
test('password recovery verifies only recovery OTP, replaces password and globally revokes sessions without returning tokens',async()=>{
 const {auth,calls}=mockAuth();const result=await auth.reset({token_hash:'FIXTURE_HASH_ONLY_0123456789',new_password:NEW,user_id:'UNTRUSTED_ID'});assert.deepEqual(result,{password_updated:true,sign_in_required:true});
 assert.deepEqual(calls.map(c=>c.method),['POST','PUT','POST']);assert.equal(calls[0].body.type,'recovery');assert.equal(calls[1].headers.Authorization,'Bearer OTP_ACCESS_FIXTURE');assert.deepEqual(calls[1].body,{password:NEW});assert.ok(calls[2].url.endsWith('logout?scope=global'));
 const unconfirmed=mockAuth({unconfirmed:true});await assert.rejects(unconfirmed.auth.reset({token_hash:'FIXTURE_HASH_ONLY_0123456789',new_password:NEW}),/authentication_failed/);assert.equal(unconfirmed.calls.length,1);
 const failed=mockAuth({failUpdate:true});await assert.rejects(failed.auth.reset({token_hash:'FIXTURE_HASH_ONLY_0123456789',new_password:NEW}),/authentication_required/);assert.ok(failed.calls.at(-1).url.endsWith('logout?scope=local'));
 const revoke=mockAuth({failRevoke:true});await assert.rejects(revoke.auth.reset({token_hash:'FIXTURE_HASH_ONLY_0123456789',new_password:NEW}),/password_updated_session_revocation_failed/);
});
test('hosted password changes reauthenticate the session owner before update and global logout',async()=>{
 const {auth,calls}=mockAuth();await auth.password({current_password:OLD,new_password:NEW,user_id:'UNTRUSTED_ID'},'CURRENT_ACCESS_FIXTURE');
 assert.equal(calls[0].headers.Authorization,'Bearer CURRENT_ACCESS_FIXTURE');assert.deepEqual(calls[1].body,{email:'user@fixture.invalid',password:OLD});assert.equal(calls[2].headers.Authorization,'Bearer REAUTH_ACCESS_FIXTURE');assert.ok(calls[3].url.endsWith('logout?scope=global'));
});

test('ordinary hosted logout revokes only the current session',async()=>{
 const {auth,calls}=mockAuth();await auth.logout('CURRENT_ACCESS_FIXTURE');
 assert.equal(calls.length,1);assert.ok(calls[0].url.endsWith('logout?scope=local'));
 assert.equal(calls[0].headers.Authorization,'Bearer CURRENT_ACCESS_FIXTURE');
});

async function callbackDOM({type='recovery',token='FIXTURE_HASH_ONLY_0123456789',implicit=false,transport}={}){
 const dom=new JSDOM(await readFile(new URL('../portal/callback.html',import.meta.url),'utf8'),{url:'https://development.fixture.invalid/auth/callback#'+new URLSearchParams(implicit?{access_token:token,refresh_token:token,type}:{token_hash:token,type})});
 const calls=[];dom.window.fetch=async(path,p)=>{assert.ok(path.startsWith('/auth/'));calls.push({path,body:JSON.parse(p.body)});return transport?transport(path,p):{ok:true,json:async()=>({password_updated:true,email_confirmed:true})};};
 const script=await readFile(new URL('../portal/callback.mjs',import.meta.url),'utf8');dom.window.eval=undefined;
 // Run the exact callback code with window bindings, without a network/browser.
 const execute=new Function('document','location','history','URLSearchParams','fetch','window',script);execute(dom.window.document,dom.window.location,dom.window.history,dom.window.URLSearchParams,dom.window.fetch,dom.window);
 return {dom,calls};
}
test('callback clears link hash, waits for explicit submission, validates repeat password and never stores tokens',async()=>{
 const {dom,calls}=await callbackDOM();const d=dom.window.document,f=d.querySelector('#reset');assert.equal(dom.window.location.hash,'');assert.equal(f.hidden,false);assert.equal(calls.length,0);
 f.elements.new_password.value=NEW;f.elements.repeat_password.value='different';f.dispatchEvent(new dom.window.SubmitEvent('submit',{bubbles:true,cancelable:true}));await new Promise(r=>setTimeout(r,0));assert.equal(calls.length,0);assert.match(d.querySelector('#message').textContent,/do not match/);
 f.elements.new_password.value=NEW;f.elements.repeat_password.value=NEW;f.dispatchEvent(new dom.window.SubmitEvent('submit',{bubbles:true,cancelable:true}));await new Promise(r=>setTimeout(r,0));assert.equal(calls.length,1);assert.equal(calls[0].path,'/auth/reset');assert.equal(f.elements.new_password.value,'');assert.equal(f.hidden,true);assert.equal(dom.window.localStorage.length,0);dom.window.close();
 const invalid=await callbackDOM({implicit:true});assert.match(invalid.dom.window.document.querySelector('#message').textContent,/unsupported/);assert.equal(invalid.dom.window.location.hash,'');assert.equal(invalid.calls.length,0);invalid.dom.window.close();
});

test('email callbacks send one request under double taps and allow retry after failure',async()=>{
 for(const type of ['signup','recovery']){
  let finish;const pending=new Promise(r=>{finish=r;});let fail=true;
  const {dom,calls}=await callbackDOM({type,transport:()=>fail?pending:Promise.resolve({ok:true,json:async()=>({})})});
  try{
   const f=dom.window.document.getElementById(type==='signup'?'confirm':'reset');
   const submit=()=>f.dispatchEvent(new dom.window.SubmitEvent('submit',{bubbles:true,cancelable:true}));
   if(type==='recovery'){f.elements.new_password.value=NEW;f.elements.repeat_password.value=NEW;}
   submit();submit();assert.equal(calls.length,1);assert.equal(f.getAttribute('aria-busy'),'true');
   finish({ok:false,json:async()=>({error:'temporarily_unavailable'})});await new Promise(r=>setTimeout(r,0));
   assert.equal(f.hidden,false);assert.equal(f.querySelector('button').disabled,false);
   fail=false;if(type==='recovery'){f.elements.new_password.value=NEW;f.elements.repeat_password.value=NEW;}
   submit();await new Promise(r=>setTimeout(r,0));assert.equal(calls.length,2);assert.equal(f.hidden,true);
  }finally{dom.window.close();}
 }
});

test('Safari pagehide clears callback secrets and rejects late success',async()=>{
 let finish;const {dom,calls}=await callbackDOM({transport:()=>new Promise(r=>{finish=r;})});
 try{
  const f=dom.window.document.getElementById('reset'),message=dom.window.document.getElementById('message');
  f.elements.new_password.value=NEW;f.elements.repeat_password.value=NEW;
  const submit=()=>f.dispatchEvent(new dom.window.SubmitEvent('submit',{bubbles:true,cancelable:true}));
  submit();dom.window.dispatchEvent(new dom.window.Event('pagehide'));
  assert.equal(f.elements.new_password.value,'');assert.equal(f.elements.repeat_password.value,'');assert.equal(f.hidden,true);
  finish({ok:true,json:async()=>({})});await new Promise(r=>setTimeout(r,0));
  assert.match(message.textContent,/Request a new email link/);submit();assert.equal(calls.length,1);
 }finally{dom.window.close();}
});

test('concurrent password changes cannot both succeed, and a racing old-password login cannot survive the change',async()=>{
 const account=await app.auth.signup({email:'concurrent-password@fixture.invalid',password:OLD});
 const one=await app.auth.login({email:account.user.email,password:OLD}),two=await app.auth.login({email:account.user.email,password:OLD});
 const alternatives=['Concurrent-Password-A-1234','Concurrent-Password-B-5678'];
 const results=await Promise.allSettled([app.auth.password({current_password:OLD,new_password:alternatives[0]},one.access_token),app.auth.password({current_password:OLD,new_password:alternatives[1]},two.access_token)]);
 assert.equal(results.filter(r=>r.status==='fulfilled').length,1);assert.equal(results.filter(r=>r.status==='rejected').length,1);
 const active=alternatives[results.findIndex(r=>r.status==='fulfilled')];
 const session=await app.auth.login({email:account.user.email,password:active});
 const [login,change]=await Promise.allSettled([app.auth.login({email:account.user.email,password:active}),app.auth.password({current_password:active,new_password:NEW},session.access_token)]);
 assert.equal(change.status,'fulfilled');if(login.status==='fulfilled')await assert.rejects(app.auth.user(login.value.access_token),/authentication_required/);
 await assert.rejects(app.auth.login({email:account.user.email,password:active}),/invalid_credentials/);assert.ok((await app.auth.login({email:account.user.email,password:NEW})).access_token);
});
