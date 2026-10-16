import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {JSDOM} from 'jsdom';
import {mountGames} from '../games/ui.mjs';
import {competitionAsset} from '../games/routes.mjs';
import {publicCatalog} from '../rules/goat-games.mjs';

const ME='10000000-0000-4000-8000-000000000001',OWNER='10000000-0000-4000-8000-000000000002',LID='20000000-0000-4000-8000-000000000001';
const future='2099-01-01T00:00:00Z',past='2020-01-01T00:00:00Z';
const profile=JSON.parse(await readFile(new URL('../rules/nfl-playoffs-61.json',import.meta.url),'utf8'));
const html=await readFile(new URL('../games/index.html',import.meta.url),'utf8');
const wait=()=>new Promise(r=>setTimeout(r,0));
async function until(fn){for(let i=0;i<100;i++){if(fn())return;await new Promise(r=>setTimeout(r,5));}assert.fail('UI did not reach expected state');}
function fixture(key,owner=OWNER){return {league:{id:LID,game_key:key,strategy:key==='horns-and-hoops'?'ncaa_bracket_v1':'ranked_ats_v1',name:'SYNTHETIC UI COMPETITION',season:'2027',owner_id:owner,status:'open',rules:{approved:false,unresolved:['Official rules pending']}},server_time:'2026-10-14T12:00:00Z',entries:[{user_id:ME,display_name:'FIXTURE MEMBER',status:'approved'}],rounds:[],games:[],picks:[],submissions:[],bracket_nodes:[],bracket_picks:[],bracket_submissions:[],series_events:[],series_picks:[],fantasy_teams:[],fantasy_matchups:[],fantasy_seeds:[]};}
async function workspace(key='',data,overrides={}){
 const dom=new JSDOM(html,{url:'https://workspace.fixture.invalid/games'+(key?'/'+key:'')});
 const calls=[];let commands=overrides.command;
 const api={login:async p=>{calls.push({type:'login',p});},signup:async()=>({confirmation_required:false}),logout:async()=>{},
  query:async p=>{calls.push({type:'query',p});const special=overrides.query?.(p);if(special!==undefined)return special;
   if(p.op==='me')return {profile:{user_id:ME,display_name:'FIXTURE MEMBER'}};
   if(p.op==='competition_dashboard')return {competitions:publicCatalog().games.map(g=>({game_key:g.id,leagues:data&&g.id===key?[{...data.league,entry_status:'approved'}]:[]}))};
   if(p.op==='league')return data;if(p.op==='standings')return overrides.standings||[];if(p.op==='history'||p.op==='annuals')return [];throw new Error('unexpected query '+p.op);
  },command:async p=>{calls.push({type:'command',p});return commands?commands(p):{id:LID};}
 };
 if(overrides.logout)api.logout=overrides.logout;
 const controller=await mountGames({document:dom.window.document,location:dom.window.location,history:dom.window.history,createClient:()=>api,now:overrides.now,fetchPublic:async p=>({ok:true,json:async()=>p==='/nfl61.json'?profile:publicCatalog()})});
 const $=id=>dom.window.document.getElementById(id);
 const submit=f=>f.dispatchEvent(new dom.window.SubmitEvent('submit',{bubbles:true,cancelable:true,submitter:f.querySelector('button[type=submit]')}));
 const login=async()=>{$('account-form').elements.email.value='member@fixture.invalid';$('account-form').elements.password.value='Workspace-Fixture-Password-1234';submit($('account-form'));await until(()=>!$('member-panel').hidden);};
 const open=async()=>{await login();await controller.openLeague(LID);assert.equal($('league-panel').hidden,false);};
 return {dom,controller,calls,api,$,submit,login,open,setCommand:fn=>{commands=fn;}};
}
const formWith=(root,text)=>[...root.querySelectorAll('form')].find(f=>f.querySelector('button[type=submit]')?.textContent===text);

test('all five screens and assets are served from an explicit allowlist; traversal and unrelated screens are excluded',async()=>{
 for(const g of publicCatalog().games){const a=await competitionAsset('/games/'+g.id);assert.equal(a.type,'text/html');assert.match(a.content.toString(),/game-nav/);}
 for(const path of ['/games/boot.mjs','/games/ui.mjs','/games/nfl.mjs','/games/series.mjs','/games/fantasy.mjs','/games/annual.mjs','/games/drafts.mjs','/games/deadlines.mjs','/games/imports.mjs','/games/overview.mjs','/games/history.mjs','/games/style.css','/portal/forms.mjs','/portal/bracket.mjs','/rules/goat-games.mjs'])assert.ok(await competitionAsset(path));
 for(const path of ['/','/games/bullpen','/games-extra/goat-crossover','/games/../server.mjs','/games/auth.mjs','/games/goat-classic/extra'])assert.equal(await competitionAsset(path),null);
});
test('five-game navigation distinguishes rule-gated workspaces and never displays demo scores or BAAS allocations',async()=>{
 const p=await workspace();try{
  assert.equal(p.$('catalog').querySelectorAll('article').length,5);assert.equal(p.$('game-nav').querySelectorAll('a').length,6);
  const crossover=[...p.$('catalog').querySelectorAll('a')].find(a=>a.href.endsWith('/goat-crossover'));crossover.click();
  assert.equal(p.dom.window.location.pathname,'/games/goat-crossover');assert.match(p.$('game-title').textContent,/GOAT Crossover/);assert.match(p.$('game-status').textContent,/Scoring requires approved rules/);
  assert.equal(p.$('catalog').hidden,true);assert.equal(p.calls.length,0,'Public navigation requires no private API request');
  assert.equal(p.dom.window.localStorage.length,0);
 }finally{p.dom.window.close();}
});
test('NFL screen submits real ranked-pick and MVP command shapes; remote strings render as text',async()=>{
 const data=fixture('first-and-baa');data.league.name='<img src=x onerror=alert(1)>';
 data.rounds=[{id:'ROUND',name:'Super Bowl',status:'open',lock_at:future,weight_options:[[7]],weights:[7],mvp_bonus:2}];data.games=[{id:'GAME',round_id:'ROUND',home:'FIXTURE HOME',away:'FIXTURE AWAY',starts_at:future,home_spread:-3.5,home_score:null,away_score:null}];
 const p=await workspace('first-and-baa',data);try{
  await p.open();assert.equal(p.$('league-panel').querySelector('img'),null);assert.match(p.$('league-panel').textContent,/<img src=x/);
  const f=formWith(p.$('league-panel'),'Save Super Bowl picks');assert.ok(f);f.elements.side_0.value='home';f.elements.weight_0.value='7';f.elements.mvp_pick.value='FIXTURE MVP';p.submit(f);
  await until(()=>p.calls.some(c=>c.type==='command'));assert.deepEqual(p.calls.find(c=>c.type==='command').p,{op:'picks_submit',round_id:'ROUND',picks:[{game_id:'GAME',side:'home',weight:7}],mvp_pick:'FIXTURE MVP'});
 }finally{p.dom.window.close();}
});
test('combined Crossover screen exposes NBA/NHL breakdown and single-flight editable series picks',async()=>{
 const data=fixture('goat-crossover');data.series_config={policy:{points_by_sport:{NBA:{Opening:3},NHL:{Opening:5}}}};
 data.series_events=['NBA','NHL'].map(s=>({id:s,code:s+' FIXTURE',sport:s,stage:1,round:'Opening',home_team:s+' H',away_team:s+' A',lock_at:future,winner:null}));
 let release;const pending=new Promise(r=>{release=r;});const p=await workspace('goat-crossover',data,{command:()=>pending,standings:[{rank:1,display_name:'FIXTURE MEMBER',points:8,sports:[{sport:'NBA',points:3},{sport:'NHL',points:5}]}]});
 try{await p.open();assert.match(p.$('league-panel').textContent,/Combined NBA \+ NHL standings/);assert.match(p.$('league-panel').textContent,/NBA points/);assert.match(p.$('league-panel').textContent,/NHL points/);
  const f=formWith(p.$('league-panel'),'Save NBA picks');f.elements.team_NBA.value='NBA H';p.submit(f);p.submit(f);
  assert.equal(p.calls.filter(c=>c.type==='command').length,1);assert.deepEqual(p.calls.find(c=>c.type==='command').p,{op:'series_submit',league_id:LID,picks:[{event_id:'NBA',team:'NBA H'}]});release({id:LID});await wait();
 }finally{p.dom.window.close();}
});
test('Classic draft screen stores series foundations while clearly keeping unapproved scoring and picks disabled',async()=>{
 const data=fixture('goat-classic',ME);data.league.status='draft';data.series_config=null;
 const p=await workspace('goat-classic',data);try{await p.open();assert.match(p.$('league-panel').textContent,/Scoring disabled/);assert.ok(formWith(p.$('league-panel'),'Add sourced series'));assert.equal(formWith(p.$('league-panel'),'Save MLB picks'),undefined);
  assert.equal(formWith(p.$('league-panel'),'Open development entries'),undefined);assert.equal(formWith(p.$('league-panel'),'Save approved scoring policy').elements.points_by_sport.value,'','No invented weights prefill the policy');
 }finally{p.dom.window.close();}
});
test('fantasy commissioner screen passes unchanged official scores and explicit home-bonus provenance',async()=>{
 const data=fixture('league-of-greatness',ME);data.fantasy_teams=[{id:'H',name:'FIXTURE HOME',external_team_id:'1',user_id:ME,source_url:'https://fixture.invalid'},{id:'A',name:'FIXTURE AWAY',external_team_id:'2',user_id:OWNER,source_url:'https://fixture.invalid'}];
 data.fantasy_matchups=[{id:'M',week:1,home_id:'H',away_id:'A',starts_at:past,home_score:null,away_score:null}];
 const p=await workspace('league-of-greatness',data);try{await p.open();const f=formWith(p.$('league-panel'),'Save verified scores');assert.ok(f);assert.equal(f.elements.source_includes_home_bonus.checked,true);
  f.elements.home_score.value='100';f.elements.away_score.value='101';f.elements.source_url.value='https://fixture.invalid/espn-final';f.elements.verified.checked=true;p.submit(f);
  await until(()=>p.calls.some(c=>c.type==='command'));assert.deepEqual(p.calls.find(c=>c.type==='command').p,{op:'fantasy_result',matchup_id:'M',home_score:100,away_score:101,source_includes_home_bonus:true,source_url:'https://fixture.invalid/espn-final',verified:true});
 }finally{p.dom.window.close();}
});
test('Horns & Hoops screen renders all 63 picks and submits one graph-consistent bracket with championship total',async()=>{
 const data=fixture('horns-and-hoops');data.bracket_config={main_lock_at:future};
 for(let stage=1;stage<=6;stage++){const prior=data.bracket_nodes.filter(n=>n.stage===stage-1);for(let i=0;i<2**(6-stage);i++)data.bracket_nodes.push({id:`S${stage}G${i}`,code:`S${stage}G${i}`,stage,...(stage===1?{home_team:'FIXTURE H '+i,away_team:'FIXTURE A '+i}:{home_from:prior[i*2].id,away_from:prior[i*2+1].id})});}
 const p=await workspace('horns-and-hoops',data);try{await p.open();let f=formWith(p.$('league-panel'),'Save complete bracket');assert.ok(f);assert.equal(f.querySelectorAll('select').length,63);
  for(const n of data.bracket_nodes){const input=f.elements['pick_'+n.id];input.value=input.options[1].value;input.dispatchEvent(new p.dom.window.Event('change',{bubbles:true}));}f.elements.championship_total.value='150';f.elements.championship_total.dispatchEvent(new p.dom.window.Event('input',{bubbles:true}));await wait();
  p.controller.chooseGame('goat-classic');await p.controller.openLeague(LID);f=formWith(p.$('league-panel'),'Save complete bracket');assert.match(f.textContent,/63 of 63 winners selected/);assert.equal(f.elements.championship_total.value,'150');assert.match(f.textContent,/Unsaved selections restored/);p.submit(f);
  await until(()=>p.calls.some(c=>c.type==='command'));const c=p.calls.find(c=>c.type==='command').p;assert.equal(c.op,'bracket_submit');assert.equal(c.picks.length,63);assert.equal(c.championship_total,150);
 }finally{p.dom.window.close();}
});
test('sign-out clears private DOM immediately and delayed dashboard replies cannot restore it',async()=>{
 let release;const pending=new Promise(r=>{release=r;});const data=fixture('goat-classic');
 const p=await workspace('goat-classic',data,{query:p=>p.op==='competition_dashboard'?pending:undefined,logout:async()=>{throw new Error('network');}});
 try{const f=p.$('account-form');f.elements.email.value='member@fixture.invalid';f.elements.password.value='Workspace-Fixture-Password-1234';p.submit(f);await until(()=>p.calls.some(c=>c.type==='query'));p.$('sign-out').click();
  assert.equal(p.$('member-panel').hidden,true);assert.equal(p.$('league-list').childElementCount,0);release({competitions:[]});await wait();await wait();assert.equal(p.$('member-panel').hidden,true);assert.match(p.$('notice').textContent,/Server sign-out was not confirmed/);
 }finally{p.dom.window.close();}
});
test('Back during a pending pick command cannot reopen a competition or overwrite the new game selection',async()=>{
 const data=fixture('goat-crossover');data.series_config={policy:{points_by_sport:{NBA:{Opening:1},NHL:{Opening:1}}}};data.series_events=[{id:'NBA',sport:'NBA',code:'NBA TEST',round:'Opening',stage:1,home_team:'H',away_team:'A',lock_at:future}];
 let release;const pending=new Promise(r=>{release=r;});const p=await workspace('goat-crossover',data,{command:()=>pending});try{
  await p.open();const f=formWith(p.$('league-panel'),'Save NBA picks');f.elements.team_NBA.value='H';p.submit(f);p.controller.chooseGame('goat-classic');release({id:LID});await wait();await wait();
  assert.equal(p.$('league-panel').hidden,true);assert.match(p.$('game-title').textContent,/GOAT Classic/);
 }finally{p.dom.window.close();}
});
test('a delayed sign-out completion after document teardown does not throw or revive private UI',async()=>{
 let finish;const pending=new Promise(r=>{finish=r;});const p=await workspace('goat-classic',fixture('goat-classic'),{logout:()=>pending});
 await p.login();p.$('sign-out').click();assert.equal(p.$('member-panel').hidden,true);p.dom.window.close();finish();await wait();await wait();
});
test('certified finishing positions immediately become eligible in the annual championship without signing in again',async()=>{
 const data=fixture('goat-classic',ME);data.league.status='final';
 const annual={id:'ANNUAL',name:'SYNTHETIC ANNUAL',season:2027,status:'draft',owner_id:ME,policy:{conversions:{}},competitions:[]};
 const p=await workspace('goat-classic',data,{standings:[{user_id:ME,display_name:'FIXTURE MEMBER',rank:1,points:0,sports:[{sport:'MLB',points:0}]}],
  command:async c=>{if(c.op==='competition_finish_certify')data.finish_certification={source_reference:'FIXTURE VERIFIED ORDER'};return {id:LID};},
  query:q=>q.op==='competition_dashboard'?{competitions:publicCatalog().games.map(g=>({game_key:g.id,leagues:g.id==='goat-classic'?[{...data.league,entry_status:'approved',finishes_certified:Boolean(data.finish_certification)}]:[]}))}:q.op==='annuals'?[annual]:q.op==='annual'?annual:q.op==='annual_standings'?[]:undefined});
 try{await p.open();const f=formWith(p.$('league-panel'),'Certify finishing positions');f.elements.source_url.value='https://fixture.invalid/final';f.elements.source_reference.value='FIXTURE VERIFIED ORDER';f.elements.verified.checked=true;p.submit(f);
  await until(()=>p.$('league-panel').textContent.includes('Finishing positions certified'));
  p.controller.chooseGame('');await p.controller.openAnnual();[...p.$('annual-panel').querySelectorAll('button')].find(b=>b.textContent.includes('SYNTHETIC ANNUAL')).click();
  await until(()=>p.$('annual-panel').textContent.includes('Attach certified finishing positions'));
 }finally{p.dom.window.close();}
});
test('unsubmitted ranked picks survive game navigation in memory and clear on sign-out',async()=>{
 const data=fixture('first-and-baa');data.rounds=[{id:'ROUND',name:'Super Bowl',status:'open',lock_at:future,weight_options:[[7]],weights:[7],mvp_bonus:2}];data.games=[{id:'GAME',round_id:'ROUND',home:'FIXTURE H',away:'FIXTURE A',starts_at:future,home_spread:0,home_score:null,away_score:null}];
 const p=await workspace('first-and-baa',data);try{await p.open();let f=formWith(p.$('league-panel'),'Save Super Bowl picks');f.elements.side_0.value='away';f.elements.weight_0.value='7';f.elements.mvp_pick.value='UNSUBMITTED FIXTURE MVP';f.dispatchEvent(new p.dom.window.Event('input',{bubbles:true}));await wait();
  p.controller.chooseGame('goat-classic');await p.controller.openLeague(LID);f=formWith(p.$('league-panel'),'Save Super Bowl picks');assert.equal(f.elements.side_0.value,'away');assert.equal(f.elements.mvp_pick.value,'UNSUBMITTED FIXTURE MVP');assert.match(p.$('league-panel').textContent,/Unsaved selections restored/);
  assert.equal(p.calls.filter(c=>c.type==='command').length,0);assert.equal(p.dom.window.localStorage.length,0);p.$('sign-out').click();await wait();await p.login();await p.controller.openLeague(LID);f=formWith(p.$('league-panel'),'Save Super Bowl picks');assert.equal(f.elements.mvp_pick.value,'');
 }finally{p.dom.window.close();}
});

test('deadline reached while a rejected save is pending keeps the NFL submit control locked',async()=>{
 const data=fixture('first-and-baa');data.rounds=[{id:'R',name:'Super Bowl',status:'open',lock_at:'2026-10-14T12:00:02Z',weight_options:[[7]],weights:[7],mvp_bonus:2}];data.games=[{id:'G',round_id:'R',home:'SYNTHETIC H',away:'SYNTHETIC A',starts_at:future,home_score:null,away_score:null,home_spread:0}];
 let elapsed=0,reject;const p=await workspace('first-and-baa',data,{now:()=>elapsed,command:()=>new Promise((_,r)=>{reject=r;})});
 try{await p.open();const f=formWith(p.$('league-panel'),'Save Super Bowl picks'),button=f.querySelector('button[type=submit]');f.elements.side_0.value='home';f.elements.weight_0.value='7';f.elements.mvp_pick.value='SYNTHETIC MVP';p.submit(f);assert.equal(p.calls.filter(c=>c.type==='command').length,1);
  elapsed=2000;p.dom.window.dispatchEvent(new p.dom.window.Event('focus'));reject(new Error('selections_locked'));await until(()=>p.$('notice').textContent.includes('selections locked'));assert.equal(button.disabled,true);p.submit(f);assert.equal(p.calls.filter(c=>c.type==='command').length,1);
 }finally{p.dom.window.close();}
});

test('a series deadline during editing preserves later selections and submits only currently unlocked series',async()=>{
 const data=fixture('goat-classic');data.series_config={policy:{points_by_sport:{MLB:{Opening:1}}}};
 data.series_events=['A','B'].map((id,i)=>({id,code:'SYNTHETIC '+id,sport:'MLB',round:'Opening',stage:1,home_team:id+' HOME',away_team:id+' AWAY',lock_at:'2026-10-14T12:00:0'+(i?4:2)+'Z',winner:null}));
 let elapsed=0;const p=await workspace('goat-classic',data,{now:()=>elapsed});
 try{await p.open();const f=formWith(p.$('league-panel'),'Save MLB picks');f.elements.team_A.value='A HOME';f.elements.team_B.value='B AWAY';elapsed=2000;p.dom.window.dispatchEvent(new p.dom.window.Event('focus'));assert.equal(f.elements.team_A.disabled,true);assert.equal(f.elements.team_B.disabled,false);p.submit(f);await until(()=>p.calls.some(c=>c.type==='command'));assert.deepEqual(p.calls.find(c=>c.type==='command').p,{op:'series_submit',league_id:LID,picks:[{event_id:'B',team:'B AWAY'}]});
 }finally{p.dom.window.close();}
});

test('newer pick edits made during a save remain visible and explicitly unsaved after its refresh',async()=>{
 const data=fixture('first-and-baa');data.rounds=[{id:'R',name:'Super Bowl',status:'open',lock_at:future,weight_options:[[7]],weights:[7],mvp_bonus:2}];data.games=[{id:'G',round_id:'R',home:'SYNTHETIC H',away:'SYNTHETIC A',starts_at:future,home_score:null,away_score:null,home_spread:0}];
 let release;const p=await workspace('first-and-baa',data,{command:()=>new Promise(r=>{release=r;})});
 try{await p.open();const f=formWith(p.$('league-panel'),'Save Super Bowl picks');f.elements.side_0.value='home';f.elements.weight_0.value='7';f.elements.mvp_pick.value='SYNTHETIC MVP';p.submit(f);f.elements.side_0.value='away';f.elements.side_0.dispatchEvent(new p.dom.window.Event('change',{bubbles:true}));await wait();release({id:LID});
  await until(()=>p.$('notice').textContent.includes('Newer edits remain unsaved'));const restored=formWith(p.$('league-panel'),'Save Super Bowl picks');assert.notEqual(restored,f);assert.equal(restored.elements.side_0.value,'away');assert.equal(p.calls.find(c=>c.type==='command').p.picks[0].side,'home');assert.match(restored.textContent,/not been submitted/);
 }finally{p.dom.window.close();}
});

test('member history filters actual certified results across games and opens the corresponding competition',async()=>{
 const data=fixture('goat-classic');data.league.status='final';
 const records=[{league_id:LID,name:'SYNTHETIC CLASSIC FINAL',season:'2027',game_key:'goat-classic',certified:true,finish:{place:2}},{league_id:'OTHER',name:'SYNTHETIC NFL FINAL',season:'2027',game_key:'first-and-baa',certified:false,finish:null}];
 const p=await workspace('goat-classic',data,{query:q=>q.op==='member_history'?records:undefined});
 try{await p.login();const history=[...p.$('member-actions').querySelectorAll('button')].find(b=>b.textContent==='My competition history');assert.ok(history);history.click();await until(()=>p.$('annual-panel').textContent.includes('SYNTHETIC CLASSIC FINAL'));
  const panel=p.$('annual-panel'),filter=panel.querySelector('select');assert.match(panel.textContent,/Awaiting certification/);assert.match(panel.textContent,/The GOAT Classic/);filter.value='goat-classic';filter.dispatchEvent(new p.dom.window.Event('change',{bubbles:true}));assert.match(panel.textContent,/Certified finishing place: 2/);assert.doesNotMatch(panel.textContent,/SYNTHETIC NFL FINAL/);
  [...panel.querySelectorAll('button')].find(b=>b.textContent==='Open SYNTHETIC CLASSIC FINAL').click();await until(()=>p.$('league-panel').textContent.includes(data.league.name));assert.equal(p.$('annual-panel').hidden,true);assert.deepEqual(p.calls.find(c=>c.type==='query'&&c.p.op==='member_history').p,{op:'member_history'});
 }finally{p.dom.window.close();}
});

test('history errors can be refreshed; delayed private history cannot reappear after sign-out',async()=>{
 let fail=true,release;const p=await workspace('',undefined,{query:q=>q.op==='member_history'?(fail?Promise.reject(new Error('temporary_error')):new Promise(r=>{release=r;})):undefined});
 try{await p.login();await p.controller.openHistory();assert.match(p.$('annual-panel').textContent,/History unavailable/);fail=false;[...p.$('annual-panel').querySelectorAll('button')].find(b=>b.textContent==='Refresh history').click();await until(()=>release);p.$('sign-out').click();release([{league_id:LID,name:'PRIVATE LATE HISTORY',season:'2027',game_key:'goat-classic',certified:true,finish:{place:1}}]);await wait();await wait();assert.equal(p.$('annual-panel').childElementCount,0);assert.equal(p.$('annual-panel').hidden,true);assert.doesNotMatch(p.dom.window.document.body.textContent,/PRIVATE LATE HISTORY/);
 }finally{p.dom.window.close();}
});

test('annual screen shows all five attachment states and only the signed-in member breakdown under approved conversions',async()=>{
 const annual={id:'ANNUAL',name:'SYNTHETIC ANNUAL',season:2027,status:'draft',owner_id:OWNER,policy:{approved:true,conversions:{}},competitions:[{game_key:'goat-classic',source_url:'https://fixture.invalid/certified'}]};
 const p=await workspace('',undefined,{query:q=>q.op==='annuals'?[annual]:q.op==='annual'?annual:q.op==='annual_standings'?[{user_id:ME,rank:1,display_name:'MY FIXTURE',baas:10,competitions:1,breakdown:[{game_key:'goat-classic',place:2,baas:10,source_url:'https://fixture.invalid/my-certified-source'}]},{user_id:OWNER,rank:2,display_name:'OTHER FIXTURE',baas:5,competitions:1,breakdown:[{game_key:'goat-classic',place:3,baas:5,source_url:'https://fixture.invalid/other-certified-source'}]}]:undefined});
 try{await p.login();await p.controller.openAnnual();[...p.$('annual-panel').querySelectorAll('button')].find(b=>b.textContent.includes('SYNTHETIC ANNUAL')).click();await until(()=>p.$('annual-panel').textContent.includes('My annual performance by game'));
  const progress=[...p.$('annual-panel').querySelectorAll('details')].find(d=>d.querySelector('summary').textContent==='Five-game championship progress');assert.equal(progress.querySelectorAll('tbody tr').length,5);assert.equal([...progress.querySelectorAll('tbody tr')].filter(r=>r.textContent.includes('Awaiting certified final results')).length,4);
  const mine=[...p.$('annual-panel').querySelectorAll('details')].find(d=>d.querySelector('summary').textContent==='My annual performance by game');assert.match(mine.textContent,/my-certified-source/);assert.doesNotMatch(mine.textContent,/other-certified-source/);assert.match(mine.textContent,/no live BAAS awards/);
 }finally{p.dom.window.close();}
});

test('saved-selection receipts in all five games show the member server records and exclude other participants',async()=>{
 for(const key of publicCatalog().games.map(g=>g.id)){
  const data=fixture(key),own='MY SAVED RECORD',other='OTHER PARTICIPANT RECORD';
  data.games=[{id:'G1',home:own,away:'AWAY',round_id:'R1'},{id:'G2',home:other,away:'AWAY',round_id:'R2'}];data.picks=[{user_id:ME,game_id:'G1',side:'home',weight:7},{user_id:OWNER,game_id:'G2',side:'home',weight:7}];
  data.bracket_nodes=[{id:'N1',code:'MY GAME',stage:1},{id:'N2',code:'OTHER GAME',stage:1}];data.bracket_picks=[{user_id:ME,node_id:'N1',team:own},{user_id:OWNER,node_id:'N2',team:other}];
  data.series_picks=[{user_id:ME,event_id:'E1',team:own,submitted_at:past},{user_id:OWNER,event_id:'E2',team:other,submitted_at:past}];
  data.fantasy_teams=[{id:'T1',user_id:ME,name:own},{id:'T2',user_id:OWNER,name:other},{id:'T3',user_id:'THIRD',name:'SYNTHETIC OPPONENT A'},{id:'T4',user_id:'FOURTH',name:'SYNTHETIC OPPONENT B'}];data.fantasy_matchups=[{id:'M1',week:1,home_id:'T1',away_id:'T3',home_score:10,away_score:1},{id:'M2',week:1,home_id:'T2',away_id:'T4',home_score:10,away_score:1}];
  const p=await workspace(key,data);try{await p.open();const receipt=[...p.$('league-panel').querySelectorAll('details')].find(d=>d.querySelector('summary')?.textContent==='My saved selections and records');assert.ok(receipt,key);assert.match(receipt.textContent,/MY SAVED RECORD/,key);assert.doesNotMatch(receipt.textContent,/OTHER PARTICIPANT RECORD/,key);assert.match(receipt.textContent,/Unsaved edits in this tab do not change these records/);}finally{p.dom.window.close();}
 }
});
