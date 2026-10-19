import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';
import {client} from '../portal/forms.mjs';
import { GOAT_GAMES } from '../rules/goat-games.mjs';

class FakeElement {
  constructor(tag = 'div') {
    this.tagName = tag.toUpperCase();
    this.children = [];
    this.listeners = new Map();
    this.value = '';
    this.textContent = '';
    this.hidden = false;
    this.disabled = false;
    this.attrs = {};
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
  getAttribute(name) { return this.attrs[name]; }
  setAttribute(name,value) { this.attrs[name] = value; }
  querySelectorAll() { return []; }
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
  const script = (await readFile(new URL('../console/play.mjs', import.meta.url), 'utf8')).replace("import {client} from '/manage/forms.mjs';",'');
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
        block: { rank: 1, total: 18, label: 'Downtown block' },
        county: { rank: 7, total: 420, label: 'County standing' },
        state: { rank: 82, total: 2400, label: 'New York' }
      } }
    };
    else if (url === '/query' && payload.op === 'leagues') result = [details.league];
    else if (url === '/query' && payload.op === 'league') result = details;
    else if (url === '/query' && payload.op === 'standings') result = [{ display_name: 'Fixture Member', points: 7, wins: 1 }];
    else if (url === '/commands') result = { ok: true };
    else throw new Error('Unexpected mock request: ' + url);
    return { ok: true, status: 200, json: async () => result };
  };
  runInNewContext(script, { document, fetch, console, client });
  document.getElementById('email').value = 'fixture@example.invalid';
  document.getElementById('password').value = 'Fixture-Password-1234';
  await ids['account-form'].fire('submit', { submitter: { value: 'login' } });
  assert.equal(ids['goat-games-catalog'].children.length, 5);
  assert.equal(ids['goat-games-catalog'].children[2].children[1].textContent, 'GOAT Crossover');
  assert.equal(ids['account-panel'].hidden, true);
  assert.equal(ids['member-panel'].hidden, false);
  assert.equal(ids['member-name'].textContent, 'Welcome, Fixture Member');
  assert.equal(ids['gpi-rankings'].children.length, 5);
  assert.equal(ids['gpi-rankings'].children[0].children[1].textContent, '#1');
  assert.equal(ids['gpi-rankings'].children[2].children[1].textContent, '#82');
  assert.equal(ids['gpi-rankings'].children[3].children[1].textContent, '—');
  assert.match(ids['gpi-status'].textContent, /authenticated, verified/);
  assert.equal(api.filter(x => x.url === '/auth/refresh').length, 1, 'Expired sessions refresh only once');
  assert.ok(api.some(x => x.url === '/query' && x.payload.op === 'me'), 'Profile retried after refresh');

  const exploreFootball = find(ids['goat-games-catalog'].children[0], 'BUTTON');
  await exploreFootball.fire('click');
  assert.equal(ids['game-journey'].hidden, false);
  assert.equal(ids['game-journey-title'].textContent, '1st & BAA');
  assert.match(ids['game-journey-status'].textContent, /No live competition/);
  assert.equal(ids['game-journey-member-link'].textContent, 'View all my leagues');
  assert.equal(ids['game-journey-member-leagues'].children[0].textContent, 'Your 1st & BAA competitions');
  const contextualOpen = find(ids['game-journey-member-leagues'], 'BUTTON');
  assert.equal(contextualOpen.textContent, 'Open GOAT TEST LEAGUE');
  await contextualOpen.fire('click');
  assert.equal(ids['league-panel'].hidden, false);
  assert.ok(api.some(x => x.url === '/query' && x.payload.op === 'league' && x.payload.league_id === leagueId));

  await ids.back.fire('click');
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
