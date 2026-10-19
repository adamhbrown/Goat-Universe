import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';
import { GOAT_GAMES } from '../rules/goat-games.mjs';

test('member portal exposes the founder-approved mobile journey without implying launch', async () => {
  const [html, css, script] = await Promise.all([
    readFile(new URL('../console/play.html', import.meta.url), 'utf8'),
    readFile(new URL('../console/play.css', import.meta.url), 'utf8'),
    readFile(new URL('../console/play.mjs', import.meta.url), 'utf8')
  ]);
  assert.match(html, /aria-label="GOAT Universe"/);
  for (const label of ['Goatville', 'Games', 'Media', 'My League', 'Enter the Universe']) assert.match(html, new RegExp('>' + label + '<', 'i'));
  assert.match(html, /href="#media"/);
  assert.match(html, /id="media"/);
  assert.match(html, /Included with every league/);
  for (const format of ['GOAT Alerts', 'BAA Reports', 'League Magazines', 'Player Spotlights']) assert.match(html, new RegExp(format));
  assert.match(html, /https:\/\/goatverse-publications\.downtownadamb\.chatgpt\.site\//);
  assert.match(html, /integration is in development/);
  assert.match(html, /id="founder"/);
  assert.match(html, /Adam Brown/);
  assert.match(html, /El Commissioner de Goat · Founder &amp; CEO/);
  assert.match(html, /making being a sports fan more entertaining/);
  for (const path of ['Brand &amp; Licensing', 'Leagues &amp; Platforms', 'Media &amp; Capital']) assert.match(html, new RegExp(path));
  assert.match(html, /Public inquiry routing is not yet open/);
  assert.doesNotMatch(html, /<form[^>]+(?:contact|partner)|mailto:/i);
  assert.match(html, /id="my-league"/);
  assert.match(html, /id="game-journey"/);
  assert.match(html, /id="game-journey-member-link" href="#my-league"/);
  assert.match(html, /href="\/manage"/);
  assert.match(script, /function openGameJourney\(game\)/);
  assert.match(script, /Rules and scoring are pending approval/);
  for (const scope of ['Global', 'Block', 'County', 'State', 'Region']) assert.match(script, new RegExp(scope, 'i'));
  assert.match(html, /Verified results only/);
  assert.match(html, /Development portal · No live competition or purchases/);
  assert.match(html, /GOATVILLE STANDARD TIME/);
  assert.match(html, /id="gst-clock"/);
  assert.match(html, /America\/New_York · automatic EDT\/EST/);
  assert.match(script, /timeZone:\s*GST_TIME_ZONE/);
  assert.match(script, /America\/New_York/);
  assert.doesNotMatch(script, /getTimezoneOffset|(?:EST|EDT)\s*[+-]?\d/);
  assert.match(css, /@media\(max-width:600px\)[\s\S]*\.universe-nav/);
  assert.match(css, /\.universe-nav\{display:grid;grid-template-columns:repeat\(4,minmax\(0,1fr\)\)/);
  assert.match(css, /\.universe-nav a\{[^}]*min-height:44px/);
  assert.doesNotMatch(css, /\.universe-nav\{[^}]*overflow-x:auto/);
  assert.match(css, /\.enter-universe\{[\s\S]*text-transform:uppercase/);
});

class FakeElement {
  constructor(tag = 'div') {
    this.tagName = tag.toUpperCase();
    this.children = [];
    this.listeners = new Map();
    this.value = '';
    this.textContent = '';
    this.hidden = false;
    this.disabled = false;
  }
  append(...items) {
    for (const item of items) {
      this.children.push(item);
      if (this.tagName === 'SELECT' && item.tagName === 'OPTION' && !this.value) this.value = item.value;
    }
  }
  replaceChildren(...items) {
    this.children = [];
    if (this.tagName === 'SELECT') this.value = '';
    this.append(...items);
  }
  addEventListener(type, listener) {
    const existing = this.listeners.get(type) || [];
    existing.push(listener);
    this.listeners.set(type, existing);
  }
  async fire(type, extras = {}) {
    for (const listener of this.listeners.get(type) || [])
      await listener({ preventDefault() {}, ...extras });
  }
}
function find(node, tag) {
  if (node.tagName === tag) return node;
  for (const child of node.children) {
    const item = find(child, tag);
    if (item) return item;
  }
  return undefined;
}

test('member portal handles login, view, ranked picks, join requests, and entry approvals with no external transport', async () => {
  const script = await readFile(new URL('../console/play.mjs', import.meta.url), 'utf8');
  // Match unsafe operations, not explanatory comments mentioning storage.
  assert.doesNotMatch(script, /\b(?:localStorage|sessionStorage)\s*(?:\.|\[)|\.innerHTML\s*=|\beval\s*\(/);
  const ids = {};
  const document = {
    getElementById(id) { return ids[id] ||= new FakeElement(); },
    createElement(tag) { return new FakeElement(tag); }
  };
  const api = [];
  let expireOnce = true;
  const leagueId = '4a5fe0c7-e3ad-4834-9e5a-cd48a25c6b11';
  const roundId = '30338f61-b947-4a84-b9e8-e0a7c0523eb5';
  const gameId = 'cd2b563d-d6b7-41e0-8a63-e33cb2c56e7d';
  const details = {
    league: { id: leagueId, name: 'GOAT TEST LEAGUE', sport: 'NFL', season: '2027', status: 'open', owner_id: 'another-user' },
    rounds: [{ id: roundId, league_id: leagueId, name: 'Fixture Round', status: 'open', lock_at: '2099-01-01T00:00:00Z', weights: [7], weight_options: [[7]], mvp_bonus: 0 }],
    games: [{ id: gameId, round_id: roundId, home: 'Fixture Home', away: 'Fixture Away', home_spread: -3.5 }],
    entries: [],
    picks: []
  };
  const fetch = async (url, options) => {
    if (url === '/goat-games') {
      assert.equal(options.method, 'GET');
      return { ok: true, status: 200, json: async () => ({ games: GOAT_GAMES }) };
    }
    assert.match(url, /^\/(auth\/|query$|commands$)/);
    const payload = JSON.parse(options.body);
    api.push({ url, payload });
    let result;
    if (url === '/auth/login') result = { access_token: 'TEST_TOKEN', refresh_token: 'TEST_REFRESH' };
    else if (url === '/auth/refresh') result = { access_token: 'ROTATED_TOKEN', refresh_token: 'ROTATED_REFRESH' };
    else if (url === '/query' && payload.op === 'me' && expireOnce) {
      expireOnce = false;
      return { ok: false, status: 401, json: async () => ({ error: 'authentication_required' }) };
    }
    else if (url === '/query' && payload.op === 'me') result = {
      profile: { user_id: 'user-fixture', display_name: 'Fixture Member' },
      gpi: { verified: true, ranks: {
        global: { rank: 42, total: 1250, label: 'Global GPI' },
        block: { rank: 1, total: 18, label: 'Parkside Avenue' },
        county: { rank: 7, total: 320, label: 'Kings County' },
        state: { rank: 81, total: 6400, label: 'New York' },
        region: { rank: 109, total: 9800, label: 'Northeast' }
      } }
    };
    else if (url === '/query' && payload.op === 'leagues') result = [details.league];
    else if (url === '/query' && payload.op === 'league') result = details;
    else if (url === '/query' && payload.op === 'standings') result = [{ display_name: 'Fixture Member', points: 7, wins: 1 }];
    else if (url === '/commands') result = { ok: true };
    else throw new Error('Unexpected mock request: ' + url);
    return { ok: true, status: 200, json: async () => result };
  };
  runInNewContext(script, { document, fetch, console });
  assert.match(ids['gst-clock'].textContent, /(?:EST|EDT)$/);
  assert.match(ids['gst-clock'].dateTime, /^\d{4}-\d{2}-\d{2}T/);
  document.getElementById('email').value = 'fixture@example.invalid';
  document.getElementById('password').value = 'Fixture-Password-1234';
  await ids['account-form'].fire('submit', { submitter: { value: 'login' } });
  assert.equal(ids['goat-games-catalog'].children.length, 5);
  assert.equal(ids['goat-games-catalog'].children[2].children[1].textContent, 'GOAT Crossover');
  for (const card of ids['goat-games-catalog'].children)
    assert.ok(find(card, 'BUTTON'), 'Each of the five competition cards has an actionable journey');
  await find(ids['goat-games-catalog'].children[2], 'BUTTON').fire('click');
  assert.equal(ids['game-journey'].hidden, false);
  assert.equal(ids['game-journey-title'].textContent, 'GOAT Crossover');
  assert.match(ids['game-journey-status'].textContent, /Rules and scoring are pending approval/);
  assert.equal(ids['game-journey-member-link'].textContent, 'View my leagues');
  await find(ids['goat-games-catalog'].children[0], 'BUTTON').fire('click');
  assert.equal(ids['game-journey-title'].textContent, '1st & BAA');
  assert.match(ids['game-journey-status'].textContent, /No live competition/);
  await find(ids['goat-games-catalog'].children[3], 'BUTTON').fire('click');
  assert.equal(ids['game-journey-title'].textContent, 'League of Greatness');
  assert.match(ids['game-journey-status'].textContent, /Hosted play and automated scoring are not open/);
  assert.equal(ids['account-panel'].hidden, true);
  assert.equal(ids['member-panel'].hidden, false);
  assert.equal(ids['member-name'].textContent, 'Welcome, Fixture Member');
  assert.equal(ids['gpi-rankings'].children.length, 5);
  assert.equal(ids['gpi-rankings'].children[0].children[1].textContent, '#42');
  assert.equal(ids['gpi-rankings'].children[1].children[2].textContent, 'Parkside Avenue · of 18');
  assert.match(ids['gpi-status'].textContent, /authenticated, verified/);
  assert.equal(api.filter(x => x.url === '/auth/refresh').length, 1, 'Expired sessions refresh only once');
  assert.ok(api.some(x => x.url === '/query' && x.payload.op === 'me'), 'Profile retried after refresh');
  const open = find(ids.leagues.children[0], 'BUTTON');
  await open.fire('click');
  assert.equal(ids['league-panel'].hidden, false);
  assert.equal(ids['commissioner-panel'].hidden, true);
  const form = find(ids.rounds.children[0], 'FORM');
  assert.ok(form);
  await form.fire('submit');
  const pickCall = api.find(x => x.url === '/commands' && x.payload.op === 'picks_submit');
  assert.deepEqual(JSON.parse(JSON.stringify(pickCall.payload.picks)), [{ game_id: gameId, side: 'home', weight: 7 }]);
  assert.equal(ids.notice.className, 'notice success');

  await ids.back.fire('click');
  document.getElementById('invite-id').value = leagueId;
  await ids['join-form'].fire('submit');
  assert.ok(api.some(x => x.payload.op === 'enroll' && x.payload.league_id === leagueId));

  details.league.owner_id = 'user-fixture';
  details.entries = [{ user_id: 'pending-fixture-user', status: 'pending' }];
  await open.fire('click');
  assert.equal(ids['commissioner-panel'].hidden, false);
  const approve = find(ids['entry-requests'].children[0], 'BUTTON');
  await approve.fire('click');
  assert.ok(api.some(x => x.payload.op === 'entry_decide' && x.payload.user_id === 'pending-fixture-user' && x.payload.approved === true));
  assert.equal(api.some(x => /outreach\/send|billing\/checkout/.test(x.url)), false);
});
