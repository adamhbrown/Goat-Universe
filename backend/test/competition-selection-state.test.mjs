import test from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {serverClock,deadlineGuard} from '../games/deadlines.mjs';
import {selectionDrafts} from '../games/drafts.mjs';

const start='2099-01-01T00:00:00Z',cutoff=Date.parse(start)+2000;
const tick=()=>new Promise(r=>queueMicrotask(r));

test('server-calibrated deadline clock ignores backwards client adjustments and closes exactly at cutoff',()=>{
 let elapsed=50;const now=serverClock(start,()=>elapsed),dom=new JSDOM('<form><button type="submit">Save</button></form>');
 const form=dom.window.document.querySelector('form');let scheduled,canceled=0;
 const guard=deadlineGuard({document:dom.window.document,form,deadline:new Date(cutoff).toISOString(),now,current:()=>true,schedule:fn=>{scheduled=fn;return 1;},cancel:()=>{canceled++;}});
 try{assert.equal(guard.submit.disabled,false);elapsed=2049;assert.equal(guard.update(),false);elapsed=2050;scheduled();assert.equal(guard.submit.disabled,true);assert.match(form.textContent,/locked/);elapsed=0;assert.equal(guard.update(),true);assert.ok(canceled>0);guard.stop();}finally{dom.window.close();}
});

test('per-series locks disable only elapsed fields and remain sticky across a clock rewind',()=>{
 const dom=new JSDOM('<form><label>First<select name="team_A"><option>A</option></select></label><label>Later<select name="team_B"><option>B</option></select></label><button type="submit">Save</button></form>');
 const form=dom.window.document.querySelector('form');let time=Date.parse(start);
 const guard=deadlineGuard({document:dom.window.document,form,items:{team_A:new Date(cutoff).toISOString(),team_B:new Date(cutoff+2000).toISOString()},now:()=>time,current:()=>true,schedule:()=>1,cancel:()=>{}});
 try{time=cutoff;assert.equal(guard.update(),false);assert.equal(form.elements.team_A.disabled,true);assert.equal(form.elements.team_B.disabled,false);assert.equal(guard.submit.disabled,false);assert.match(form.textContent,/1 locked/);time=cutoff-1;guard.update();assert.equal(form.elements.team_A.disabled,true);time=cutoff+2000;assert.equal(guard.update(),true);assert.equal(guard.submit.disabled,true);guard.stop();}finally{dom.window.close();}
});

test('missing or invalid deadline fails closed and leaving a view stops scheduled updates',()=>{
 const dom=new JSDOM('<form><button type="submit">Save</button></form>');let active=true,canceled=0;const form=dom.window.document.querySelector('form');
 try{const guard=deadlineGuard({document:dom.window.document,form,deadline:'not-a-date',now:()=>Date.parse(start),current:()=>active,schedule:()=>1,cancel:()=>{canceled++;}});assert.equal(guard.submit.disabled,true);assert.match(form.textContent,/unavailable/);guard.stop();
  const later=deadlineGuard({document:dom.window.document,form,deadline:new Date(cutoff).toISOString(),now:()=>Date.parse(start),current:()=>active,schedule:()=>1,cancel:()=>{canceled++;}});active=false;later.update();assert.equal(canceled,1);
 }finally{dom.window.close();}
});

function form(document,names=['team_A']){
 const f=document.createElement('form');for(const name of names){const select=document.createElement('select');select.name=name;for(const value of ['','HOME','AWAY']){const o=document.createElement('option');o.value=value;o.textContent=value;select.append(o);}f.append(select);}return f;
}
test('an in-flight save acknowledges only its submitted draft revision, preserving later edits and other competitions',async()=>{
 const dom=new JSDOM('<main></main>',{url:'https://fixture.invalid'}),document=dom.window.document,drafts=selectionDrafts(document),panel=document.querySelector('main');
 const bind=(f,scope='ONE')=>drafts.bind(f,{scope,label:'Save NBA picks',fields:[{name:'team_A'}],current:()=>true,discard:()=>{}});
 try{const f=form(document);panel.append(f);bind(f);f.elements.team_A.value='HOME';const ticket=drafts.capture(f);f.elements.team_A.value='AWAY';f.dispatchEvent(new dom.window.Event('change'));await tick();drafts.acknowledge(ticket);assert.equal(drafts.pending(ticket),true);
  const other=form(document);panel.replaceChildren(other);bind(other,'TWO');drafts.restore(panel);assert.equal(other.elements.team_A.value,'');
  const restored=form(document);panel.replaceChildren(restored);bind(restored);drafts.restore(panel);assert.equal(restored.elements.team_A.value,'AWAY');assert.match(panel.textContent,/Unsaved selections restored/);assert.equal(dom.window.localStorage?.length??0,0);
  const latest=drafts.capture(restored);drafts.acknowledge(latest);assert.equal(drafts.pending(latest),false);drafts.clear();
 }finally{dom.window.close();}
});

test('series drafts survive earlier fields locking and account boundaries discard all unsubmitted selections',async()=>{
 const dom=new JSDOM('<main></main>',{url:'https://fixture.invalid'}),document=dom.window.document,drafts=selectionDrafts(document),panel=document.querySelector('main');
 const bind=(f,names)=>drafts.bind(f,{scope:'ONE',label:'Save NBA picks',fields:names.map(name=>({name})),current:()=>true,discard:()=>{}});
 try{const f=form(document,['team_A','team_B']);bind(f,['team_A','team_B']);f.elements.team_A.value='HOME';f.elements.team_B.value='AWAY';drafts.capture(f);
  const later=form(document,['team_B']);bind(later,['team_B']);panel.append(later);drafts.restore(panel);assert.equal(later.elements.team_B.value,'AWAY');await tick();drafts.clear();
  const signedIn=form(document,['team_B']);bind(signedIn,['team_B']);panel.replaceChildren(signedIn);drafts.restore(panel);assert.equal(signedIn.elements.team_B.value,'');assert.equal(dom.window.localStorage.length,0);
 }finally{dom.window.close();}
});
