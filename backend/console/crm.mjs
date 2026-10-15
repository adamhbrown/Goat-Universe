// GOAT Universe commercial desk: internal records and approvals only. No outbound messaging.
let token = '';
let refreshToken = '';
let roleSet = [];
let records = { prospects: [], drafts: [], opportunities: [] };
const el = id => document.getElementById(id);
const node = (tag, content, className) => {
  const element = document.createElement(tag);
  if (content !== undefined && content !== null) element.textContent = String(content);
  if (className) element.className = className;
  return element;
};
const signals = ['audience_fit','commercial_fit','decision_access','timing','engagement'];
function notice(value, kind = '') {
  el('crm-notice').textContent = value;
  el('crm-notice').className = 'notice ' + kind;
}
function signOutView() {
  token = ''; refreshToken = ''; roleSet = [];
  records = { prospects: [], drafts: [], opportunities: [] };
  el('crm-account').hidden = false; el('crm-desk').hidden = true;
}
async function send(path, data, authenticated = true, retry = true) {
  const response = await fetch('/' + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(authenticated && token ? { Authorization: 'Bearer ' + token } : {}) },
    body: JSON.stringify(data)
  });
  if (response.status === 401 && authenticated && retry && refreshToken) {
    try {
      const session = await send('auth/refresh', { refresh_token: refreshToken }, false, false);
      token = session.access_token; refreshToken = session.refresh_token;
      return await send(path, data, true, false);
    } catch {
      signOutView(); throw new Error('session_expired_please_sign_in');
    }
  }
  const value = await response.json();
  if (!response.ok) throw new Error(value.error || 'request_failed');
  return value;
}
async function query(op) { return send('query', { op }); }
async function command(op, extra) { return send('commands', { op, ...extra }); }
function cell(title, value) {
  const box = node('div', null, 'stat');
  box.append(node('strong', value), node('span', title));
  return box;
}
function canApprove() { return roleSet.includes('approver') || roleSet.includes('executive'); }
function renderReport(report) {
  const area = el('crm-report');
  area.replaceChildren();
  area.append(cell('Researched prospects', report.prospects || 0),
    cell('Documented interest', report.interested || 0),
    cell('Drafts awaiting approval', report.awaiting_approval || 0),
    cell('Follow-ups due', report.follow_ups?.length || 0));
  for (const item of report.pipeline_by_currency || []) {
    const active = Number(item.weighted_pipeline || 0).toLocaleString(undefined, { maximumFractionDigits: 2 });
    const closed = Number(item.contracted_revenue || 0).toLocaleString(undefined, { maximumFractionDigits: 2 });
    area.append(cell(item.currency + ' weighted pipeline', active), cell(item.currency + ' contracted, not collected', closed));
  }
}
function renderProspects() {
  const area = el('crm-prospects');
  area.replaceChildren();
  if (!records.prospects.length) area.append(node('p', 'No sourced prospects have been recorded.', 'small'));
  for (const prospect of records.prospects) {
    const card = node('article', null, 'card');
    card.append(node('h4', prospect.organization),
      node('p', prospect.category + ' · relevance ' + prospect.score + '/100', 'meta'),
      node('p', 'Interest: ' + prospect.interest + ' · permission: ' + prospect.permission, 'meta'),
      node('p', prospect.evidence, 'small'));
    const action = node('button', 'Prepare internal outreach draft', 'secondary');
    action.type = 'button'; action.disabled = prospect.permission === 'do_not_contact';
    action.addEventListener('click', async () => {
      action.disabled = true;
      try {
        await send('outreach/prepare', { prospect_id: prospect.id });
        await load();
        notice('An internal draft was saved for approval. No message was sent.', 'success');
      } catch (error) { notice(error.message, 'error'); action.disabled = false; }
    });
    card.append(action); area.append(card);
  }
}
function renderDrafts() {
  const area = el('crm-drafts');
  area.replaceChildren();
  const pending = records.drafts.filter(d => d.status === 'pending');
  if (!pending.length) area.append(node('p', 'No drafts are waiting for review.', 'small'));
  for (const draft of pending) {
    const prospect = records.prospects.find(p => p.id === draft.prospect_id);
    const card = node('article', null, 'card');
    card.append(node('h4', prospect?.organization || 'Unknown prospect'), node('p', draft.subject, 'meta'));
    const preview = node('details');
    preview.append(node('summary', 'Read draft'));
    const content = node('pre', draft.body);
    content.style.whiteSpace = 'pre-wrap';
    content.style.overflowWrap = 'anywhere';
    preview.append(content);
    card.append(preview);
    if (canApprove()) for (const approved of [true,false]) {
      const control = node('button', approved ? 'Approve internally' : 'Reject draft', approved ? '' : 'secondary');
      control.type = 'button';
      control.addEventListener('click', async () => {
        control.disabled = true;
        try {
          await command('crm_decide', { draft_id: draft.id, approved, reason: 'Reviewed by authorized commercial staff.' });
          await load();
          notice(approved ? 'Draft approved for internal use. Nothing was sent.' : 'Draft rejected.', 'success');
        } catch (error) { notice(error.message, 'error'); control.disabled = false; }
      });
      card.append(control);
    }
    area.append(card);
  }
}
function renderOpportunities() {
  const area = el('crm-opportunities');
  area.replaceChildren();
  if (!records.opportunities.length) area.append(node('p', 'No pipeline opportunities recorded.', 'small'));
  for (const opportunity of records.opportunities) {
    const prospect = records.prospects.find(p => p.id === opportunity.prospect_id);
    const card = node('article', null, 'card');
    card.append(node('h4', prospect?.organization || 'Unknown prospect'),
      node('p', opportunity.stage + ' · ' + opportunity.currency + ' ' + Number(opportunity.amount).toLocaleString(), 'meta'),
      node('p', 'Probability: ' + Math.round(Number(opportunity.probability) * 100) + '%', 'small'));
    area.append(card);
  }
  const select = el('co-prospect');
  const previous = select.value;
  select.replaceChildren();
  const placeholder = node('option', records.prospects.length ? 'Select a prospect' : 'Add a prospect first');
  placeholder.value = ''; select.append(placeholder);
  for (const prospect of records.prospects) {
    const option = node('option', prospect.organization);
    option.value = prospect.id; select.append(option);
  }
  select.value = records.prospects.some(p => p.id === previous) ? previous : '';
}
async function load() {
  const [report, nextRecords] = await Promise.all([query('crm_report'), query('crm_records')]);
  records = nextRecords;
  renderReport(report); renderProspects(); renderDrafts(); renderOpportunities();
}
for (const name of signals) {
  const group = node('div', null, 'signal');
  const valueLabel = node('label', name.replaceAll('_',' ') + ' · 0–5');
  const select = node('select'); select.id = 'signal-' + name;
  for (let n=0;n<=5;n++) { const option = node('option', n); option.value = String(n); select.append(option); }
  valueLabel.append(select);
  const evidenceLabel = node('label', 'Supporting evidence');
  const evidence = node('input'); evidence.id = 'evidence-' + name; evidence.maxLength = 2000;
  evidenceLabel.append(evidence); group.append(valueLabel, evidenceLabel); el('crm-signals').append(group);
}
el('crm-login').addEventListener('submit', async event => {
  event.preventDefault();
  try {
    const credentials = await send('auth/login', { email: el('crm-email').value, password: el('crm-password').value }, false);
    token = credentials.access_token; refreshToken = credentials.refresh_token;
    el('crm-password').value = '';
    const me = await query('me');
    roleSet = me.roles || [];
    if (!roleSet.some(x => ['researcher','approver','executive'].includes(x))) {
      signOutView(); throw new Error('commercial_role_required');
    }
    el('crm-user').textContent = me.profile.display_name + ' · ' + roleSet.join(', ');
    await load();
    el('crm-account').hidden = true; el('crm-desk').hidden = false;
    notice('Commercial records loaded. No external communication is enabled.', 'success');
  } catch (error) { el('crm-password').value = ''; notice(error.message, 'error'); }
});
el('crm-refresh').addEventListener('click', async () => {
  try { await load(); notice('Pipeline refreshed.', 'success'); } catch (error) { notice(error.message, 'error'); }
});
el('crm-signout').addEventListener('click', async () => {
  try { if (token) await send('auth/logout', {}); } catch {}
  signOutView(); notice('Signed out of commercial HQ.');
});
el('new-prospect').addEventListener('submit', async event => {
  event.preventDefault();
  const scored = signals.map(name => ({
    name,
    value: Number(el('signal-' + name).value),
    evidence: el('evidence-' + name).value.trim()
  }));
  if (scored.some(s => s.value > 0 && !s.evidence)) {
    notice('Each positive commercial signal needs supporting evidence.', 'error'); return;
  }
  try {
    await command('crm_prospect', {
      organization: el('cp-organization').value.trim(),
      website: el('cp-website').value.trim(),
      category: el('cp-category').value,
      source_url: el('cp-source').value.trim(),
      evidence: el('cp-evidence').value.trim(),
      signals: scored
    });
    el('new-prospect').reset();
    await load();
    notice('Sourced prospect saved. No outreach occurred.', 'success');
  } catch (error) { notice(error.message, 'error'); }
});
el('new-opportunity').addEventListener('submit', async event => {
  event.preventDefault();
  if (!el('co-prospect').value) { notice('Select an existing prospect.', 'error'); return; }
  try {
    await command('crm_opportunity', {
      prospect_id: el('co-prospect').value,
      amount: Number(el('co-amount').value),
      currency: el('co-currency').value.trim().toUpperCase(),
      probability: Number(el('co-probability').value) / 100,
      stage: el('co-stage').value,
      evidence_url: el('co-source').value.trim()
    });
    el('new-opportunity').reset();
    await load();
    notice('Pipeline record saved. Revenue is not considered collected.', 'success');
  } catch (error) { notice(error.message, 'error'); }
});
signOutView();
