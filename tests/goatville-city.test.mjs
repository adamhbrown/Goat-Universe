import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {test} from 'node:test';
const city=readFileSync(new URL('../goatville-city.html',import.meta.url),'utf8');
const home=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const playground=readFileSync(new URL('../goatville.html',import.meta.url),'utf8');
test('seven city districts with distinct roles',()=>{
 for(const d of ['athletic','campus','culture','legends','market','commons','afterdark'])assert.match(city,new RegExp('data-district="'+d+'"'));
 assert.equal((city.match(/class="district"/g)||[]).length,7);
});
test('home and playground lead to city',()=>{
 assert.match(home,/href="goatville-city.html"/);
 assert.match(playground,/href="goatville-city.html"/);
});
test('playable sports destination links to working play lab',()=>assert.match(city,/href="goat-games-play-lab.html"/));
test('original responsive skyline illustration and accessible navigation',()=>{
 assert.match(city,/<svg class="skyline"/);
 assert.match(city,/aria-label="Illustrated nighttime GOATVILLE skyline/);
 assert.match(city,/href="#districts"/);
 assert.match(city,/prefers-reduced-motion:reduce/);
});
test('unlaunched market and destinations clearly labeled',()=>{
 assert.match(city,/PLANNED · NO CHECKOUT/);
 assert.match(city,/IN DEVELOPMENT/);
 assert.match(city,/No store checkout, memberships, prizes/);
});
test('no duplicate element IDs and all internal anchors resolve',()=>{
 const ids=[...city.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);
 assert.equal(ids.length,new Set(ids).size);
 for(const [,hash] of city.matchAll(/href="#([^"]+)"/g))assert.ok(ids.includes(hash),hash);
});
test('no remote code, tracking, or payment widgets',()=>{
 assert.match(city,/<script defer src="experience\/city-atlas\.js"><\/script>/);
 assert.doesNotMatch(city,/<script\b[^>]+src="https?:|fetch\(|<iframe|checkout\.stripe|paypal/);
});

test('premium cinematic entrance is explicitly opt-in, three chapters and skippable',()=>{
 assert.match(city,/id="open-cinema"/);
 assert.match(city,/<dialog class="city-gate"/);
 assert.match(city,/id="cinema-next"/);
 assert.match(city,/id="cinema-skip"/);
 assert.match(city,/id="cinema-close"/);
 assert.match(city,/const chapters=\[/);
 assert.match(city,/const c=chapters\[chapter\]/);
 assert.match(city,/dialog\.showModal\(\)/);
 assert.match(city,/dialog\.close\(\)/);
 assert.doesNotMatch(city,/autoplay|<audio|<video|AudioContext/);
});
test('city navigation has five accessible filters and preserved destination links',()=>{
 assert.equal((city.match(/class="city-filter"/g)||[]).length,5);
 assert.equal((city.match(/<article class="district" data-district="/g)||[]).length,7);
 assert.match(city,/id="filter-status" role="status" aria-live="polite"|role="status" aria-live="polite" id="filter-status"/);
 assert.match(city,/d\.hidden=!show/);
});
test('cinema and district interactions run in simulated DOM',()=>{
 class Node{
  constructor(id){this.id=id;this.attributes={};this.dataset={};this.listeners={};this.children=[];this.hidden=false;this.textContent='';this.innerHTML='';this.open=false;this.classList={toggle:()=>{}};this.scrolls=0;}
  addEventListener(name,fn){this.listeners[name]=fn;}
  click(){this.listeners.click?.({target:this});}
  setAttribute(k,v){this.attributes[k]=v;}
  getAttribute(k){return this.attributes[k];}
  showModal(){this.open=true;}
  close(){this.open=false;}
  scrollIntoView(){this.scrolls++;}
  focus(){}
 }
 const ids=[...city.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);
 const nodes=Object.fromEntries(ids.map(id=>[id,new Node(id)]));
 const filters=['all','athletic','culture','legends','afterdark'].map(key=>{const n=new Node('filter-'+key);n.dataset.filter=key;return n;});
 const districtNames=['athletic','campus','culture','legends','market','commons','afterdark'];
 const districts=districtNames.map(name=>{const n=new Node('district-'+name);n.dataset.district=name;return n;});
 nodes['cinema-progress'].children=[new Node(),new Node(),new Node()];
 const doc={getElementById:id=>nodes[id],querySelectorAll:sel=>sel==='[data-filter]'?filters:sel==='[data-district]'?districts:[]};
 const script=city.match(/<script>([\s\S]*?)<\/script>/)?.[1];
 assert.ok(script);
 assert.doesNotThrow(()=>new Function('document','window','location',script)(doc,{matchMedia:()=>({matches:true})},{hash:''}));
 nodes['open-cinema'].click();
 assert.equal(nodes['goatville-intro'].open,true);
 assert.match(nodes['cinema-heading'].textContent,/EVERY LEGEND/);
 nodes['cinema-next'].click();
 assert.match(nodes['cinema-heading'].textContent,/ONE CITY/);
 nodes['cinema-next'].click();
 assert.match(nodes['cinema-heading'].textContent,/WELCOME TO/);
 nodes['cinema-next'].click();
 assert.equal(nodes['goatville-intro'].open,false);
 assert.equal(nodes.districts?.scrolls||nodes['districts'].scrolls,1);
 nodes['open-cinema'].click();
 nodes['cinema-skip'].click();
 assert.equal(nodes['goatville-intro'].open,false);
 assert.equal(nodes['districts'].scrolls,2);
 filters[1].click();
 assert.equal(districts.filter(n=>!n.hidden).length,1);
 assert.equal(districts.find(n=>!n.hidden).dataset.district,'athletic');
 assert.equal(filters[1].attributes['aria-pressed'],'true');
 filters[0].click();
 assert.equal(districts.filter(n=>!n.hidden).length,7);
});
