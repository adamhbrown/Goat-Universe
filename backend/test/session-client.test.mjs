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
 const signedOut=c.logout();waiting.resolve(reply(200,{access_token:'LATE_FIXTURE',refresh_token:'LATE_REFRESH'}));await signedOut;
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

test('concurrent 401s and a delayed old-token 401 share exactly one refresh',async()=>{
 const rotating=deferred(),late=deferred(),started=deferred(),calls=[];
 const c=client(async(path,p)=>{
  calls.push({path,p});
  if(path==='/auth/login')return reply(200,tokens);
  if(path==='/auth/refresh'){started.resolve();return rotating.promise;}
  if(p.headers.Authorization==='Bearer ACCESS_FIXTURE')return JSON.parse(p.body).op==='late'?late.promise:reply(401,{});
  return reply(200,{private:'CURRENT_FIXTURE'});
 });
 await c.login({});const queries=['one','two','late'].map(op=>c.query({op}));
 await started.promise;await tick();assert.equal(calls.filter(c=>c.path==='/auth/refresh').length,1);
 rotating.resolve(reply(200,{access_token:'CURRENT_FIXTURE',refresh_token:'CURRENT_REFRESH'}));await tick();
 late.resolve(reply(401,{}));await Promise.all(queries);
 assert.equal(calls.filter(c=>c.path==='/auth/refresh').length,1);
});

test('logout awaits the existing rotation to revoke its token without double-consuming refresh',async()=>{
 const rotating=deferred(),started=deferred(),calls=[];
 const c=client(async(path,p)=>{
  calls.push({path,p});
  if(path==='/auth/login')return reply(200,tokens);
  if(path==='/auth/refresh'){started.resolve();return rotating.promise;}
  if(path==='/query')return reply(401,{});
  if(path==='/auth/logout')return reply(p.headers.Authorization==='Bearer ROTATED_FIXTURE'?200:401,{});
  return reply(200,{});
 });
 await c.login({});const query=c.query({op:'me'}),rejected=assert.rejects(query,/session_changed/);
 await started.promise;const logout=c.logout();await tick();
 await c.request('/probe',{});assert.equal(calls.at(-1).p.headers.Authorization,undefined,'Local credentials clear immediately');
 rotating.resolve(reply(200,{access_token:'ROTATED_FIXTURE',refresh_token:'ROTATED_REFRESH'}));
 await logout;await rejected;
 assert.equal(calls.filter(c=>c.path==='/auth/refresh').length,1);
 assert.equal(calls.filter(c=>c.path==='/auth/logout').at(-1).p.headers.Authorization,'Bearer ROTATED_FIXTURE');
});

test('stale private queries and a failed old rotation cannot erase or disclose a newer account',async()=>{
 const old=deferred(),rotating=deferred(),started=deferred(),calls=[];let logins=0;
 const c=client(async(path,p)=>{
  calls.push({path,p});
  if(path==='/auth/login')return reply(200,++logins===1?tokens:{access_token:'SECOND_ACCOUNT',refresh_token:'SECOND_REFRESH'});
  if(path==='/auth/refresh'){started.resolve();return rotating.promise;}
  if(path==='/query'&&p.headers.Authorization==='Bearer ACCESS_FIXTURE')return JSON.parse(p.body).op==='old'?old.promise:reply(401,{});
  return reply(200,{private:'SECOND_ACCOUNT'});
 });
 await c.login({});const privateQuery=c.query({op:'old'}),refreshQuery=c.query({op:'refresh'});
 const rejected=Promise.all([assert.rejects(privateQuery,/session_changed/),assert.rejects(refreshQuery,/session_changed/)]);
 await started.promise;await c.login({});old.resolve(reply(200,{private:'FIRST_ACCOUNT'}));rotating.resolve(reply(401,{}));await rejected;
 await c.query({op:'me'});assert.equal(calls.at(-1).p.headers.Authorization,'Bearer SECOND_ACCOUNT');
});

test('replacement sign-in clears prior private views even if authentication fails',async()=>{
 const ended=[];let logins=0;
 const c=client(async()=>++logins===1?reply(200,tokens):reply(401,{error:'invalid_credentials'}),{onSessionEnd:r=>ended.push(r)});
 await c.login({});await assert.rejects(c.login({}),/invalid_credentials/);assert.deepEqual(ended,['account_changed']);
});
