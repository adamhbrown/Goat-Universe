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


test('rapid taps cannot submit duplicate enrollment requests; controls recover after rejection',async()=>{
 let finish;const pending=new Promise(r=>{finish=r;});
 const p=await player((path,payload)=>{
  if(path==='/commands'&&JSON.parse(payload.body).op==='enroll')return pending;
 });
 try{
  p.$('email').value='join@fixture.invalid';p.$('password').value='Fixture-Password-1234';
  p.submit('account-form');await until(()=>!p.$('member-panel').hidden);
  const leagueId='4a5fe0c7-e3ad-4834-9e5a-cd48a25c6b11';
  p.$('invite-id').value=leagueId;
  p.submit('join-form');p.submit('join-form');
  assert.equal(p.calls.filter(c=>c.path==='/commands'&&JSON.parse(c.p.body).op==='enroll').length,1);
  assert.equal(p.$('join-form').querySelector('button').disabled,true);
  finish(reply(503,{error:'temporary_unavailable'}));
  await until(()=>p.$('join-form').querySelector('button').disabled===false);
  assert.match(p.$('notice').textContent,/temporary unavailable/);
  assert.equal(p.$('invite-id').value,leagueId,'Failed join keeps the entered ID for retry');
 }finally{p.dom.window.close();}
});

test('commissioner approve/decline and ranked-pick submissions are single-flight',async()=>{
 const leagueId='4a5fe0c7-e3ad-4834-9e5a-cd48a25c6b11';
 const league={id:leagueId,name:'Fixture League',sport:'NFL',season:'2027',status:'open',owner_id:'MEMBER_FIXTURE'};
 const round={id:'fixture-round',name:'Playoff Round',status:'open',lock_at:'2099-01-01T00:00:00Z',weights:[7],weight_options:[[7]],mvp_bonus:0};
 const game={id:'fixture-game',round_id:round.id,home:'Home Fixture',away:'Away Fixture',home_spread:-3.5};
 const details={league,rounds:[round],games:[game],entries:[{user_id:'PENDING_MEMBER_FIXTURE',status:'pending'}],picks:[]};
 let finishDecision,finishPicks;
 const pendingDecision=new Promise(r=>{finishDecision=r;});
 const pendingPicks=new Promise(r=>{finishPicks=r;});
 const p=await player((path,options)=>{
  if(path==='/query'){
   const op=JSON.parse(options.body).op;
   if(op==='leagues')return reply(200,[league]);
   if(op==='league')return reply(200,details);
   if(op==='standings')return reply(200,[]);
  }
  if(path==='/commands'){
   const op=JSON.parse(options.body).op;
   if(op==='entry_decide')return pendingDecision;
   if(op==='picks_submit')return pendingPicks;
  }
 });
 const count=op=>p.calls.filter(c=>c.path==='/commands'&&JSON.parse(c.p.body).op===op).length;
 try{
  p.$('email').value='commissioner@fixture.invalid';p.$('password').value='Fixture-Password-1234';
  p.submit('account-form');await until(()=>p.$('leagues').querySelector('button'));
  p.$('leagues').querySelector('button').click();await until(()=>!p.$('league-panel').hidden);
  const buttons=p.$('entry-requests').querySelectorAll('button');
  assert.equal(buttons.length,2);
  buttons[0].click();buttons[1].click();
  assert.equal(count('entry_decide'),1,'Approve and decline cannot both be sent');
  assert.equal(buttons[0].disabled,true);assert.equal(buttons[1].disabled,true);
  finishDecision(reply(200,{ok:true}));await until(()=>p.$('notice').textContent==='Entry approved.');
  const form=p.$('rounds').querySelector('form');
  assert.ok(form,'An open ranked-pick form is available');
  const submit=()=>form.dispatchEvent(new p.dom.window.SubmitEvent('submit',{bubbles:true,cancelable:true}));
  submit();submit();
  assert.equal(count('picks_submit'),1,'Only one ranked-pick command can be in flight');
  assert.equal(form.querySelector('button[type=submit]').disabled,true);
  finishPicks(reply(200,{ok:true}));await until(()=>count('picks_submit')===1&&p.$('notice').textContent.includes('saved'));
 }finally{p.dom.window.close();}
});
