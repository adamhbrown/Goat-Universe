import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import { JSDOM } from 'jsdom';
import test from 'node:test';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const html = fs.readFileSync(path.join(root, 'experiments/goatville/field-vision.html'), 'utf8');

test('Field Vision is a self-contained accessible guest experience', () => {
  const dom = new JSDOM(html, { runScripts: 'outside-only', url: 'https://goatville.test/' });
  const { document } = dom.window;
  assert.equal(document.documentElement.lang, 'en');
  assert.equal(document.querySelectorAll('h1').length, 1);
  for (const button of document.querySelectorAll('button')) {
    assert.ok((button.getAttribute('aria-label') || button.textContent).trim(), `button has an accessible name: ${button.id || button.dataset.position}`);
  }
  assert.equal(document.querySelectorAll('[role="status"]').length, 1);
  assert.equal(document.querySelectorAll('[data-position]').length, 16);
  assert.match(html, /prefers-reduced-motion:\s*reduce/);
  assert.doesNotMatch(html, /<script[^>]+src=|<link[^>]+href=|\b(?:fetch|XMLHttpRequest|localStorage|sessionStorage|indexedDB|WebSocket)\b/);
  assert.match(html, /No account, network request, competition points/);
  assert.doesNotMatch(html, /SUPABASE|service.role|api[_-]?key/i);
  const script = [...document.querySelectorAll('script')].map(node => node.textContent).join('\n');
  assert.doesNotThrow(() => new vm.Script(script));
  dom.window.close();
});

test('guest drill starts, accepts correct calls, and resets without persistent state', () => {
  const dom = new JSDOM(html, { runScripts: 'outside-only', pretendToBeVisual: true, url: 'https://goatville.test/' });
  const { window } = dom;
  let intervalCallback;
  let now = 0;
  window.setInterval = callback => { intervalCallback = callback; return 7; };
  window.clearInterval = () => {};
  window.Math.random = () => 0;
  window.Date.now = () => now;
  const script = [...window.document.querySelectorAll('script')].map(node => node.textContent).join('\n');
  window.eval(script);

  const start = window.document.querySelector('#start');
  const tiles = [...window.document.querySelectorAll('[data-position]')];
  assert.equal(tiles[0].disabled, true);
  start.click();
  assert.equal(start.disabled, true);
  assert.equal(tiles[0].disabled, false);
  assert.equal(window.document.querySelector('#target-number').textContent, '01');
  tiles[0].click();
  assert.equal(window.document.querySelector('#score').textContent, '1');
  assert.match(window.document.querySelector('#status').textContent, /Correct call/);

  // Simulate a backgrounded mobile tab where interval callbacks are delayed.
  now = 19_500;
  intervalCallback();
  assert.equal(window.document.querySelector('#time').textContent, '1');
  now = 20_000;
  intervalCallback();
  assert.equal(start.disabled, false);
  assert.equal(tiles[0].disabled, true);
  assert.match(window.document.querySelector('#status').textContent, /Drill complete/);
  window.document.querySelector('#reset').click();
  assert.equal(window.document.querySelector('#score').textContent, '0');
  assert.equal(window.document.querySelector('#time').textContent, '20');
  assert.equal(window.localStorage.length, 0);
  window.close();
});

test('a late tap ends the drill even when a throttled timer has not fired', () => {
  const dom = new JSDOM(html, { runScripts: 'outside-only', url: 'https://goatville.test/' });
  const { window } = dom;
  let now = 0;
  let intervalCallback;
  window.Date.now = () => now;
  window.setInterval = callback => { intervalCallback = callback; return 7; };
  window.clearInterval = () => {};
  window.Math.random = () => 0;
  window.eval([...window.document.querySelectorAll('script')].map(node => node.textContent).join('\n'));

  const start = window.document.querySelector('#start');
  const firstTile = window.document.querySelector('[data-position="1"]');
  start.click();
  firstTile.click();
  assert.equal(window.document.querySelector('#score').textContent, '1');

  now = 20_001; // No interval callback since start: the real deadline still wins.
  firstTile.click();
  assert.equal(window.document.querySelector('#score').textContent, '1');
  assert.equal(window.document.querySelector('#time').textContent, '0');
  assert.equal(firstTile.disabled, true);
  assert.match(window.document.querySelector('#status').textContent, /Drill complete/);

  // A stale callback after completion cannot alter the completed state.
  intervalCallback();
  assert.equal(window.document.querySelector('#time').textContent, '0');
  window.close();
});

test('reset during a round clears its deadline and allows a fresh start', () => {
  const dom = new JSDOM(html, { runScripts: 'outside-only', url: 'https://goatville.test/' });
  const { window } = dom;
  let now = 0;
  window.Date.now = () => now;
  window.setInterval = () => 7;
  window.clearInterval = () => {};
  window.Math.random = () => 0;
  window.eval([...window.document.querySelectorAll('script')].map(node => node.textContent).join('\n'));

  const start = window.document.querySelector('#start');
  const tile = window.document.querySelector('[data-position="1"]');
  start.click();
  tile.click();
  window.document.querySelector('#reset').click();
  now = 25_000;
  tile.click();
  assert.equal(window.document.querySelector('#score').textContent, '0');
  assert.equal(tile.disabled, true);
  assert.equal(window.document.querySelector('#time').textContent, '20');

  start.click();
  tile.click();
  assert.equal(window.document.querySelector('#score').textContent, '1');
  window.close();
});
