import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');

test('GOATVILLE entrance preserves GOAT Games discovery and both navigations', () => {
  assert.match(html, /id="welcome-title"[\s\S]*?GOATVILLE/);
  assert.match(html, /href="play\.html"/);
  assert.match(html, /<section class="section games-section" id="goat-games"/);
  assert.match(html, /<nav class="navlinks" aria-label="Main navigation">\s*<a href="#goat-games">GOAT Games<\/a>/);
  assert.match(html, /<nav class="mobile-nav"[^>]*><a href="#goat-games">[\s\S]*?Games<\/a>/);
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

test('homepage does not invent rankings or claim a fake profile registration', () => {
  assert.doesNotMatch(html, /Jordan Vale|Casey Rivers|Morgan Lee|Avery Stone|Taylor Cruz/);
  assert.doesNotMatch(html, /GOAT PROFILE REQUEST CAPTURED|Create your GOAT profile/);
  assert.match(html, /No verified GOAT Universe standings published yet/);
  assert.match(html, /Competition enrollment and member accounts are not offered/);
  assert.doesNotMatch(html, /const competitions=\[/);
});

test('every event has an accessible linked discovery panel', () => {
  const section = html.match(/<section class="section game-discovery"[\s\S]*?<\/section>/)?.[0];
  assert.ok(section);
  assert.equal((section.match(/<details class="game-detail"/g) ?? []).length, 5);
  assert.equal((html.match(/class="games-card-link"/g) ?? []).length, 5);
  const slugs = ['gridiron', 'hoops', 'crossover', 'greatness', 'classic'];
  for (const slug of slugs) {
    assert.match(html, new RegExp('href="#game-details-' + slug + '"'));
    assert.ok(section.includes('id="game-details-' + slug + '"'));
  }
});

test('season calendar presents five games without fabricated schedules', () => {
  assert.equal((html.match(/class="season-card"/g) ?? []).length, 5);
  assert.match(html, /THERE IS NO OFFSEASON/);
  assert.doesNotMatch(html, /QUALIFYING WINDOW OPEN|DSN MATCH OF THE DAY/);
});

test('publications link to separate editor-approved destination safely', () => {
  const domain = 'https://goatverse-publications.downtownadamb.chatgpt.site/';
  const publicationLinks = [...html.matchAll(/<a\b[^>]*href="(https?:\/\/[^"]+)"[^>]*>/g)].filter(x => x[1] === domain);
  assert.ok(publicationLinks.length >= 2);
  for (const [tag] of publicationLinks) {
    assert.match(tag, /target="_blank"/);
    assert.match(tag, /rel="noopener noreferrer"/);
  }
});

test('mobile and keyboard access preserve safe navigation', () => {
  assert.match(html, /class="skip-link" href="#top"/);
  assert.match(html, /<main id="top" tabindex="-1">/);
  assert.match(html, /aria-label="Main navigation"/);
  assert.match(html, /safe-area-inset-bottom/);
  assert.match(html, /prefers-reduced-motion:reduce/);
});
