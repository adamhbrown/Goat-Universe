import {formatGST} from '../../experience/gst-time.js';
export const CEO_PROMPT = 'Team, give me the status of our five GOAT Games and the October 21 engineering deadline.';
const states = {
  unbound: ['Not connected', 'No authenticated account or integration is bound to this seat.'],
  disabled: ['Access disabled', 'Adam has disabled this seat.'],
  manual: ['Manual access', 'Signed-in posting is available. No automatic AI connection.'],
  api_waiting: ['API awaiting connection', 'An account is authorized; no successful API poll has been observed.'],
  connected: ['API client connected', 'An authenticated client polled within 90 seconds. Model execution is not verified.'],
  stale: ['API client offline', 'No authenticated API poll in the last 90 seconds.']
};
const human = value => String(value || '').replaceAll('_', ' ');
const time = value => value ? formatGST(value) : 'Not set';

export function mountBullpen(document, { fetchImpl = globalThis.fetch, schedule = globalThis.setTimeout, cancel = globalThis.clearTimeout } = {}) {
  const $ = id => document.getElementById(id);
  let token, refreshToken, refreshFlight, session = 0, timer, data, replyTo, acceptanceId;
  let busy = false, retryMessage, messageSignature = '', stopped = false, fieldId = 0;
  const messages = new Map();
  function el(tag, text, className) {
    const node = document.createElement(tag);
    if (text !== undefined) node.textContent = text;
    if (className) node.className = className;
    return node;
  }
  function button(text, action, className) {
    const node = el('button', text, className); node.type = 'button';
    node.addEventListener('click', () => perform(action, node)); return node;
  }
  function note(text = '', error = false) { if (stopped) return; $('notice').textContent = text; $('notice').className = error ? 'error' : ''; }
  function clearSession() {
    session++; token = refreshToken = undefined; cancel(timer); data = undefined;
    messages.clear(); replyTo = acceptanceId = retryMessage = undefined; messageSignature = '';
    for (const id of ['seats','messages','dashboard','task-list','intel-list','connection-list','binding','task-editor','acceptance']) $(id).replaceChildren();
    $('workspace').hidden = true; $('auth').hidden = false; $('logout').hidden = true;
    $('task-editor').hidden = true;
    $('login').elements.password.value = ''; $('compose').reset(); $('intel-form').reset();
    $('replying').hidden = $('cancel-reply').hidden = $('acceptance').hidden = true;
  }
  async function raw(path, body, authToken) {
    const response = await fetchImpl(path, { method:'POST', headers:{ 'Content-Type':'application/json', ...(authToken ? {Authorization:`Bearer ${authToken}`} : {}) }, body:JSON.stringify(body), cache:'no-store', signal:AbortSignal.timeout(15000) });
    const result = await response.json(); return { response, result };
  }
  async function request(path, body, retried = false) {
    const generation = session;
    const { response, result } = await raw(path, body, token);
    if (generation !== session || stopped) throw new Error('session_changed');
    if (response.status === 401 && refreshToken && !retried) {
      refreshFlight ||= raw('/auth/refresh', { refresh_token:refreshToken }).finally(() => { refreshFlight = undefined; });
      const renewed = await refreshFlight;
      if (generation !== session) throw new Error('session_changed');
      if (renewed.response.ok && renewed.result.access_token) {
        token = renewed.result.access_token; refreshToken = renewed.result.refresh_token;
        return request(path, body, true);
      }
    }
    if (!response.ok) {
      if (response.status === 401 || result.error === 'bullpen_membership_required') clearSession();
      throw new Error(result.error || 'request_failed');
    }
    return result;
  }
  async function perform(action, node) {
    if (node) node.disabled = true;
    try { await action(); }
    catch (error) {
      if (error.message !== 'session_changed') note(error.message === 'task_version_conflict' || error.message === 'seat_version_conflict'
        ? 'This record changed. Open it again to use the latest version.'
        : error.message === 'request_failed' ? 'Request failed. Your entry has been kept for retry.' : human(error.message), true);
    } finally { if (node) node.disabled = false; }
  }
  function bindForm(form, handler) {
    let pending = false;
    form.addEventListener('submit', event => {
      event.preventDefault();
      if (pending) return;
      pending = true;
      perform(async () => { try { await handler(Object.fromEntries(new document.defaultView.FormData(form))); } finally { pending = false; } }, form.querySelector('[type=submit]'));
    });
  }
  function pill(text, warning = false) { return el('span', human(text), `badge${warning ? ' warn' : ''}`); }
  function metadata(label, text, parent) { parent.append(el('p', `${label}: ${text || 'Not recorded'}`, 'meta')); }
  function field(form, name, label, type = 'text', value = '', options) {
    const wrapper = el('div', undefined, 'field');
    const caption = el('label',label);
    const input = options ? el('select') : type === 'textarea' ? el('textarea') : el('input');
    input.id = `bullpen-field-${++fieldId}`; caption.htmlFor = input.id;
    input.name = name;
    if (input.tagName === 'INPUT') input.type = type;
    if (options) for (const [key, title] of options) { const option = el('option', title); option.value = key; input.append(option); }
    input.value = value ?? ''; wrapper.append(caption,input); form.append(wrapper); return input;
  }
  function show(view) {
    for (const node of document.querySelectorAll('.view')) node.hidden = node.id !== view;
    for (const node of document.querySelectorAll('[data-view]')) node.setAttribute('aria-pressed', String(node.dataset.view === view));
    if (view === 'connections') renderBinding();
  }
  function renderSeats() {
    $('seats').replaceChildren(); $('connection-list').replaceChildren();
    for (const seat of data.seats) {
      const [label, description] = states[seat.status];
      const card = el('article', undefined, 'seat-card');
      card.append(el('h3', seat.name), el('p', seat.role, 'role'), pill(seat.id === 'adam' && data.me === 'adam' ? 'You · signed in' : label, seat.status !== 'connected'));
      const work = data.tasks.filter(task => task.owner === seat.id && !['done','canceled'].includes(task.status));
      card.append(el('p', `${work.length} active · ${work.filter(task => task.status === 'blocked').length} blocked`, 'meta'));
      $('seats').append(card);
      const row = el('article', undefined, 'message');
      row.append(el('h3', seat.name), pill(label, seat.status !== 'connected'), el('p', description));
      metadata('Last authenticated API poll', time(seat.last_api_poll_at), row);
      $('connection-list').append(row);
    }
  }
  function renderMessages() {
    const list = [...messages.values()].sort((a,b) => Number(a.id) - Number(b.id));
    const signature = list.map(message => message.id).join(',');
    if (signature === messageSignature) return;
    const nearEnd = $('messages').scrollHeight - $('messages').scrollTop - $('messages').clientHeight < 80;
    messageSignature = signature; $('messages').replaceChildren();
    if (!list.length) $('messages').append(el('p', 'The room is ready. Post the first team message.', 'muted'));
    for (const message of list) {
      const seat = data.seats.find(item => item.id === message.seat);
      const article = el('article', undefined, 'message'); article.dataset.messageId = message.id;
      const header = el('div', undefined, 'message-head');
      const stamp = el('time', time(message.created_at)); stamp.dateTime = message.created_at;
      header.append(el('strong', seat.name), stamp); article.append(header, el('p', `${seat.role} · ${message.source === 'api' ? 'Authenticated API post' : 'Manual post'}`, 'meta'));
      if (message.reply_to) article.append(el('p', `Reply to message #${message.reply_to}`, 'meta'));
      article.append(el('p', message.content, 'body'));
      if (message.mentions.length) article.append(el('p', 'Mentioned: ' + message.mentions.map(id => '@' + data.seats.find(s => s.id === id).name).join(', '), 'meta'));
      article.append(button('Reply', () => {
        replyTo = message.id; $('replying').textContent = `Replying to ${seat.name} · #${message.id}`;
        $('replying').hidden = $('cancel-reply').hidden = false; $('compose').elements.content.focus();
      }));
      if (message.content === CEO_PROMPT && message.seat === 'adam') article.append(button('Check acceptance evidence', async () => { acceptanceId = message.id; await renderAcceptance(); }));
      $('messages').append(article);
    }
    if (nearEnd) $('messages').scrollTop = $('messages').scrollHeight;
  }
  function taskCard(task, compact = false) {
    const card = el('article', undefined, 'card'); card.append(el('h3', task.title), pill(task.status, ['blocked','awaiting_approval'].includes(task.status)));
    metadata('Owner', data.seats.find(seat => seat.id === task.owner).name, card);
    metadata('Priority / deadline', `${human(task.priority)} · ${time(task.deadline)}`, card);
    metadata('Work key', task.work_key, card);
    if (task.blocker) metadata('Blocker', task.blocker, card);
    if (task.branch) metadata('Branch', task.branch, card);
    if (task.pr_url) { const link = el('a', 'GitHub pull request ↗'); link.href = task.pr_url; link.target = '_blank'; link.rel = 'noopener noreferrer'; card.append(link); }
    if (task.evidence) metadata('Completion evidence', task.evidence, card);
    if (task.approval_kind !== 'none') metadata('CEO approval', `${human(task.approval_kind)} · ${task.approval_state}`, card);
    if (!compact && !['done','canceled'].includes(task.status) && ['adam','tiffany',task.owner].includes(data.me)) card.append(button('Update assignment', () => editTask(task)));
    if (data.me === 'adam' && task.approval_state === 'pending') card.append(decisionForm('task_decide', task));
    return card;
  }
  function decisionForm(op, item) {
    const form = el('form');
    const reason = field(form, 'reason', 'CEO decision reason', 'textarea'); reason.required = true; reason.maxLength = 2000;
    field(form, 'approved', 'Decision', 'text', 'false', [['false','Reject'],['true','Approve']]);
    const save = el('button', 'Record CEO decision'); save.type = 'submit'; form.append(save);
    bindForm(form, async values => { await command({ op, id:item.id, version:item.version, reason:values.reason, approved:values.approved === 'true' }); note('CEO decision recorded.'); });
    return form;
  }
  function renderTasks() {
    const filter = $('task-filter').value;
    const tasks = data.tasks.filter(task => filter === 'all' || (filter === 'active' && !['done','canceled'].includes(task.status)) || (filter === 'approval' && task.approval_state === 'pending') || task.status === filter);
    $('task-list').replaceChildren(...tasks.map(task => taskCard(task)));
    if (!tasks.length) $('task-list').append(el('p', 'No assignments in this view.', 'muted'));
  }
  function renderDashboard() {
    const root = $('dashboard'); root.replaceChildren();
    const stats = el('div', undefined, 'stat-grid');
    for (const [title, count] of [['In progress', data.tasks.filter(t => t.status === 'in_progress').length],['Completed',data.tasks.filter(t => t.status === 'done').length],['Blocked',data.tasks.filter(t => t.status === 'blocked').length],['CEO decisions',data.tasks.filter(t => t.approval_state === 'pending').length + data.intelligence.filter(i => i.state === 'proposed').length]]) {
      const stat = el('div', undefined, 'stat'); stat.append(el('strong', count),el('span',title)); stats.append(stat);
    }
    root.append(stats);
    for (const seat of data.seats.filter(s => s.id !== 'adam')) {
      root.append(el('h2', `${seat.name} · current work`));
      const grid = el('div', undefined, 'card-grid');
      const active = data.tasks.filter(t => t.owner === seat.id && !['done','canceled'].includes(t.status));
      grid.append(...active.map(t => taskCard(t, true)));
      if (!active.length) grid.append(el('p', 'No current assignment recorded. Activity in separate chats is unknown.', 'muted'));
      root.append(grid);
    }
    root.append(el('h2','Completed work'));
    const completed = el('div',undefined,'card-grid'); completed.append(...data.tasks.filter(t => t.status === 'done').map(t => taskCard(t,true)));
    if (!completed.childElementCount) completed.append(el('p','No completion evidence recorded yet.','muted'));
    root.append(completed);
  }
  function renderIntel() {
    $('intel-list').replaceChildren();
    for (const record of data.intelligence) {
      const card = el('article', undefined, 'card');
      card.append(el('h3', `${human(record.kind)} · ${record.topic}`),pill(record.state,record.state === 'proposed'),el('p',record.content));
      metadata('Evidence',record.evidence,card);
      metadata('Recorded by',`${data.seats.find(s => s.id === record.seat).name} · ${time(record.created_at)}`,card);
      if (data.me === 'adam' && record.state === 'proposed') card.append(decisionForm('intelligence_decide',record));
      $('intel-list').append(card);
    }
    if (!data.intelligence.length) $('intel-list').append(el('p','No project records yet. Add sourced findings and proposed decisions.','muted'));
  }
  async function renderAcceptance() {
    const report = await request('/bullpen/query',{op:'acceptance',message_id:acceptanceId});
    const root = $('acceptance'); root.hidden = false; root.replaceChildren(el('h3',`Acceptance evidence · message #${report.message_id}`));
    for (const seat of report.seats) root.append(el('p', `${seat.name}: ${seat.received_at ? `API read recorded ${time(seat.received_at)}` : 'No API read receipt'}. ${seat.reply_id ? `Authenticated API reply #${seat.reply_id} recorded.` : 'No linked API reply. A functioning authorized connection and workstream response are still required.'}`));
    root.append(el('p', report.seats.every(s => s.received_at && s.reply_id) ? 'Transport exchange recorded for all three seats. Review the replies for the required project, security, and engine status.' : 'Cross-agent acceptance is incomplete.', 'muted'));
  }
  async function refresh() {
    if (!token || busy || stopped) return;
    busy = true;
    try {
      data = await request('/bullpen/query',{op:'snapshot'});
      for (const message of data.messages) messages.set(String(message.id),message);
      $('workspace').hidden = false; $('auth').hidden = true; $('logout').hidden = false;
      renderSeats(); renderMessages(); renderTasks(); renderDashboard(); renderIntel();
      $('sync').textContent = `${data.database === 'local' ? 'Local prototype' : human(data.environment)} · signed in as ${data.seats.find(s => s.id === data.me).name} · synced ${time(data.server_time)}`;
      if (acceptanceId) await renderAcceptance();
    } finally { busy = false; }
  }
  async function poll() {
    if (!token || stopped) return;
    await perform(refresh);
    if (token && !stopped) timer = schedule(poll,10000);
  }
  async function command(body) {
    const result = await request('/bullpen/commands',body); await refresh(); return result;
  }
  function editTask(task) {
    show('tasks'); const root = $('task-editor'); root.hidden = false; root.replaceChildren(el('h3', task ? 'Update assignment' : 'New assignment'));
    const form = el('form'); const coordinator = ['adam','tiffany'].includes(data.me);
    if (!task || coordinator) {
      const title = field(form,'title','Task','text',task?.title); title.required = true; title.maxLength = 200;
      const key = field(form,'work_key','Canonical work key','text',task?.work_key); key.required = true; key.pattern = '[a-z0-9][a-z0-9_/-]{2,119}'; key.maxLength = 120;
      field(form,'owner','Responsible workstream','text',task?.owner || data.me,(coordinator ? data.seats : data.seats.filter(s => s.id === data.me)).map(s => [s.id,s.name]));
      field(form,'priority','Priority','text',task?.priority || 'normal',['urgent','high','normal','low'].map(v => [v,human(v)]));
      const date = task?.deadline ? new Date(Date.parse(task.deadline)-new Date(task.deadline).getTimezoneOffset()*60000).toISOString().slice(0,16) : '';
      field(form,'deadline',`Deadline (${Intl.DateTimeFormat().resolvedOptions().timeZone})`,'datetime-local',date);
      field(form,'branch','GitHub branch','text',task?.branch).maxLength = 200;
      field(form,'pr_url','GOAT Universe pull request URL','url',task?.pr_url);
      if (!task || data.me === 'adam') field(form,'approval_kind','Requires CEO approval','text',task?.approval_kind || 'none',['none','purchase','migration','destructive','production_deployment','major_change'].map(v => [v,human(v)]));
    }
    if (task) {
      field(form,'status','Status','text',task.status,['todo','in_progress','blocked','awaiting_approval','done','canceled'].map(v => [v,human(v)]));
      field(form,'blocker','Blockers','textarea',task.blocker).maxLength = 2000;
      field(form,'evidence','Completion evidence','textarea',task.evidence).maxLength = 4000;
    }
    const save = el('button','Save assignment','primary'); save.type = 'submit'; form.append(save,button('Cancel',() => { root.hidden = true; root.replaceChildren(); }));
    bindForm(form,async values => {
      if (Object.hasOwn(values,'deadline')) values.deadline = values.deadline ? new Date(values.deadline).toISOString() : null;
      await command({ ...values, op:task ? 'task_update' : 'task_create', ...(task ? {id:task.id,version:task.version} : {}) });
      root.hidden = true; root.replaceChildren(); note('Assignment saved.');
    });
    root.append(form);
  }
  function renderBinding() {
    const root = $('binding'); root.hidden = data.me !== 'adam'; root.replaceChildren(); if (data.me !== 'adam') return;
    root.append(el('h3','Adam · authorize an agent seat'),el('p','Bind a dedicated, verified account UUID. API mode authorizes polling; it does not start an AI worker. Disabling access takes effect on the next request.'));
    const form = el('form'); const selector = field(form,'seat','Seat','text','tiffany',data.seats.filter(s => s.id !== 'adam').map(s => [s.id,s.name]));
    const id = field(form,'user_id','Authenticated account UUID'); id.pattern = '[0-9a-fA-F-]{36}';
    const kind = field(form,'connection_kind','Connection','text','manual',[['manual','Manual account'],['api','Authorized API client']]);
    const enabled = field(form,'enabled','Access','text','false',[['false','Disabled'],['true','Enabled']]);
    function select() { const seat = data.seats.find(s => s.id === selector.value); id.value = seat.user_id || ''; kind.value = seat.connection_kind; enabled.value = String(seat.enabled); }
    selector.addEventListener('change',select); select();
    const save = el('button','Save account binding'); save.type = 'submit'; form.append(save);
    bindForm(form,async values => { await command({...values,op:'seat_bind',user_id:values.user_id || null,enabled:values.enabled === 'true',version:data.seats.find(s => s.id === values.seat).version}); renderBinding(); note('Seat binding saved.'); });
    root.append(form);
  }
  bindForm($('login'),async values => {
    clearSession();
    const generation = session;
    try {
      const login = await raw('/auth/login',values);
      if (generation !== session || stopped) return;
      if (!login.response.ok) throw new Error('sign_in_failed');
      token = login.result.access_token; refreshToken = login.result.refresh_token;
      await refresh(); note('Welcome to the Bullpen.'); cancel(timer); timer = schedule(poll,10000);
    } finally { $('login').elements.password.value = ''; }
  });
  bindForm($('compose'),async values => {
    if (!retryMessage || retryMessage.content !== values.content || retryMessage.reply_to !== replyTo) retryMessage = {op:'message_post',content:values.content,reply_to:replyTo,client_id:globalThis.crypto.randomUUID(),source:'manual'};
    await command(retryMessage); retryMessage = undefined; $('compose').reset(); replyTo = undefined;
    $('replying').hidden = $('cancel-reply').hidden = true; note('Message recorded in GOAT Universe Bullpen.');
  });
  bindForm($('intel-form'),async values => { await command({...values,op:'intelligence_add'}); $('intel-form').reset(); note('Project record saved.'); });
  $('logout').addEventListener('click',() => {
    const previous = token, pendingRefresh = refreshFlight; clearSession(); note('Signed out.');
    if (previous) perform(async () => {
      const rotated = pendingRefresh ? await pendingRefresh.catch(() => null) : null;
      const result = await raw('/auth/logout',{},rotated?.response.ok ? rotated.result.access_token : previous);
      if (!result.response.ok) throw new Error('server_sign_out_unconfirmed');
    });
  });
  $('cancel-reply').addEventListener('click',() => { replyTo = undefined; $('replying').hidden = $('cancel-reply').hidden = true; });
  $('acceptance-prompt').addEventListener('click',() => { $('compose').elements.content.value = CEO_PROMPT; $('compose').elements.content.focus(); });
  for (const node of document.querySelectorAll('[data-view]')) node.addEventListener('click',() => show(node.dataset.view));
  for (const node of document.querySelectorAll('[data-mention]')) node.addEventListener('click',() => { $('compose').elements.content.value += ` @${node.dataset.mention} `; $('compose').elements.content.focus(); });
  $('task-filter').addEventListener('change',renderTasks);
  $('new-task').addEventListener('click',() => editTask());
  $('older').addEventListener('click',() => perform(async () => {
    const first = [...messages.values()].sort((a,b) => Number(a.id)-Number(b.id))[0];
    if (!first) return;
    const history = await request('/bullpen/query',{op:'history',before:first.id});
    for (const message of history.messages) messages.set(String(message.id),message);
    renderMessages(); if (!history.messages.length) note('You have reached the start of the conversation.');
  },$('older')));
  document.defaultView.addEventListener('pagehide',clearSession);
  return { refresh, destroy() { stopped = true; document.defaultView.removeEventListener('pagehide',clearSession); clearSession(); } };
}

if (typeof document !== 'undefined') mountBullpen(document);
