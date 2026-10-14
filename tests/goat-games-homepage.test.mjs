import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');

test('GOAT Games feature is visible in hero, page and both navigations', () => {
  assert.match(html, /<h1>THE <span>GOAT<\/span> GAMES\.<\/h1>/);
  assert.match(html, /<section class="section games-section" id="goat-games"/);
  assert.match(html, /<nav class="navlinks">\s*<a href="#goat-games">GOAT Games<\/a>/);
  assert.match(html, /<nav class="mobile-nav"[^>]*><a href="#goat-games">Games<\/a>/);
});

test('five event identities and exact approved taglines are present', () => {
  const games = html.match(/<section class="section games-section"[\s\S]+?<\/section>/)?.[0];
  assert.ok(games, 'section exists');
  assert.equal((games.match(/class="games-card" data-number=/g) ?? []).length, 5);
  const names = [
    '1st &amp; BAA', 'Goats of the Gridiron Playoff League',
    'Horns &amp; Hoops', "Downtown's BAAsketball Showcase XXXV",
    'GOAT Crossover', 'Two Sports, 1 Competition',
    'League of Greatness', 'Fantasy Football Championships',
    'The GOAT Classic', 'Take Your Swing at History',
  ];
  for (const name of names) assert.ok(games.includes(name), 'missing ' + name);
});

test('all internal anchor links resolve uniquely', () => {
  const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]);
  assert.equal(ids.length, new Set(ids).size, 'IDs must be unique');
  const hrefs = [...html.matchAll(/href="#([^"]+)"/g)].map(match => match[1]);
  for (const href of hrefs) assert.ok(ids.includes(href), 'broken anchor: #' + href);
});

test('preview avoids invented live gameplay claims', () => {
  assert.match(html, /Competition experiences are in development/);
  assert.match(html, /not a live registration or results service/);
  assert.doesNotMatch(html, /DSN MATCH OF THE DAY/);
  assert.doesNotMatch(html, /remaining=3\*86400/);
});

test('responsive and keyboard accessible baseline styles exist', () => {
  assert.match(html, /@media\(max-width:560px\)/);
  assert.match(html, /a:focus-visible,button:focus-visible/);
  assert.match(html, /prefers-reduced-motion:reduce/);
});
