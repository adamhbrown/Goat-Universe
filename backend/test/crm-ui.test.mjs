import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';

class FakeElement {
  constructor(tag = 'div') {
    this.tagName = tag.toUpperCase();
    this.children = []; this.listeners = new Map();
    this.textContent = ''; this.value = ''; this.hidden = false; this.disabled = false; this.style = {};
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
    const callbacks = this.listeners.get(type) || [];
    callbacks.push(listener); this.listeners.set(type, callbacks);
  }
  async fire(type) {
    for (const fn of this.listeners.get(type) || []) await fn({ preventDefault() {} });
  }
  reset() {}
}
function find(node, condition) {
  if (condition(node)) return node;
  for (const child of node.children) {
    const item = find(child, condition);
    if (item) return item;
  }
}

test('commercial HQ loads authorized records, prepares drafts, and requires internal approval without sending', async () => {
  const script = await readFile(new URL('../console/crm.mjs', import.meta.url), 'utf8');
  assert.doesNotMatch(script, /\/outreach\/send|\/billing\/checkout/);
  const ids = {};
  const document = {
    getElementById(id) { return ids[id] ||= new FakeElement(); },
    createElement(tag) { return new FakeElement(tag); }
  };
  const calls = [];
  const prospect = { id: 'PROSPECT_FIXTURE', organization: 'Fixture Brand', score: 72, category: 'partner', evidence: 'Source reviewed', permission: 'unverified', interest: 'unknown' };
  const draft = { id: 'DRAFT_FIXTURE', prospect_id: prospect.id, status: 'pending', subject: 'Intro', body: 'Internal draft only.' };
  const records = { prospects: [prospect], drafts: [draft], opportunities: [], research_jobs: [] };
  const fetch = async (path, options) => {
    assert.ok(path.startsWith('/'), 'No external fetch target');
    const payload = JSON.parse(options.body);
    calls.push({ path, payload });
    let value;
    if (path === '/auth/login') value = { access_token: 'STAFF_TOKEN', refresh_token: 'STAFF_REFRESH' };
    else if (path === '/query' && payload.op === 'me') value = { profile: { display_name: 'Fixture Analyst' }, roles: ['researcher','approver'] };
    else if (path === '/query' && payload.op === 'crm_report') value = { prospects: 1, interested: 0, awaiting_approval: 1, follow_ups: [], pipeline_by_currency: [] };
    else if (path === '/query' && payload.op === 'crm_records') value = records;
    else if (path === '/outreach/prepare') value = { id: 'NEW_DRAFT_FIXTURE' };
    else if (path === '/commands') value = { id: 'COMMAND_FIXTURE' };
    else throw new Error('Unexpected API path ' + path);
    return { status: 200, ok: true, json: async () => value };
  };
  runInNewContext(script, { document, fetch, console });
  document.getElementById('crm-email').value = 'fixture@example.invalid';
  document.getElementById('crm-password').value = 'Fixture-Password-1234';
  await ids['crm-login'].fire('submit');
  assert.equal(ids['crm-account'].hidden, true);
  assert.equal(ids['crm-desk'].hidden, false);
  assert.match(ids['crm-user'].textContent, /Fixture Analyst/);
  assert.equal(ids['crm-prospects'].children.length, 1);
  assert.equal(ids['crm-drafts'].children.length, 1);

  const draftApprove = find(ids['crm-drafts'], x => x.tagName === 'BUTTON' && x.textContent === 'Approve internally');
  assert.ok(draftApprove, 'Approver controls are present for authorized staff');
  await draftApprove.fire('click');
  assert.ok(calls.some(x => x.path === '/commands' && x.payload.op === 'crm_decide' && x.payload.approved === true));

  const prepare = find(ids['crm-prospects'], x => x.tagName === 'BUTTON');
  await prepare.fire('click');
  assert.ok(calls.some(x => x.path === '/outreach/prepare' && x.payload.prospect_id === prospect.id));

  for (const [id, value] of Object.entries({
    'cp-organization':'Fixture Second Brand', 'cp-website':'https://fixture.invalid',
    'cp-source':'https://fixture.invalid/about', 'cp-evidence':'Company description in source'
  })) document.getElementById(id).value = value;
  await ids['new-prospect'].fire('submit');
  assert.ok(calls.some(x => x.path === '/commands' && x.payload.op === 'crm_prospect' && x.payload.signals.length === 5));
  for (const [id,value] of Object.entries({
    'co-prospect': prospect.id, 'co-amount':'1000', 'co-currency':'USD',
    'co-probability':'50', 'co-stage':'proposal', 'co-source':'https://fixture.invalid/proposal'
  })) document.getElementById(id).value = value;
  await ids['new-opportunity'].fire('submit');
  assert.ok(calls.some(x => x.path === '/commands' && x.payload.op === 'crm_opportunity' && x.payload.probability === .5));
  assert.equal(calls.some(x => /outreach\/send|billing\/checkout/.test(x.path)), false);
});
