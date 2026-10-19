import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {JSDOM} from 'jsdom';

const html=readFileSync(new URL('../commerce.html',import.meta.url),'utf8');
const script=readFileSync(new URL('../commerce/collections.js',import.meta.url),'utf8');
const arrival=readFileSync(new URL('../arrival-experience.html',import.meta.url),'utf8');
const allowlist=JSON.parse(readFileSync(new URL('../backend/public-files.json',import.meta.url),'utf8'));
const render=()=>{
  const dom=new JSDOM(html,{url:'https://goat.example/commerce.html',runScripts:'outside-only'});
  dom.window.eval(script);
  return dom;
};

test('luxury commerce is linked from the integrated arrival and allowed for reviewed visitor serving',()=>{
  assert.match(arrival,/href="\.\/commerce\.html#collections"/);
  assert.match(arrival,/href="\.\/commerce\.html#partnerships"/);
  assert.ok(allowlist.includes('commerce.html'));
  assert.ok(allowlist.includes('commerce/collections.js'));
  assert.match(html,/href="\.\/arrival-experience\.html#games"/);
  assert.match(html,/href="\.\/founder\.html#contact"/);
});

test('seven collections expose founder concepts without fictional inventory or checkout',()=>{
  const dom=render();
  const doc=dom.window.document;
  assert.equal(doc.querySelectorAll('article.collection').length,7);
  assert.equal(doc.querySelectorAll('article.collection .collection-foot').length,7);
  assert.ok([...doc.querySelectorAll('.collection-foot')].every(e=>e.textContent.includes('Not yet available')));
  assert.doesNotMatch(html,/\bAdd to cart\b|\bBuy now\b|\bIn stock\b/i);
  assert.match(doc.body.textContent,/CAN’T STOP THE BAA/);
  assert.match(doc.body.textContent,/PLAY LIKE A GOAT/);
  assert.match(doc.body.textContent,/BAA COUNTRY/);
  dom.window.close();
});

test('category filters update visibility, accessible pressed state and live status',()=>{
  const dom=render(),d=dom.window.document;
  const all=d.querySelector('[data-filter="all"]');
  const monograms=d.querySelector('[data-filter="monogram"]');
  monograms.click();
  assert.equal(monograms.getAttribute('aria-pressed'),'true');
  assert.equal(all.getAttribute('aria-pressed'),'false');
  assert.equal([...d.querySelectorAll('article.collection')].filter(e=>!e.hidden).length,3);
  assert.match(d.getElementById('filter-status').textContent,/3 proposed collections/);
  d.querySelector('[data-filter="time"]').click();
  assert.equal([...d.querySelectorAll('article.collection')].filter(e=>!e.hidden).length,1);
  all.click();
  assert.equal([...d.querySelectorAll('article.collection')].filter(e=>!e.hidden).length,7);
  dom.window.close();
});

test('GST uses the official New York time zone and paired second-level clocks agree',()=>{
  const dom=render(),d=dom.window.document;
  assert.match(script,/timeZone: 'America\/New_York'/);
  assert.equal(d.getElementById('gst-time').textContent,d.getElementById('ny-time').textContent);
  assert.notEqual(d.getElementById('gst-time').textContent,'--:--:--');
  assert.match(html,/daylight saving transitions/);
  dom.window.close();
});

test('existing four primary arrival destinations remain intact',()=>{
  const dom=new JSDOM(arrival);
  assert.deepEqual([...dom.window.document.querySelectorAll('nav.nav a')].map(e=>e.textContent.trim().replace(/^[^A-Za-z]+/,'')),['Goatville','Games','Media','My League']);
  dom.window.close();
});
