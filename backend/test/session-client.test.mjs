import test from 'node:test';
import assert from 'node:assert/strict';
import {client} from '../portal/forms.mjs';
const reply=(status,data)=>({ok:status>=200&&status<300,status,json:async()=>data});
function deferred(){let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve};}
const tick=()=>new Promise(r=>setTimeout(r,0));
const tokens={access_token:'ACCESS_FIXTURE',refresh_token:'REFRESH_FIXTURE'};

test('failed refresh clears credentials once and notifies the portal to erase private panels',async()=>{
 const calls=[],ended=[];
 const c=client(async(path,p)=>{
  calls.push({path,p});
  return path==='/auth/login'?reply(200,tokens):reply(401,{error:'authentication_required'});
 },{onSessionEnd:r=>ended.push(r)});
 await c.login({});await assert.rejects(c.query({op:'me'}),/session_expired/);
 assert.deepEqual(ended,['session_expired_please_sign_in']);
 await assert.rejects(c.query({op:'me'}),/authentication_required/);
 assert.equal(calls.at(-1).p.headers.Authorization,undefined);
 assert.equal(calls.filter(c=>c.path==='/auth/refresh').length,1);
});

test('late login and private data responses cannot resurrect a signed-out session',async()=>{
 for(const pendingPath of ['/auth/login','/query']) {
  const waiting=deferred(),started=deferred(),calls=[];
  const c=client(async(path,p)=>{
   calls.push({path,p});
   if(path===pendingPath){started.resolve();return waiting.promise;}
   return path==='/auth/login'?reply(200,tokens):reply(200,{});
  });
  if(pendingPath!=='/auth/login')await c.login({});
  const pending=pendingPath==='/auth/login'?c.login({}):c.query({op:'dashboard'});
  await started.promise;await c.logout();
  waiting.resolve(reply(200,pendingPath==='/auth/login'?tokens:{private:'OLD_ACCOUNT_FIXTURE'}));
  await assert.rejects(pending,/session_changed/);
  // A public query succeeds in this mock; inspect its header, not server policy.
  const next=c.request('/probe',{});await next;assert.equal(calls.at(-1).p.headers.Authorization,undefined);
 }
});

test('sign-out remains local immediately when an in-flight refresh finishes later',async()=>{
 const waiting=deferred(),started=deferred(),calls=[];
 const c=client(async(path,p)=>{
  calls.push({path,p});
  if(path==='/auth/login')return reply(200,tokens);
  if(path==='/auth/refresh'){started.resolve();return waiting.promise;}
  if(path==='/query')return reply(401,{error:'authentication_required'});
  return reply(200,{});
 });
 await c.login({});const pending=c.query({op:'me'});await started.promise;
 await c.logout();waiting.resolve(reply(200,{access_token:'LATE_FIXTURE',refresh_token:'LATE_REFRESH'}));
 await assert.rejects(pending,/session_changed/);
 await c.request('/probe',{});assert.equal(calls.at(-1).p.headers.Authorization,undefined);
});

test('expired access at logout refreshes only to revoke the old session without restoring it',async()=>{
 const calls=[],ended=[];
 const c=client(async(path,p)=>{
  calls.push({path,p});
  if(path==='/auth/login')return reply(200,tokens);
  if(path==='/auth/refresh')return reply(200,{access_token:'ROTATED_FIXTURE',refresh_token:'ROTATED_REFRESH'});
  if(path==='/auth/logout'&&p.headers.Authorization==='Bearer ACCESS_FIXTURE')return reply(401,{});
  return reply(200,{});
 },{onSessionEnd:r=>ended.push(r)});
 await c.login({});await c.logout();
 assert.deepEqual(calls.map(c=>c.path),['/auth/login','/auth/logout','/auth/refresh','/auth/logout']);
 assert.equal(calls.at(-1).p.headers.Authorization,'Bearer ROTATED_FIXTURE');
 await c.request('/probe',{});assert.equal(calls.at(-1).p.headers.Authorization,undefined);assert.deepEqual(ended,['signed_out']);
});

test('an older account response cannot overwrite a newly signed-in account',async()=>{
 const first=deferred();let logins=0;const calls=[];
 const c=client(async(path,p)=>{
  calls.push({path,p});
  if(path==='/auth/login')return ++logins===1?first.promise:reply(200,{access_token:'NEW_ACCOUNT_FIXTURE',refresh_token:'NEW_REFRESH'});
  return reply(200,{});
 });
 const old=c.login({});await tick();await c.login({});first.resolve(reply(200,tokens));
 await assert.rejects(old,/session_changed/);await c.query({op:'me'});
 assert.equal(calls.at(-1).p.headers.Authorization,'Bearer NEW_ACCOUNT_FIXTURE');
});

test('sign-out transport failure still clears browser credentials and reports unconfirmed revocation',async()=>{
 const calls=[];
 const c=client(async(path,p)=>{calls.push({path,p});return path==='/auth/login'?reply(200,tokens):reply(503,{});});
 await c.login({});await assert.rejects(c.logout(),/server_signout_unconfirmed/);
 await assert.rejects(c.query({op:'me'}),/request_failed/);assert.equal(calls.at(-1).p.headers.Authorization,undefined);
});
