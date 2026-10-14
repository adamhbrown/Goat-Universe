import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';

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
  assert.doesNotMatch(script, /localStorage|sessionStorage|innerHTML|eval\s*\(/);
  const ids = {};
  const document = {
    getElementById(id) { return ids[id] ||= new FakeElement(); },
    createElement(tag) { return new FakeElement(tag); }
  };
  const api = [];
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
    assert.match(url, /^\/(auth\/|query$|commands$)/);
    const payload = JSON.parse(options.body);
    api.push({ url, payload });
    let result;
    if (url === '/auth/login') result = { access_token: 'TEST_TOKEN', refresh_token: 'TEST_REFRESH' };
    else if (url === '/query' && payload.op === 'me') result = { profile: { user_id: 'user-fixture', display_name: 'Fixture Member' } };
    else if (url === '/query' && payload.op === 'leagues') result = [details.league];
    else if (url === '/query' && payload.op === 'league') result = details;
    else if (url === '/query' && payload.op === 'standings') result = [{ display_name: 'Fixture Member', points: 7, wins: 1 }];
    else if (url === '/commands') result = { ok: true };
    else throw new Error('Unexpected mock request: ' + url);
    return { ok: true, status: 200, json: async () => result };
  };
  runInNewContext(script, { document, fetch, console });
  ids.email.value = 'fixture@example.invalid';
  ids.password.value = 'Fixture-Password-1234';
  await ids['account-form'].fire('submit', { submitter: { value: 'login' } });
  assert.equal(ids['account-panel'].hidden, true);
  assert.equal(ids['member-panel'].hidden, false);
  assert.equal(ids['member-name'].textContent, 'Welcome, Fixture Member');
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
  ids['invite-id'].value = leagueId;
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
