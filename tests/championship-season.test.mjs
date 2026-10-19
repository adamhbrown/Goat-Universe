import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {JSDOM} from 'jsdom';

const html = readFileSync(new URL('../championships.html', import.meta.url), 'utf8');
const script = [...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)].map(match => match[1]).join('\n');
function render(hash = '') {
  const dom = new JSDOM(html, {url: 'https://founder.example/championships.html' + hash, runScripts: 'outside-only'});
  dom.window.eval(script);
  return dom;
}

test('2027 journey shows exactly the five official GOAT Games with distinct existing workspace routes', () => {
  const dom = render();
  const events = [...dom.window.document.querySelectorAll('article.event[data-event-month]')];
  assert.deepEqual(events.map(e => e.dataset.eventMonth), ['jan', 'mar', 'apr', 'sep', 'oct']);
  assert.deepEqual(events.map(e => e.querySelector('h3').textContent), [
    '1st & BAA', 'Horns & Hoops', 'GOAT Crossover', 'League of Greatness', 'The GOAT Classic'
  ]);
  assert.deepEqual(events.map(e => e.querySelector('.event-side a').getAttribute('href')), [
    '/games/first-and-baa', '/games/horns-and-hoops', '/games/goat-crossover',
    '/games/league-of-greatness', '/games/goat-classic'
  ]);
  assert.match(dom.window.document.body.textContent, /Season window only/);
  assert.doesNotMatch(dom.window.document.body.textContent, /Buy now|register today|tickets on sale/i);
  dom.window.close();
});

test('season controls genuinely filter the five event cards without misrepresenting ranking data', () => {
  const dom = render();
  const doc = dom.window.document;
  assert.equal(doc.querySelectorAll('.event:not([hidden])').length, 5);
  const april = doc.querySelector('button[data-month="apr"]');
  april.click();
  assert.equal(doc.querySelectorAll('.event:not([hidden])').length, 1);
  assert.equal(doc.querySelector('.event:not([hidden]) h3').textContent, 'GOAT Crossover');
  assert.equal(april.getAttribute('aria-pressed'), 'true');
  assert.equal(doc.querySelector('button[data-month="all"]').getAttribute('aria-pressed'), 'false');
  assert.match(doc.getElementById('filter-state').textContent, /1 GOAT Game in APR 2027/);
  doc.querySelector('button[data-month="all"]').click();
  assert.equal(doc.querySelectorAll('.event:not([hidden])').length, 5);
  dom.window.close();
});

test('month deep links open the requested roadmap window', () => {
  const dom = render('#oct');
  assert.equal(dom.window.document.querySelectorAll('.event:not([hidden])').length, 1);
  assert.equal(dom.window.document.querySelector('.event:not([hidden]) h3').textContent, 'The GOAT Classic');
  dom.window.close();
});

test('GST and New York show the exact same instant and refresh from America/New_York', () => {
  const dom = render();
  const doc = dom.window.document;
  const gst = doc.getElementById('gst-clock');
  const nyc = doc.getElementById('nyc-clock');
  assert.equal(gst.textContent, nyc.textContent);
  assert.equal(gst.getAttribute('datetime'), nyc.getAttribute('datetime'));
  assert.match(script, /timeZone:'America\/New_York'/);
  assert.match(gst.textContent, /[AP]M/);
  assert.match(script, /new Date\(\)/);
  assert.doesNotMatch(script, /Date\.UTC\(|\bUTC[-+]\d|fixedOffset/i);
  dom.window.close();
});

test('Tiffany journey remains mobile-first, accessible and connected to GPI, media and accounts', () => {
  const dom = render();
  const doc = dom.window.document;
  assert.equal(doc.querySelector('h1').textContent.trim(), 'The road to greatness.');
  assert.ok(doc.querySelector('a[href="./gpi.html"]'));
  assert.ok(doc.querySelector('a[href="./goatville-cinema.html"]'));
  assert.ok(doc.querySelector('a[href="/manage"]'));
  assert.equal(doc.querySelectorAll('.bottom-nav a').length, 4);
  assert.equal(doc.querySelectorAll('.filter[aria-pressed]').length, 6);
  assert.match(html, /prefers-reduced-motion:reduce/);
  assert.match(html, /safe-area-inset-bottom/);
  assert.match(html, /No public entries, payments or rankings/);
  assert.doesNotMatch(script, /\bfetch\s*\(|\blocalStorage\b|\bsessionStorage\b/);
  dom.window.close();
});

test('existing entrance and GPI route directly into the real 2027 journey', () => {
  const arrival = readFileSync(new URL('../arrival-experience.html', import.meta.url), 'utf8');
  const gpi = readFileSync(new URL('../gpi.html', import.meta.url), 'utf8');
  const publicFiles = JSON.parse(readFileSync(new URL('../backend/public-files.json', import.meta.url), 'utf8'));
  assert.match(arrival, /href="\.\/championships\.html"/);
  assert.match(gpi, /href="\.\/championships\.html"/);
  assert.ok(publicFiles.includes('championships.html'));
});
