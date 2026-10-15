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
  window.setInterval = callback => { intervalCallback = callback; return 7; };
  window.clearInterval = () => {};
  window.Math.random = () => 0;
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

  for (let i = 0; i < 20; i++) intervalCallback();
  assert.equal(start.disabled, false);
  assert.equal(tiles[0].disabled, true);
  assert.match(window.document.querySelector('#status').textContent, /Drill complete/);
  window.document.querySelector('#reset').click();
  assert.equal(window.document.querySelector('#score').textContent, '0');
  assert.equal(window.document.querySelector('#time').textContent, '20');
  assert.equal(window.localStorage.length, 0);
  window.close();
});
