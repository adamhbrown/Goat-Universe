// Exact management UI interactions against deterministic local transports.
// This verifies lifecycle behavior, not actual Safari rendering or hosted Auth.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {JSDOM} from 'jsdom';
import {client,pickCommand} from '../portal/forms.mjs';
import {GOAT_GAMES} from '../rules/goat-games.mjs';
const reply=(status,data)=>({ok:status>=200&&status<300,status,json:async()=>data});
const tick=()=>new Promise(r=>setTimeout(r,0));
async function until(check){for(let i=0;i<100;i++){if(check())return;await tick();}throw new Error('interaction timed out');}
async function workspace(transport){
 const dom=new JSDOM(await readFile(new URL('../portal/manage.html',import.meta.url),'utf8'),{url:'https://dev.fixture.invalid/manage'}),calls=[];
 let logins=0;
 const fetch=async(path,p)=>{
  calls.push({path,p});const override=await transport?.(path,p);if(override)return override;
  if(path==='/auth/login')return reply(200,{access_token:'ACCOUNT_'+(++logins),refresh_token:'REFRESH_'+logins});
  if(path==='/goat-games')return reply(200,{games:GOAT_GAMES});
  if(path==='/query')return reply(200,{account:{profile:{user_id:'MEMBER_'+logins,display_name:'Member '+logins},roles:[]},leagues:[]});
  return reply(200,{});
 };
 const source=(await readFile(new URL('../portal/manage.mjs',import.meta.url),'utf8')).replace(/^import .*;\n/gm,'');
 new Function('document','window','fetch','FormData','client','pickCommand',source)(dom.window.document,dom.window,fetch,dom.window.FormData,client,pickCommand);
 const $=s=>dom.window.document.querySelector(s);
 const submit=f=>f.dispatchEvent(new dom.window.SubmitEvent('submit',{bubbles:true,cancelable:true,submitter:f.querySelector('button[value=login]')||f.querySelector('button')}));
 const login=async()=>{const f=$('#account');f.elements.email.value='fixture@fixture.invalid';f.elements.password.value='Fixture-Password-1234';submit(f);await until(()=>f.getAttribute('aria-busy')==='false'&&!$('#dashboard').hidden);};
 return {dom,calls,$,submit,login};
}

test('management logout completes without erasing a later signed-in account',async()=>{
 let finish;const pending=new Promise(r=>{finish=r;});
 const w=await workspace(path=>path==='/auth/logout'?pending:undefined);
 try{
  await w.login();w.$('#logout').click();assert.equal(w.$('#dashboard').hidden,true);
  await w.login();assert.match(w.$('#dashboard').textContent,/Welcome, Member 2/);
  finish(reply(200,{}));await tick();assert.equal(w.$('#dashboard').hidden,false);assert.equal(w.$('#auth').hidden,true);
  assert.equal(w.$('#message').textContent,'Signed in.');
 }finally{w.dom.window.close();}
});

test('stale public catalog completion cannot repopulate a signed-out dashboard',async()=>{
 let finish;const pending=new Promise(r=>{finish=r;});
 const w=await workspace(path=>path==='/goat-games'?pending:undefined);
 try{
  const f=w.$('#account');f.elements.email.value='fixture@fixture.invalid';f.elements.password.value='Fixture-Password-1234';w.submit(f);
  await until(()=>w.calls.some(c=>c.path==='/goat-games'));
  w.dom.window.dispatchEvent(new w.dom.window.Event('pagehide'));
  finish(reply(200,{games:GOAT_GAMES}));await until(()=>f.getAttribute('aria-busy')==='false');
  assert.equal(w.$('#dashboard').hidden,true);assert.equal(w.$('#dashboard').childElementCount,0);assert.equal(w.$('#auth').hidden,false);
 }finally{w.dom.window.close();}
});

test('management recovery is single-flight and retries after provider failure',async()=>{
 let finish;const pending=new Promise(r=>{finish=r;});let available=false;
 const w=await workspace(path=>path==='/auth/recover'?available?reply(200,{}):pending:undefined);
 try{
  const f=w.$('#recovery');f.elements.email.value='fixture@fixture.invalid';w.submit(f);w.submit(f);
  assert.equal(w.calls.filter(c=>c.path==='/auth/recover').length,1);
  finish(reply(503,{error:'temporarily_unavailable'}));await until(()=>!f.querySelector('button').disabled);
  available=true;w.submit(f);await until(()=>w.$('#message').textContent.includes('eligible account'));
  assert.equal(w.calls.filter(c=>c.path==='/auth/recover').length,2);
 }finally{w.dom.window.close();}
});
