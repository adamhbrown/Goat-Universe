import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const page = readFileSync(new URL('../goatville.html', import.meta.url), 'utf8');
const home = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const script = page.match(/<script>([\s\S]*?)<\/script>/)?.[1];

test('GOATVILLE is reachable from both main and mobile homepage navigation', () => {
  assert.match(home, /<a href="goatville\.html">GOATVILLE<\/a>/);
  assert.match(home, /<a href="goatville\.html">Play<\/a>/);
  assert.match(home, /id="goatville"/);
  assert.match(home, /ENTER GOATVILLE USA/);
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
test('Local passport has transparent storage and clearing controls', () => {
  assert.match(page, /localStorage\.getItem/);
  assert.match(page, /localStorage\.setItem/);
  assert.match(page, /id="clear-passport"/);
  assert.match(page, /stored only in this browser/);
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
