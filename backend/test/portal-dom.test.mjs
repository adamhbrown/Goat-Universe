// DOM/interaction tests are not visual browser QA. No browser is installed or
// controlled, and no hosted Supabase, email, or payment provider is contacted.
import test,{before,after} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {JSDOM} from 'jsdom';
import {application} from '../server.mjs';
import {configuration} from '../config.mjs';

let app,base,dom;const realFetch=globalThis.fetch,realDocument=globalThis.document,realFormData=globalThis.FormData;
let responseCount=0;
async function until(check) {
 const end=Date.now()+5000;
 while(!check()) {if(Date.now()>end) throw new Error('DOM assertion timed out: '+dom.window.document.querySelector('#message').textContent);await new Promise(r=>setTimeout(r,10));}
}
const $=q=>dom.window.document.querySelector(q);
function submit(f,button) {f.dispatchEvent(new dom.window.SubmitEvent('submit',{bubbles:true,cancelable:true,submitter:button || f.querySelector('button[type=submit]')}));}
function findForm(text,within='#dashboard') {return [...$(within).querySelectorAll('form')].find(f=>f.textContent.includes(text));}
function findButton(text,within='#dashboard') {return [...$(within).querySelectorAll('button')].find(b=>b.textContent===text);}
before(async()=>{
 app=await application({...configuration({}),localPath:undefined});await new Promise(r=>app.server.listen(0,'127.0.0.1',r));base=`http://127.0.0.1:${app.server.address().port}`;
 dom=new JSDOM(await readFile(new URL('../portal/manage.html',import.meta.url),'utf8'),{url:base+'/manage'});
 globalThis.document=dom.window.document;globalThis.FormData=dom.window.FormData;
 globalThis.fetch=async(path,options)=>{
  assert.ok(typeof path==='string' && path.startsWith('/'),'Portal may only call its own backend');
  const r=await realFetch(base+path,options);responseCount++;return r;
 };
 await import('../portal/manage.mjs');
});
after(async()=>{globalThis.fetch=realFetch;globalThis.document=realDocument;globalThis.FormData=realFormData;dom.window.close();await app.close();});

test('actual account form registers, signs in and edits profile without HTML injection',async()=>{
 const f=$('#account');f.elements.email.value='dom@fixture.invalid';f.elements.password.value='DOM-Fixture-Password-1234';f.elements.display_name.value='DOM fixture';
 submit(f,f.querySelector('button[value=signup]'));await until(()=>$('#message').textContent.includes('account created'));
 assert.equal(f.elements.password.value,'');f.elements.password.value='DOM-Fixture-Password-1234';submit(f,f.querySelector('button[value=login]'));
 await until(()=>!$('#dashboard').hidden);assert.match($('#dashboard').textContent,/Welcome, DOM fixture/);
 assert.equal($('#auth').hidden,true);
 const profile=findForm('Update profile');profile.elements.display_name.value='<img src=x onerror=alert(1)>';
 const count=responseCount;submit(profile);await until(()=>responseCount>=count+2 && $('#dashboard').textContent.includes('Welcome, <img'));
 assert.equal($('#dashboard').querySelector('img'),null,'Remote profile string must be a text node');
 assert.equal(f.elements.password.value,'');
});

test('actual commissioner draft form uses 61-point source, preserves unapproved rules and creates four rounds',async()=>{
 const f=findForm('Create draft');f.elements.name.value='DOM NFL TEST FIXTURE';
 for(let i=0;i<4;i++) f.elements['deadline'+i].value=new Date(Date.now()+(i+1)*86400000).toISOString().slice(0,16);
 submit(f);await until(()=>$('#message').textContent.includes('NFL LXI draft created'));
 assert.equal($('#league').hidden,false);assert.match($('#league').textContent,/Wild Card/);assert.match($('#league').textContent,/Super Bowl/);
 assert.match($('#league').textContent,/"max_points": 61/);assert.match($('#league').textContent,/"approved": false/);
 const rules=findForm('Save rule review','#league');assert.equal(rules.elements.approved.checked,false);
 assert.equal((await app.db.db.query('select count(*) as n from public.goat_rounds')).rows[0].n,4);
});

test('participant has no commercial controls and logout clears every protected panel',async()=>{
 assert.equal(findButton('Commercial workspace'),undefined);
 $('#logout').click();await until(()=>$('#message').textContent==='Signed out.');
 for(const id of ['dashboard','league','commercial']) {assert.equal($('#'+id).hidden,true);assert.equal($('#'+id).childElementCount,0);}
 assert.equal($('#auth').hidden,false);
});

test('actual CRM form creates evidence-backed lead, draft and approval without an outbound request',async()=>{
 const user=await app.auth.signup({email:'crm-dom@fixture.invalid',password:'CRM-DOM-Fixture-Password-1234',display_name:'Executive DOM fixture'});
 await app.db.db.query("insert into public.goat_roles values($1,'executive')",[user.user.id]);
 const auth=$('#account');auth.elements.email.value='crm-dom@fixture.invalid';auth.elements.password.value='CRM-DOM-Fixture-Password-1234';submit(auth,auth.querySelector('button[value=login]'));
 await until(()=>!!findButton('Commercial workspace'));findButton('Commercial workspace').click();await until(()=>!$('#commercial').hidden);
 const lead=findForm('Create prospect','#commercial');
 for(const [k,v] of Object.entries({organization:'DOM CRM TEST FIXTURE',website:'https://fixture.invalid',source_url:'https://fixture.invalid/research',evidence:'TEST public source only'})) lead.elements[k].value=v;
 submit(lead);await until(()=>$('#commercial').textContent.includes('DOM CRM TEST FIXTURE · score'));
 assert.match($('#commercial').textContent,/unknown/,'A relevance score is not genuine interest');
 findButton('Prepare introduction draft','#commercial').click();await until(()=>$('#commercial').textContent.includes('pending: Introduction'));
 const decision=findForm('Record decision','#commercial');decision.elements.approved.value='true';decision.elements.reason.value='TEST approval, not campaign authorization';submit(decision);
 await until(()=>$('#commercial').textContent.includes('approved: Introduction'));
 assert.equal((await app.db.db.query("select count(*) as n from public.goat_drafts where status='approved'")).rows[0].n,1);
 // fetch wrapper above rejects every external URL; the app has no send route.
 assert.match($('#commercial').textContent,/No email, social messages, or external outreach sender/);
});

test('actual five-game forms create an unscheduled March Madness draft and configure an explicit first tip',async()=>{
 const f=findForm('Create Horns & Hoops draft');assert.ok(f);f.elements.name.value='DOM MARCH MADNESS FIXTURE';submit(f);
 await until(()=>$('#message').textContent==='Horns & Hoops draft created.');
 assert.match($('#league').textContent,/Draft saved/);
 const configure=findForm('Configure bracket schedule','#league');assert.ok(configure);
 configure.elements.main_lock_at.value=new Date(Date.now()+86400000).toISOString().slice(0,16);configure.elements.schedule_source.value='https://fixture.invalid/tournament';submit(configure);
 await until(()=>$('#league').textContent.includes('Main lock:'));
 assert.match($('#league').textContent,/National Championship/);assert.match($('#league').textContent,/main bracket and championship-total prediction lock/);
});

test('actual March Madness schedule import, rule review and commissioner opening use live database APIs',async()=>{
 const league=(await app.db.db.query("select id from public.goat_leagues where name='DOM MARCH MADNESS FIXTURE'")).rows[0];
 const cfg=(await app.db.db.query('select * from public.goat_bracket_config where league_id=$1',[league.id])).rows[0];
 const nodes=[];
 for(let stage=1;stage<=6;stage++)for(let i=0;i<2**(6-stage);i++)nodes.push({code:`R${stage}G${i}`,stage,starts_at:new Date(Date.parse(cfg.main_lock_at)+(stage-1)*86400000).toISOString(),source_url:'https://fixture.invalid/event',...(stage===1?{home_team:`DOM HOME ${i}`,away_team:`DOM AWAY ${i}`}:{home_from_code:`R${stage-1}G${i*2}`,away_from_code:`R${stage-1}G${i*2+1}`})});
 const schedule=findForm('Import bracket schedule','#league');schedule.elements.nodes.value=JSON.stringify(nodes);submit(schedule);
 await until(()=>findForm('Import bracket schedule','#league')!==schedule);
 assert.equal((await app.db.db.query('select count(*) n from public.goat_bracket_nodes where league_id=$1',[league.id])).rows[0].n,63);
 const approval=findForm('Save bracket rule review','#league');approval.elements.unresolved.value='';approval.elements.approved.checked=true;submit(approval);
 await until(()=>findForm('Save bracket rule review','#league')!==approval);
 const opening=findForm('Open bracket league','#league');opening.elements.reason.value='DOM fixture approval only';submit(opening);
 await until(()=>$('#league').textContent.includes('Import sourced results'));
 assert.equal((await app.db.db.query('select status from public.goat_leagues where id=$1',[league.id])).rows[0].status,'open');
});

test('actual full-bracket form propagates winners, saves all 63 picks and immutable tiebreak prediction',async()=>{
 findButton('Request your own competitor entry','#league').click();await until(()=>!!findButton('Approve Executive DOM fixture','#league'));
 findButton('Approve Executive DOM fixture','#league').click();await until(()=>!!findForm('Save complete bracket','#league'));
 const f=findForm('Save complete bracket','#league');
 const choices=[...f.querySelectorAll('select')];assert.equal(choices.length,63);
 for(const select of choices){assert.ok(select.options.length>=2);select.value=select.options[1].value;select.dispatchEvent(new dom.window.Event('change',{bubbles:true}));}
 f.elements.championship_total.value='151';submit(f);
 await until(()=>$('#league').textContent.includes('Your main bracket was saved at'));
 await until(()=>!f.querySelector('button[type=submit]').disabled);
 const sub=(await app.db.db.query('select * from public.goat_bracket_submissions')).rows[0];assert.equal(sub.championship_total,151);
 assert.equal((await app.db.db.query('select count(*) n from public.goat_bracket_picks')).rows[0].n,63);
 // Change an early winner: its previously selected champion must be cleared.
 const current=findForm('Save complete bracket','#league'),first=current.querySelector('select');first.value=first.options[2].value;first.dispatchEvent(new dom.window.Event('change',{bubbles:true}));
 const champ=[...current.querySelectorAll('select')].at(-1);assert.equal(champ.value,'');
});
