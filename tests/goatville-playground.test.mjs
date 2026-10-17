import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const page = readFileSync(new URL('../goatville.html', import.meta.url), 'utf8');
const home = readFileSync(new URL('../goatville-stadium.html', import.meta.url), 'utf8');
const script = page.match(/<script>([\s\S]*?)<\/script>/)?.[1];

test('GOATVILLE is reachable from both main and mobile homepage navigation', () => {
  assert.match(home, /<a href="goatville\.html">GOATVILLE<\/a>/);
  assert.match(home, /<a href="goatville\.html">Play<\/a>/);
  assert.match(home, /id="goatville"/);
  assert.match(home, /ENTER GOATVILLE CITY/);
});
test('GOATVILLE has a coherent entrance and accessible landmark structure', () => {
  assert.match(page, /WELCOME TO/);
  assert.match(page, /GOATVILLE\./);
  assert.match(page, /<main id="main">/);
  assert.match(page, /class="skip" href="#main"/);
  assert.match(page, /<nav aria-label="GOATVILLE navigation">/);
});
test('Six map destinations link to real destinations', () => {
  assert.equal((page.match(/class="place p[1-6]"/g) ?? []).length, 6);
  assert.match(page, /index\.html#goat-games/);
  assert.match(page, /GOAT TEE/);
  assert.match(page, /GOATverse|GOATVERSE PUBLICATIONS/);
});
test('Games expose two accessible tab panels', () => {
  assert.equal((page.match(/role="tab" /g) ?? []).length, 2);
  assert.equal((page.match(/role="tabpanel"/g) ?? []).length, 2);
  assert.match(page, /aria-live="polite"/);
});
test('Sports trivia includes six questions, answers, scoring and retry', () => {
  assert.equal((page.match(/\{q:'/g) ?? []).length, 6);
  assert.match(page, /qscore\+\+/);
  assert.match(page, /id="quiz-reset"/);
  assert.match(page, /addStamp\('quiz'\)/);
});
test('GOAT TEE includes three holes, skill inputs, scoring and reset', () => {
  assert.match(page, /const holes=\[\{wind:4,power:64\},\{wind:-6,power:78\},\{wind:8,power:48\}\]/);
  assert.match(page, /id="aim" type="range"/);
  assert.match(page, /id="power" type="range"/);
  assert.match(page, /const h=holes\[gidx\]/);
  assert.match(page, /addStamp\('golf'\)/);
  assert.match(page, /id="golf-reset"/);
});
test('Guest passport saves only by opt-in and clearly marks progress unverified', () => {
  assert.match(page, /id="passport-save" aria-pressed="false"/);
  assert.match(page, /id="clear-passport"/);
  assert.match(page, /local-unverified/);
  assert.match(page, /const storage=window.localStorage/);
  assert.match(page, /Guest stamps start in memory only/);
  assert.match(page, /STOP SAVING/);
  assert.match(page, /deviceStore.removeItem\(key\)/);
  assert.match(page, /Saving is unavailable here/);
  assert.doesNotMatch(page, /fetch\(|XMLHttpRequest|WebSocket|<form\b/);
});

test('Internal links resolve to unique IDs', () => {
  const ids = [...page.matchAll(/\bid="([^"]+)"/g)].map(m => m[1]);
  assert.equal(ids.length, new Set(ids).size);
  for (const [, href] of page.matchAll(/href="#([^"]+)"/g)) {
    assert.ok(ids.includes(href), 'Broken internal link: #' + href);
  }
});
test('JavaScript parses and mobile/reduced-motion styles exist', () => {
  assert.ok(script);
  assert.doesNotThrow(() => new Function(script));
  assert.match(page, /@media\(max-width:510px\)/);
  assert.match(page, /prefers-reduced-motion:reduce/);
});
test('GOATVILLE does not misrepresent arcade games as official competitions', () => {
  assert.match(page, /separate from official GOAT Games scoring/);
  assert.match(page, /No official competition registration, prizes or verified competitive rankings/);
});

test('Mayor Billy GOAT town square has three interactive visitor choices', () => {
  assert.match(page, /id="town-square"/);
  assert.match(page, /MAYOR BILLY GOAT/);
  assert.equal((page.match(/class="town-choice"/g) ?? []).length, 3);
  assert.match(page, /const mayorLines=/);
  assert.match(page, /id="mayor-response"/);
});

test('Guest passport does not access localStorage before explicit save action',()=>{
  const prefix=script.slice(0,script.indexOf("const mayorLines="));
  assert.ok(prefix);
  const ids=[...page.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);
  const nodes=Object.fromEntries(ids.map(id=>{
    const listeners={},classes=new Set();
    const node={id,style:{},children:[],attributes:{},disabled:false,hidden:false,
      classList:{toggle:(name,on)=>on?classes.add(name):classes.delete(name),
        contains:name=>classes.has(name)},listeners,
      addEventListener:(name,fn)=>{listeners[name]=fn;},
      setAttribute(name,value){this.attributes[name]=value;}};
    return [id,node];
  }));
  let touches=0;
  const storage={getItem(){touches++;return null;},setItem(){touches++;},removeItem(){touches++;}};
  const fakeWindow={get localStorage(){touches++;return storage;}};
  const fakeDocument={getElementById:id=>nodes[id]};
  new Function('document','window',prefix+'})();')(fakeDocument,fakeWindow);
  assert.equal(touches,0,'storage untouched on load');
  nodes['passport-save'].listeners.click();
  assert.ok(touches>=2,'explicit opt-in touches storage');
  assert.equal(nodes['passport-save'].attributes['aria-pressed'],'true');
  nodes['passport-save'].listeners.click();
  assert.equal(nodes['passport-save'].attributes['aria-pressed'],'false');
});
