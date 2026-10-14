import test,{before,after} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {JSDOM} from 'jsdom';
import {application} from '../server.mjs';
import {configuration} from '../config.mjs';
import {client} from '../portal/forms.mjs';
import {mountGames} from '../games/ui.mjs';
import {publicCatalog} from '../rules/goat-games.mjs';

let app,base,token;
async function post(path,p){const r=await fetch(base+path,{method:'POST',headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},body:JSON.stringify(p)});return {status:r.status,data:await r.json()};}
before(async()=>{
 app=await application({...configuration({}),localPath:undefined});
 await new Promise((resolve,reject)=>{app.server.once('error',reject);app.server.listen(0,'127.0.0.1',resolve);});base='http://127.0.0.1:'+app.server.address().port;
});
after(async()=>{if(app)await app.close();});
test('all five game screens use backend restrictive headers and the public homepage remains outside this server',async()=>{
 for(const path of ['/games',...publicCatalog().games.map(g=>'/games/'+g.id),'/games/boot.mjs','/games/ui.mjs','/portal/bracket.mjs','/portal/forms.mjs','/rules/goat-games.mjs']){
  const r=await fetch(base+path);assert.equal(r.status,200,path);assert.equal(r.headers.get('cache-control'),'no-store');assert.match(r.headers.get('content-security-policy'),/script-src 'self'/);assert.match(r.headers.get('content-security-policy'),/frame-ancestors 'none'/);
 }
 assert.equal((await fetch(base+'/')).status,404);assert.equal((await fetch(base+'/games/bullpen')).status,404);
 const health=await(await fetch(base+'/health')).json();assert.equal(health.payments_enabled,false);assert.equal(health.auth_email_enabled,false);assert.equal(health.competition_schema_version,1);
});
test('real local registration and API create actor-bound drafts for all five properties; external operations stay disabled',async()=>{
 const account=await post('/auth/signup',{email:'http-games@fixture.invalid',password:'Games-HTTP-Fixture-Password-1234',display_name:'GAMES HTTP FIXTURE',role:'executive'});assert.equal(account.status,201);
 token=(await post('/auth/login',{email:'http-games@fixture.invalid',password:'Games-HTTP-Fixture-Password-1234'})).data.access_token;assert.ok(token);
 for(const g of publicCatalog().games){const draft=await post('/commands',{op:'game_draft_create',game_key:g.id,name:g.name+' SYNTHETIC HTTP DRAFT',season:'2027',owner_id:'10000000-0000-4000-8000-000000000001',rules:{approved:true}});assert.equal(draft.status,200);const view=await post('/query',{op:'league',league_id:draft.data.id});assert.equal(view.data.league.owner_id,account.data.user.id);assert.equal(view.data.league.rules.approved,false);assert.equal(view.data.league.status,'draft');}
 const d=await post('/query',{op:'competition_dashboard'});assert.equal(d.data.competitions.length,5);assert.ok(d.data.competitions.every(g=>g.leagues.length===1));
 assert.deepEqual((await post('/query',{op:'me'})).data.roles,[]);
 assert.equal((await post('/billing/checkout',{tier:'member'})).data.error,'payments_not_enabled');assert.equal((await post('/billing/webhook',{})).data.error,'payments_not_enabled');
 assert.equal((await post('/outreach/send',{})).status,404);assert.equal((await post('/query',{op:'competition_dashboard',user_id:account.data.user.id})).status,200);
});
test('game workspace DOM uses the actual account client and HTTP/database to save a commissioner draft',async()=>{
 const dom=new JSDOM(await readFile(new URL('../games/index.html',import.meta.url),'utf8'),{url:base+'/games/goat-classic'});
 try{
  await mountGames({document:dom.window.document,location:dom.window.location,history:dom.window.history,createClient:()=>client((path,p)=>fetch(base+path,p)),fetchPublic:path=>fetch(base+path)});
  const d=dom.window.document,login=d.getElementById('account-form');login.elements.email.value='http-games@fixture.invalid';login.elements.password.value='Games-HTTP-Fixture-Password-1234';
  const submit=f=>f.dispatchEvent(new dom.window.SubmitEvent('submit',{bubbles:true,cancelable:true,submitter:f.querySelector('button[type=submit]')}));submit(login);
  async function until(fn){for(let i=0;i<200;i++){if(fn())return;await new Promise(r=>setTimeout(r,5));}assert.fail('HTTP DOM workflow timed out');}
  await until(()=>!d.getElementById('member-panel').hidden);
  const create=[...d.getElementById('member-actions').querySelectorAll('form')].find(f=>f.textContent.includes('Create draft'));assert.ok(create);create.elements.name.value='REAL DOM DATABASE FIXTURE';create.elements.season.value='2027';submit(create);
  await until(()=>d.getElementById('league-panel').textContent.includes('REAL DOM DATABASE FIXTURE'));
  const stored=(await app.db.db.query("select status,rules from public.goat_leagues where name='REAL DOM DATABASE FIXTURE'")).rows;assert.equal(stored.length,1);assert.equal(stored[0].status,'draft');assert.equal(stored[0].rules.approved,false);
  assert.match(d.getElementById('league-panel').textContent,/Scoring disabled/);
  d.getElementById('sign-out').click();assert.equal(d.getElementById('league-panel').hidden,true);assert.equal(d.window?.localStorage?.length||0,0);
 }finally{dom.window.close();}
});
