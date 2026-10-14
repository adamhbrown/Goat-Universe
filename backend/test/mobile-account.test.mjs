// JSDOM interaction coverage, not a claim of rendering or real iPhone acceptance.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {JSDOM} from 'jsdom';
import {client} from '../portal/forms.mjs';
import {GOAT_GAMES} from '../rules/goat-games.mjs';
const reply=(status,data)=>({ok:status>=200&&status<300,status,json:async()=>data});
const wait=()=>new Promise(r=>setTimeout(r,0));
async function until(check){for(let i=0;i<100;i++){if(check())return;await wait();}throw new Error('interaction timed out');}
async function player(transport){
 const html=await readFile(new URL('../console/play.html',import.meta.url),'utf8');
 const dom=new JSDOM(html,{url:'https://dev.fixture.invalid/play'}),calls=[];
 const fetch=async(path,p)=>{
  assert.ok(path.startsWith('/')&&!path.startsWith('//'));calls.push({path,p});
  if(path==='/goat-games')return reply(200,{games:GOAT_GAMES});
  const special=await transport?.(path,p);if(special)return special;
  if(path==='/auth/login')return reply(200,{access_token:'MOBILE_ACCESS_FIXTURE',refresh_token:'MOBILE_REFRESH_FIXTURE'});
  if(path==='/query')return reply(200,JSON.parse(p.body).op==='me'?{profile:{user_id:'MEMBER_FIXTURE',display_name:'Mobile fixture'}}:[]);
  return reply(200,{});
 };
 const source=(await readFile(new URL('../console/play.mjs',import.meta.url),'utf8')).replace("import {client} from '/manage/forms.mjs';",'');
 new Function('document','window','fetch','client',source)(dom.window.document,dom.window,fetch,client);
 const submit=(id,action='login')=>{const f=dom.window.document.getElementById(id);f.dispatchEvent(new dom.window.SubmitEvent('submit',{bubbles:true,cancelable:true,submitter:f.querySelector(`button[value=${action}]`)||f.querySelector('button[type=submit]')}));};
 return {dom,calls,submit,$:id=>dom.window.document.getElementById(id)};
}

test('mobile player form prevents duplicate account submissions, supports password visibility, and clears secrets',async()=>{
 let finish;const pending=new Promise(r=>finish=r);
 const p=await player(path=>path==='/auth/login'?pending:undefined);
 try{
  p.$('email').value='mobile@fixture.invalid';p.$('password').value='Mobile-Fixture-Password-1234';
  p.$('show-password').click();assert.equal(p.$('password').type,'text');assert.equal(p.$('show-password').getAttribute('aria-pressed'),'true');
  p.submit('account-form');p.submit('account-form');
  assert.equal(p.calls.filter(c=>c.path==='/auth/login').length,1);assert.equal(p.$('account-form').getAttribute('aria-busy'),'true');
  finish(reply(200,{access_token:'MOBILE_ACCESS_FIXTURE',refresh_token:'MOBILE_REFRESH_FIXTURE'}));
  await until(()=>p.$('account-form').getAttribute('aria-busy')==='false');
  assert.equal(p.$('member-panel').hidden,false);assert.equal(p.$('password').value,'');assert.equal(p.$('password').type,'password');
  assert.equal(p.$('goat-games-catalog').children.length,5);assert.equal(p.dom.window.localStorage.length,0);assert.equal(p.dom.window.sessionStorage.length,0);
  assert.doesNotMatch(p.dom.window.document.documentElement.outerHTML,/MOBILE_ACCESS_FIXTURE|MOBILE_REFRESH_FIXTURE/);
 }finally{p.dom.window.close();}
});

test('player recovery stays on the same origin, reports provider unavailability, and restores the retry button',async()=>{
 let available=false;const p=await player(path=>path==='/auth/recover'?reply(available?200:503,available?{recovery_requested:true}:{error:'email_recovery_unavailable_in_local_development'}):undefined);
 try{
  p.$('recovery-email').value='recover@fixture.invalid';p.submit('recovery-form');
  await until(()=>p.$('notice').textContent.includes('unavailable'));assert.equal(p.$('recovery-form').querySelector('button').disabled,false);
  available=true;p.submit('recovery-form');await until(()=>p.$('notice').textContent.includes('eligible account'));
  assert.equal(p.calls.filter(c=>c.path==='/auth/recover').length,2);
  for(const c of p.calls.filter(c=>c.path==='/auth/recover'))assert.equal(c.p.headers.Authorization,undefined);
 }finally{p.dom.window.close();}
});

test('Safari pagehide removes private views and local credentials before back/forward caching',async()=>{
 const p=await player();try{
  p.$('email').value='cache@fixture.invalid';p.$('password').value='Mobile-Fixture-Password-1234';p.submit('account-form');
  await until(()=>!p.$('member-panel').hidden);
  p.$('rounds').textContent='PRIVATE_PICK_FIXTURE';p.$('standings').textContent='PRIVATE_STANDINGS_FIXTURE';
  p.dom.window.dispatchEvent(new p.dom.window.Event('pagehide'));
  assert.equal(p.$('member-panel').hidden,true);assert.equal(p.$('account-panel').hidden,false);
  assert.equal(p.$('rounds').textContent,'');assert.equal(p.$('standings').textContent,'');
  assert.equal(p.$('member-name').textContent,'GOAT Games');
  p.$('reload').click();await wait();assert.equal(p.calls.at(-1).p.headers.Authorization,undefined);
 }finally{p.dom.window.close();}
});
