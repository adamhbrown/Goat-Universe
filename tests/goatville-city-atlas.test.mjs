import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';

const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const city=read('goatville-city.html');
const script=read('experience/city-atlas.js');
const styles=read('experience/city-atlas.css');
const districts=['athletic','campus','culture','legends','market','commons','afterdark'];

test('map is an accessible seven-district visual entry to existing content',()=>{
 assert.match(city,/aria-labelledby="gv-atlas-heading"/);
 assert.match(city,/class="gv-map-illustration"/);
 assert.match(city,/aria-label="GOATVILLE city atlas/);
 assert.match(city,/aria-live="polite">THE ATHLETIC DISTRICT/);
 assert.match(city,/ORIGINAL FICTIONAL WORLD/);
 assert.match(city,/EXPlORE/mi);
 assert.equal((city.match(/data-map-point="/g)||[]).length,7);
 for(const district of districts){
  assert.match(city,new RegExp('data-map-point="'+district+'"'));
  assert.match(city,new RegExp('id="district-'+district+'" tabindex="-1"'));
 }
 assert.match(city,/href="experience\/city-atlas.css"/);
 assert.match(city,/src="experience\/city-atlas.js"/);
 assert.doesNotMatch(styles,/@import|https?:\/\//);
 assert.doesNotThrow(()=>new Function(script));
});

test('map remains usable on small screens and for reduced motion',()=>{
 assert.match(styles,/@media\(max-width:620px\)/);
 assert.match(styles,/@media\(max-width:350px\)/);
 assert.match(styles,/prefers-reduced-motion:reduce/);
 assert.match(styles,/\.gv-map-pin:focus-visible/);
 assert.match(city,/role="group" aria-label="GOATVILLE city atlas/);
 assert.match(city,/type="button" class="gv-map-pin"/);
 assert.match(city,/aria-pressed="true"/);
});

test('map never invents purchases, official competition results or physical locations',()=>{
 assert.match(script,/PLANNED \/ NO CHECKOUT/);
 assert.match(script,/IN DEVELOPMENT/);
 assert.match(script,/PLAYABLE DEMOS/);
 assert.match(city,/NOT A PHYSICAL MAP/);
 assert.doesNotMatch(script,/fetch\(|XMLHttpRequest|WebSocket|localStorage|sessionStorage|AudioContext|\.play\(|innerHTML/);
});

test('district selection exposes a live description and routes to correct existing cards',()=>{
 class Node{
  constructor({id='',dataset={}}={}){
   this.id=id;this.dataset=dataset;this.attrs={};this.handlers={};
   this.tabIndex=-1;this.textContent='';this.href='';this.focused=false;
  }
  addEventListener(k,fn){this.handlers[k]=fn;}
  click(){this.handlers.click?.({target:this});}
  keydown(key){let prevented=false;this.handlers.keydown?.({key,preventDefault:()=>{prevented=true}});return prevented;}
  setAttribute(k,v){this.attrs[k]=v;}
  getAttribute(k){return this.attrs[k];}
  focus(){this.focused=true;}
 }
 const points=districts.map(name=>new Node({dataset:{mapPoint:name}}));
 const ids=['map-detail-title','map-detail-status','map-detail-description','map-detail-route','map-detail-number'];
 const nodes=Object.fromEntries(ids.map(id=>[id,new Node({id})]));
 let resetCount=0;
 const all=new Node({dataset:{filter:'all'}});
 all.setAttribute('aria-pressed','false');
 all.click=()=>{resetCount++;all.setAttribute('aria-pressed','true');};
 const doc={
  getElementById:id=>nodes[id],
  querySelectorAll:selector=>selector==='[data-map-point]'?points:[],
  querySelector:selector=>selector==='[data-filter="all"]'?all:null
 };
 new Function('document',script)(doc);
 assert.equal(nodes['map-detail-title'].textContent,'THE ATHLETIC DISTRICT');
 assert.equal(points.filter(p=>p.tabIndex===0).length,1);
 assert.equal(nodes['map-detail-route'].href,'#district-athletic');
 points[2].click();
 assert.equal(nodes['map-detail-title'].textContent,'THE CULTURE DISTRICT');
 assert.equal(nodes['map-detail-route'].href,'#district-culture');
 assert.equal(points[2].attrs['aria-pressed'],'true');
 assert.equal(points[0].attrs['aria-pressed'],'false');
 assert.equal(nodes['map-detail-status'].textContent,'PRIVATE CREATIVE PREVIEW');
 const prevent=points[2].keydown('ArrowRight');
 assert.equal(prevent,true);
 assert.equal(nodes['map-detail-route'].href,'#district-legends');
 assert.equal(points[3].focused,true);
 assert.equal(points[3].keydown('Home'),true);
 assert.equal(nodes['map-detail-route'].href,'#district-athletic');
 assert.equal(points[0].keydown('End'),true);
 assert.equal(nodes['map-detail-route'].href,'#district-afterdark');
 assert.equal(points.filter(p=>p.tabIndex===0).length,1);
 assert.equal(points[6].keydown('q'),false);
 nodes['map-detail-route'].click();
 assert.equal(resetCount,1);
 nodes['map-detail-route'].click();
 assert.equal(resetCount,1);
 assert.match(nodes['map-detail-route'].attrs['aria-label'],/AFTER DARK/);
});

test('existing district category filters and other city experiences remain present',()=>{
 assert.equal((city.match(/class="city-filter"/g)||[]).length,5);
 assert.equal((city.match(/<article class="district" data-district="/g)||[]).length,7);
 assert.equal((city.match(/class="arrival-card"/g)||[]).length,3);
 assert.match(city,/id="open-cinema"/);
 assert.match(city,/href="goat-games-play-lab\.html"/);
 assert.match(city,/href="goatville-spotlight\.html"/);
 assert.match(city,/href="goatville-cinema\.html"/);
});
