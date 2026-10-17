// Runs the actual participant script with controlled HTTP responses in JSDOM.
// This is deterministic DOM testing, not Safari/Chromium or hosted Auth proof.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {JSDOM} from 'jsdom';

const script=(await readFile(new URL('../console/play.mjs',import.meta.url),'utf8')).replace("import {client} from '/manage/forms.mjs';",'');
// Preserve these regressions when the participant adopts the shared session
// client. Introspection is inserted only into the in-memory test copy.
const clientSource=(await readFile(new URL('../portal/forms.mjs',import.meta.url),'utf8'))
 .replaceAll('export function ','function ')
 .replace('    request,','    request,\n    testSet(a,r){clear();setSession({access_token:a,refresh_token:r});},\n    testState(){return {accessToken:access,refreshToken:refresh,sessionVersion:generation};},');
const testClient=new Function(clientSource+'\nreturn client;')();
const html=await readFile(new URL('../console/play.html',import.meta.url),'utf8');
const reply=(status,value={})=>({status,ok:status>=200&&status<300,json:async()=>value});
function deferred(){let resolve;const promise=new Promise(r=>{resolve=r;});return {promise,resolve};}
async function tick(){await new Promise(r=>setImmediate(r));}
function setup(handler) {
 const dom=new JSDOM(html,{url:'https://fixture.invalid/play'});
 const fetch=async(path,options)=>path==='/goat-games'?reply(200,{games:[]}):handler(path,options);
 // The appended hooks exist only in this test; no token hooks are shipped.
 const api=new Function('document','fetch','navigator','client',script+`\nreturn {send,query,openLeague,showSignedOut,
  setSession(a,r){showSignedOut();api.testSet(a,r);},
  state(){return api.testState();}};`)(dom.window.document,fetch,dom.window.navigator,testClient);
 api.setSession('access_old','refresh_old');
 return {dom,api,close:()=>dom.window.close()};
}
test('two concurrent league queries share one rotating refresh and both retry successfully',async()=>{
 let refreshes=0;const refresh=deferred(),retried=[];
 const h=setup(async(path,options)=>{
  if(path==='/auth/refresh'){refreshes++;assert.equal(JSON.parse(options.body).refresh_token,'refresh_old');return refresh.promise;}
  if(options.headers.Authorization==='Bearer access_old')return reply(401);
  retried.push(JSON.parse(options.body).op);assert.equal(options.headers.Authorization,'Bearer access_new');return reply(200,{ok:true});
 });
 try {
  const league=h.api.query('league'),standings=h.api.query('standings');
  await tick();assert.equal(refreshes,1);
  refresh.resolve(reply(200,{access_token:'access_new',refresh_token:'refresh_new'}));
  assert.deepEqual(await Promise.all([league,standings]),[{ok:true},{ok:true}]);
  assert.deepEqual(retried.sort(),['league','standings']);assert.equal(refreshes,1);
  assert.equal(h.api.state().refreshToken,'refresh_new');
 } finally {h.close();}
});
test('a delayed old-token 401 reuses the rotated access token without refreshing again',async()=>{
 const late=deferred();let refreshes=0;
 const h=setup(async(path,options)=>{
  if(path==='/auth/refresh'){refreshes++;return reply(200,{access_token:'access_new',refresh_token:'refresh_new'});}
  if(options.headers.Authorization==='Bearer access_old')return JSON.parse(options.body).op==='late'?late.promise:reply(401);
  return reply(200,{ok:true});
 });
 try {
  const pending=h.api.query('late');await h.api.query('first');late.resolve(reply(401));await pending;
  assert.equal(refreshes,1);assert.equal(h.api.state().accessToken,'access_new');
 } finally {h.close();}
});
test('one failed refresh signs out once, rejects all waiters and never loops',async()=>{
 let refreshes=0;const h=setup(async path=>{if(path==='/auth/refresh'){refreshes++;return reply(401,{error:'invalid_refresh_token'});}return reply(401);});
 try {
  const results=await Promise.allSettled([h.api.query('league'),h.api.query('standings')]);
  assert.ok(results.every(x=>x.status==='rejected'));assert.equal(refreshes,1);
  assert.equal(h.api.state().accessToken,'');assert.equal(h.dom.window.document.getElementById('account-panel').hidden,false);
 } finally {h.close();}
});
test('logout during refresh cannot restore credentials or reopen a private panel',async()=>{
 const refresh=deferred(),started=deferred();
 const h=setup(async path=>{if(path==='/auth/refresh'){started.resolve();return refresh.promise;}return reply(401);});
 try {
  const pending=h.api.query('league');const rejection=assert.rejects(pending,/session_changed/);
  await started.promise;h.dom.window.document.getElementById('signout').click();
  assert.equal(h.api.state().accessToken,'');
  refresh.resolve(reply(200,{access_token:'obsolete',refresh_token:'obsolete'}));await rejection;await tick();
  assert.equal(h.api.state().accessToken,'');assert.equal(h.dom.window.document.getElementById('league-panel').hidden,true);
 } finally {h.close();}
});
test('an old failed refresh cannot sign out a more recent login',async()=>{
 const refresh=deferred(),started=deferred();
 const h=setup(async path=>{if(path==='/auth/refresh'){started.resolve();return refresh.promise;}return reply(401);});
 try {
  const pending=h.api.query('league');const rejection=assert.rejects(pending,/session_changed/);
  await started.promise;h.api.setSession('new_login','new_refresh');
  refresh.resolve(reply(401,{error:'invalid_refresh_token'}));await rejection;
  assert.equal(h.api.state().accessToken,'new_login');assert.equal(h.api.state().refreshToken,'new_refresh');
 } finally {h.close();}
});
test('a retried 401 stops after one refresh; malformed refresh responses fail closed',async()=>{
 for(const result of [{access_token:'new',refresh_token:'new'},{}]) {
  let refreshes=0,queries=0;
  const h=setup(async path=>{if(path==='/auth/refresh'){refreshes++;return reply(200,result);}queries++;return reply(401,{error:'authentication_required'});});
  try {
   await assert.rejects(h.api.query('me'),/session_expired|authentication_required/);assert.equal(refreshes,1);assert.ok(queries<=2);assert.equal(h.api.state().accessToken,'');
  } finally {h.close();}
 }
});
test('back navigation invalidates a pending league render',async()=>{
 const league=deferred();
 const h=setup(async(_path,options)=>JSON.parse(options.body).op==='league'?league.promise:reply(200,[]));
 try {
  const pending=h.api.openLeague('fixture');h.dom.window.document.getElementById('back').click();
  league.resolve(reply(200,{}));await pending;
  assert.equal(h.dom.window.document.getElementById('league-panel').hidden,true);
  assert.equal(h.dom.window.document.getElementById('member-panel').hidden,false);
 } finally {h.close();}
});
test('a server error after successful refresh preserves the valid session',async()=>{
 const h=setup(async(path,options)=>{
  if(path==='/auth/refresh')return reply(200,{access_token:'access_new',refresh_token:'refresh_new'});
  return options.headers.Authorization==='Bearer access_old'?reply(401):reply(500,{error:'temporarily_unavailable'});
 });
 try {
  await assert.rejects(h.api.query('standings'),/temporarily_unavailable/);
  assert.equal(h.api.state().accessToken,'access_new');assert.equal(h.api.state().refreshToken,'refresh_new');
 } finally {h.close();}
});
