import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {JSDOM} from 'jsdom';

const page = readFileSync(new URL('../goatville-cinema.html', import.meta.url), 'utf8');
const player = readFileSync(new URL('../cinema/studio.js', import.meta.url), 'utf8');

test('cinema music anchor stays public while the screening-room audio has a unique ID', () => {
  const dom = new JSDOM(page, {url:'https://founder.example/goatville-cinema.html'});
  const doc = dom.window.document;
  const ids = [...doc.querySelectorAll('[id]')].map(node => node.id);
  assert.equal(new Set(ids).size, ids.length, 'duplicated IDs may select an arbitrary element');
  assert.equal(doc.querySelector('#music').tagName, 'DIV', 'music anchor must stay for Club GOAT links');
  assert.equal(doc.querySelector('#studio-music').tagName, 'AUDIO');
  assert.match(player, /const music = byId\('studio-music'\);/);
  assert.doesNotMatch(player, /const music = byId\('music'\);/);
  assert.ok(doc.querySelector('a[href="#music"]') || doc.querySelector('#music'));
  dom.window.close();
});

test('cinema player targets a real media element with pause and play controls', () => {
  const dom = new JSDOM(page, {url:'https://founder.example/goatville-cinema.html'});
  const media = dom.window.document.getElementById('studio-music');
  assert.equal(typeof media.pause, 'function');
  assert.equal(typeof media.play, 'function');
  assert.equal(media.preload, 'none');
  dom.window.close();
});
