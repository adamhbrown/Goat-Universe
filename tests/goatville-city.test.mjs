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
 assert.doesNotMatch(city,/<script|fetch\(|<iframe|checkout\.stripe|paypal/);
});
