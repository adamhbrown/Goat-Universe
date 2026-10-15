import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';
import {getReviewedAttraction,resolveReviewedGuestEntry} from '../guest/catalog.mjs';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const page=read('goatville-spotlight.html'),child=read('guest/spotlight-circuit.html');
const source=read('guest/spotlight-circuit.js'),style=read('guest/spotlight-circuit.css');
const city=read('goatville-city.html'),host=read('guest/host.mjs'),parent=read('guest/parent.mjs');
const mockWindow={location:{href:'https://goat.example/goatville-spotlight.html',origin:'https://goat.example'}};
const init=session=>({channel:'goatville.guest.v1',type:'init',session,attraction:'spotlight-circuit',version:1,reducedMotion:false});

test('GOATVILLE links to the reviewed five-sport attraction and does not autosummon it',()=>{
 assert.match(city,/href="goatville-spotlight\.html"/);
 assert.match(page,/data-guest-attraction="spotlight-circuit"/);
 assert.match(page,/id="start"/);
 assert.match(page,/guest\/parent\.mjs/);
 assert.match(parent,/getReviewedAttraction\(document\.body\.dataset\.guestAttraction\)/);
 assert.doesNotMatch(page,/<iframe[\s>]|autoplay/);
});
test('catalog rejects unreviewed URLs, paths, versions and querystrings',()=>{
 const selected=getReviewedAttraction('spotlight-circuit');
 assert.deepEqual(selected.spec.achievements,['spotlight-clear']);
 assert.throws(()=>getReviewedAttraction('not-reviewed'),/unreviewed_game/);
 const accepted=resolveReviewedGuestEntry({attraction:selected.spec,
   entryURL:'https://goat.example/guest/spotlight-circuit.html',windowImpl:mockWindow});
 assert.equal(accepted.entry.href,'https://goat.example/guest/spotlight-circuit.html');
 for(const url of ['https://other.test/guest/spotlight-circuit.html',
   'https://goat.example/guest/spotlight-circuit.html?redirect=1',
   'https://goat.example/guest/field-vision.html',
   'https://goat.example/guest/spotlight-circuit.html#x']){
   assert.throws(()=>resolveReviewedGuestEntry({attraction:selected.spec,entryURL:url,windowImpl:mockWindow}),/invalid_game_entry/);
 }
 assert.throws(()=>resolveReviewedGuestEntry({attraction:{...selected.spec,version:2},entryURL:accepted.entry.href,windowImpl:mockWindow}),/unreviewed_game/);
});
test('game is sandboxed without parent storage or network permissions',()=>{
 assert.match(host,/sandbox', 'allow-scripts'/);
 assert.doesNotMatch(host,/setAttribute\('sandbox',\s*'[^']*(?:allow-same-origin|allow-top-navigation|allow-popups|allow-forms)/);
 assert.match(child,/default-src 'none'/);
 assert.match(child,/connect-src 'none'/);
 assert.match(child,/script-src 'self'/);
 assert.match(child,/src="spotlight-circuit\.js"/);
 assert.doesNotMatch(source,/fetch\(|WebSocket|localStorage|sessionStorage|XMLHttpRequest|setInterval|setTimeout|innerHTML/);
 assert.doesNotMatch(style,/@import|https?:\/\//);
 assert.doesNotThrow(()=>new Function(source));
});
test('the game has distinct sport themes, accessible controls and reduced-motion fallback',()=>{
 for(const sport of ['football','hoops','crossover','fantasy','baseball'])
   assert.match(style,new RegExp('data-sport='+sport));
 assert.match(child,/aria-live="polite"/);
 assert.match(child,/id="scenario" tabindex="-1"/);
 assert.match(style,/prefers-reduced-motion:reduce/);
 assert.match(child,/Fictional scenarios/);
 assert.match(page,/optional, unverified visitor stamp|unverified visitor stamp/i);
});
test('five decisions complete once and report only a strict souvenir claim to the exact parent origin',()=>{
 class Element {
  constructor(id=''){this.id=id;this.attrs={};this.listeners={};this.children=[];this.textContent='';this.disabled=true;this.focused=false;this.dataset={};
   this.classList={toggle:()=>{}};}
  addEventListener(type,handler){this.listeners[type]=handler;}
  setAttribute(name,value){this.attrs[name]=value;}
  click(){this.listeners.click?.();}
  focus(){this.focused=true;}
  append(child){this.children.push(child);}
  replaceChildren(){this.children=[];}
 }
 const ids=[...child.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);
 const el=Object.fromEntries(ids.map(id=>[id,new Element(id)]));
 const lights=Array.from({length:5},()=>new Element());
 const document={
  body:{dataset:{}},
  getElementById:id=>el[id],
  querySelectorAll:selector=>selector==='.lights span'?lights:[],
  createElement:tag=>new Element(tag)
 };
 const events={};const messages=[];
 const parentProxy={postMessage:(data,target)=>messages.push({data,target})};
 const window={addEventListener:(type,handler)=>events[type]=handler};
 new Function('document','window','parent',source)(document,window,parentProxy);
 const session='0123456789abcdef0123456789abcdef';
 events.message({source:{},origin:'https://goat.example',data:init(session)});
 events.message({source:parentProxy,origin:'null',data:init(session)});
 assert.equal(el.choices.children.length,0);
 events.message({source:parentProxy,origin:'https://goat.example',data:init(session)});
 for(let i=0;i<5;i++){
  assert.equal(el.choices.children.length,2);
  el.choices.children[i%2].click();
  assert.equal(el.advance.disabled,false);
  el.advance.click();
 }
 assert.equal(el.stage.textContent,'ALL FIVE ARENAS COMPLETED');
 assert.equal(el.scenario.focused,true);
 assert.equal(messages.length,1);
 assert.equal(messages[0].target,'https://goat.example');
 assert.deepEqual(messages[0].data,{
  channel:'goatville.guest.v1',session,attraction:'spotlight-circuit',version:1,
  sequence:1,type:'achievement',achievement:'spotlight-clear'
 });
 el.advance.click();
 assert.equal(messages.length,1);
});
