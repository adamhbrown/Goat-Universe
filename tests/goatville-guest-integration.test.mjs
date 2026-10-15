import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';
import {createGuestSession,createGuestJournal} from '../guest/protocol.mjs';

const root=new URL('../',import.meta.url);
const read=path=>readFileSync(new URL(path,root),'utf8');
const host=read('guest/host.mjs');
const parent=read('guest/parent.mjs');
const html=read('goatville-field-vision.html');
const game=read('guest/field-vision.html');
const source=read('guest/field-vision.js');
const css=read('guest/field-vision.css');
const city=read('goatville-city.html');
const sourcePointer={};
const attribution={id:'field-vision',version:1,title:'Field Vision',achievements:['field-vision-clear']};
const session='1234567890abcdef1234567890abcdef';
const validMessage=()=>({channel:'goatville.guest.v1',session,attraction:'field-vision',version:1,sequence:1,type:'achievement',achievement:'field-vision-clear'});

test('the city links to a real free-play guest destination',()=>{
 assert.match(city,/href="goatville-field-vision\.html"/);
 assert.match(html,/guest\/parent\.mjs/);
 assert.match(html,/guest\/parent\.css/);
 assert.match(html,/Field Vision/);
 assert.match(html,/isolated from member accounts and official GOAT Games results/);
});
test('guest shell uses strict CSP, no remote code or implicit loading',()=>{
 assert.match(html,/default-src 'none'/);
 assert.match(html,/connect-src 'none'/);
 assert.match(html,/frame-src 'self' about:/);
 assert.match(html,/id="start"/);
 assert.match(parent,/mountGuestGame/);
 assert.match(parent,/\$\('start'\)\.addEventListener\('click'/);
 assert.doesNotMatch(html,/<iframe[\s>]|autoplay|<script>(?!)/);
});
test('guest frames remain opaque and do not gain navigation, form or storage permissions',()=>{
 assert.match(host,/setAttribute\('sandbox', 'allow-scripts'\)/);
 assert.doesNotMatch(host,/sandbox', 'allow-scripts allow-same-origin/);
 assert.match(host,/entry\.search \|\| entry\.hash/);
 assert.match(host,/frame\.remove\(\)/);
 assert.match(host,/removeEventListener\('message'/);
});
test('guest child has strict no-network policy, external classic script, no timer pressure',()=>{
 assert.match(game,/connect-src 'none'/);
 assert.match(game,/script-src 'self'/);
 assert.match(game,/src="field-vision\.js"/);
 assert.match(game,/id="scenario" tabindex="-1"/);
 assert.match(game,/role="status"/);
 assert.doesNotMatch(source,/fetch\(|XMLHttpRequest|WebSocket|localStorage|sessionStorage|setInterval|setTimeout|innerHTML/);
 assert.doesNotMatch(css,/@import|https?:\/\//);
 assert.doesNotThrow(()=>new Function(source));
});
test('game session rejects unrelated sources, forged origins, malformed or duplicate messages',()=>{
 const gate=createGuestSession({attraction:attribution,source:sourcePointer,session,now:()=>42});
 assert.equal(gate.accept({source:{},origin:'null',data:validMessage()}),null);
 assert.equal(gate.accept({source:sourcePointer,origin:'https://fake.test',data:validMessage()}),null);
 assert.equal(gate.accept({source:sourcePointer,origin:'null',data:{...validMessage(),baas:900}}),null);
 assert.equal(gate.accept({source:sourcePointer,origin:'null',data:{...validMessage(),session:'bad'}}),null);
 const first=gate.accept({source:sourcePointer,origin:'null',data:validMessage()});
 assert.deepEqual(first,{attraction:'field-vision',version:1,achievement:'field-vision-clear',observed_at:42,verification:'local-unverified'});
 assert.equal(gate.accept({source:sourcePointer,origin:'null',data:validMessage()}),null);
 gate.close();
 assert.equal(gate.accept({source:sourcePointer,origin:'null',data:{...validMessage(),sequence:2}}),null);
});
test('journal begins in memory and loads storage only upon explicit opt-in',()=>{
 let reads=0,writes=0;
 const storage={getItem(){reads++;return null},setItem(){writes++},removeItem(){}};
 const stamp={attraction:'field-vision',version:1,achievement:'field-vision-clear',observed_at:42,verification:'local-unverified'};
 const guest=createGuestJournal();
 assert.equal(reads,0);
 assert.equal(writes,0);
 assert.equal(guest.record(stamp).persisted,false);
 assert.equal(writes,0);
 const optIn=createGuestJournal({storage,persist:true});
 assert.equal(reads,1);
 assert.equal(optIn.record(stamp).persisted,true);
 assert.equal(writes,1);
 assert.throws(()=>optIn.record({...stamp,verification:'official'}));
});
test('child game performs three keyboard-compatible decisions and sends one strict completion',()=>{
 class Node{
  constructor(id=''){this.id=id;this.attributes={};this.listeners={};this.children=[];this.disabled=true;this.textContent='';this.focused=false;}
  addEventListener(k,f){this.listeners[k]=f;}
  setAttribute(k,v){this.attributes[k]=v;}
  click(){this.listeners.click?.();}
  querySelectorAll(){return this.children;}
  append(n){this.children.push(n);}
  replaceChildren(){this.children=[];}
  focus(){this.focused=true;}
 }
 const ids=[...game.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);
 const els=Object.fromEntries(ids.map(id=>[id,new Node(id)]));
 const document={getElementById:id=>els[id],createElement:tag=>new Node(tag)};
 let onMessage,payloads=[];
 const p={postMessage:(data,target)=>payloads.push({data,target})};
 new Function('document','addEventListener','parent','location',source)(
  document,(name,fn)=>{if(name==='message')onMessage=fn;},p,{origin:'https://goat.example'}
 );
 onMessage({source:p,origin:'https://evil.example',data:{channel:'goatville.guest.v1'}});
 assert.equal(els.choices.children.length,0);
 onMessage({source:p,origin:'https://goat.example',data:{
  channel:'goatville.guest.v1',type:'init',attraction:'field-vision',version:1,session,reducedMotion:false
 }});
 for(let stage=0;stage<3;stage++){
  assert.equal(els.choices.children.length,2);
  els.choices.children[0].click();
  assert.equal(els.next.disabled,false);
  els.next.click();
 }
 assert.equal(payloads.length,1);
 assert.equal(payloads[0].target,'https://goat.example');
 assert.deepEqual(payloads[0].data,validMessage());
 assert.equal(els.next.disabled,true);
 els.next.click();
 assert.equal(payloads.length,1);
});
test('host returns focus, only records local unverified stamps and never touches official API',()=>{
 assert.match(parent,/game\?\.destroy\(\)|game\.destroy\(\)/);
 assert.match(parent,/\$\('start'\)\.focus\(\)/);
 assert.match(parent,/journal\.record\(stamp\)/);
 assert.match(parent,/createGuestJournal\(\)/);
 assert.doesNotMatch(parent,/competition\/commands|\/api\/|official[-_ ]award|fetch\(/);
});
