// GOAT Games participant portal. No tokens in localStorage or analytics by default.
import {client} from '/manage/forms.mjs';
const api = client(fetch, {onSessionEnd(reason) {
  showSignedOut();
  if(reason !== 'signed_out') notice('Your session ended. Sign in again to continue.', 'error');
}});
if(typeof window !== 'undefined')window.addEventListener('pagehide',()=>api.forget());
let myUserId = '';
let activeLeagueId = '';
const el = id => document.getElementById(id);
const node = (tag, text, className) => {
  const item = document.createElement(tag);
  if (text !== undefined && text !== null) item.textContent = String(text);
  if (className) item.className = className;
  return item;
};
function notice(message, type = '') {
  el('notice').textContent = message;
  el('notice').className = 'notice ' + type;
}
async function send(path, payload, authenticated = true) {
  return api.request('/' + path, payload, authenticated);
}
async function loadGoatGamesCatalog() {
  const list = el('goat-games-catalog');
  try {
    const response = await fetch('/goat-games', { method: 'GET' });
    if (!response.ok) throw new Error('catalog_unavailable');
    const catalog = await response.json();
    if (!Array.isArray(catalog.games) || catalog.games.length !== 5) throw new Error('catalog_incomplete');
    list.replaceChildren();
    const months = ['','JANUARY','FEBRUARY','MARCH','APRIL','MAY','JUNE','JULY','AUGUST','SEPTEMBER','OCTOBER','NOVEMBER','DECEMBER'];
    for (const game of catalog.games) {
      const card = node('article', null, 'card');
      card.append(node('p', months[game.calendar_month] || 'SEASON', 'eyebrow'),
        node('h4', game.name), node('p', game.subtitle, 'small'),
        node('p', game.mechanics),
        node('p', game.local_scoring_status === 'implemented_development'
          ? 'Development engine available · Not live'
          : 'Rulebook and scoring under development', 'small'));
      list.append(card);
    }
  } catch {
    list.replaceChildren(node('p', 'The GOAT Games catalog is temporarily unavailable. Please try again later.', 'small'));
  }
}
async function query(op, extras = {}) { return send('query', { op, ...extras }); }
async function command(op, extras = {}) { return send('commands', { op, ...extras }); }
function showSignedOut() {
  myUserId = ''; activeLeagueId = '';
  el('password').value='';el('password').type='password';
  el('show-password').textContent='Show password';el('show-password').setAttribute('aria-pressed','false');
  for(const id of ['leagues','rounds','standings','entry-requests','league-details'])el(id).replaceChildren();
  el('member-name').textContent='GOAT Games';
  el('league-name').textContent='League';
  el('account-panel').hidden = false;
  el('member-panel').hidden = true;
  el('league-panel').hidden = true;
}
async function showSignedIn() {
  const me = await query('me');
  myUserId = me.profile.user_id;
  el('member-name').textContent = 'Welcome, ' + me.profile.display_name;
  el('account-panel').hidden = true;
  el('member-panel').hidden = false;
  el('league-panel').hidden = true;
  await loadLeagues();
}
async function loadLeagues() {
  const leagues = await query('leagues');
  const list = el('leagues');
  list.replaceChildren();
  if (!leagues.length) {
    list.append(node('p', 'No approved leagues yet. Your commissioner can invite you to join a private GOAT competition.', 'small'));
    return;
  }
  for (const league of leagues) {
    const card = node('article', null, 'card');
    card.append(node('h4', league.name), node('p', league.sport + ' · ' + league.season), node('p', 'Status: ' + league.status));
    if (league.owner_id === myUserId) {
      card.append(node('p', 'Invitation ID: ' + league.id, 'small'));
      const copy = node('button', 'Copy invitation ID', 'secondary');
      copy.type = 'button';
      copy.addEventListener('click', async () => {
        try {
          if (typeof navigator === 'undefined' || !navigator.clipboard) throw new Error('clipboard_unavailable');
          await navigator.clipboard.writeText(league.id);
          notice('Invitation ID copied. Share it privately with participants.', 'success');
        } catch { notice('Copy this invitation ID from the league card: ' + league.id); }
      });
      card.append(copy);
    }
    const open = node('button', 'View competition');
    open.type = 'button';
    open.addEventListener('click', async () => {
      try { await openLeague(league.id); } catch (error) { notice(error.message, 'error'); }
    });
    card.append(open);
    list.append(card);
  }
}
function addCell(row, value) { row.append(node('td', value)); }
function formatDeadline(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'TBD' : date.toLocaleString();
}
async function openLeague(id) {
  const [details, standings] = await Promise.all([query('league', { league_id: id }), query('standings', { league_id: id })]);
  activeLeagueId = id;
  el('league-name').textContent = details.league.name;
  el('league-details').textContent = details.league.sport + ' · ' + details.league.season + ' · ' + details.league.status;
  const isCommissioner = details.league.owner_id === myUserId;
  el('commissioner-panel').hidden = !isCommissioner;
  const requests = el('entry-requests');
  requests.replaceChildren();
  if (isCommissioner) {
    const pending = details.entries.filter(entry => entry.status === 'pending');
    if (!pending.length) requests.append(node('p', 'No pending entry requests.', 'small'));
    for (const entry of pending) {
      const card = node('article', null, 'card');
      card.append(node('p', 'Member ID: ' + entry.user_id));
      const decisionControls = [];
      for (const approved of [true, false]) {
        const control = node('button', approved ? 'Approve entry' : 'Decline entry', approved ? '' : 'secondary');
        control.type = 'button';
        control.addEventListener('click', async () => {
          // Prevent simultaneous approve and decline commands for one entry.
          if (decisionControls.some(item => item.disabled)) return;
          decisionControls.forEach(item => { item.disabled = true; });
          try {
            await command('entry_decide', { league_id: id, user_id: entry.user_id, approved });
            await openLeague(id);
            notice(approved ? 'Entry approved.' : 'Entry declined.', 'success');
          } catch (error) {
            decisionControls.forEach(item => { item.disabled = false; });
            notice(error.message, 'error');
          }
        });
        decisionControls.push(control);
        card.append(control);
      }
      requests.append(card);
    }
  }
  const board = el('standings');
  board.replaceChildren();
  if (!standings.length) {
    const row = node('tr');
    const cell = node('td', 'No standings yet');
    cell.colSpan = 4; row.append(cell); board.append(row);
  } else standings.forEach((person, index) => {
    const row = node('tr');
    addCell(row, person.rank ?? index + 1);
    addCell(row, person.display_name || 'Competitor');
    addCell(row, person.points ?? 0);
    addCell(row, person.wins ?? 0);
    board.append(row);
  });
  const rounds = el('rounds');
  rounds.replaceChildren();
  const ordered = [...details.rounds].sort((a, b) => new Date(a.lock_at) - new Date(b.lock_at));
  for (const round of ordered) {
    const card = node('article', null, 'card');
    card.append(node('h4', round.name), node('p', 'Deadline: ' + formatDeadline(round.lock_at)), node('p', 'Status: ' + round.status));
    const games = details.games.filter(g => g.round_id === round.id);
    const isOpen = round.status === 'open' && new Date(round.lock_at).getTime() > Date.now();
    if (games.length && isOpen) card.append(createPickForm(round, games, details.picks.filter(p => p.user_id === myUserId)));
    else if (games.length) {
      for (const game of games) {
        const pick = details.picks.find(p => p.user_id === myUserId && p.game_id === game.id);
        const description = game.away + ' at ' + game.home + (pick ? ' · Your pick: ' + pick.side + ' (' + pick.weight + ')' : '');
        card.append(node('p', description, 'small'));
      }
    } else card.append(node('p', 'Games have not been announced.', 'small'));
    rounds.append(card);
  }
  if (!ordered.length) rounds.append(node('p', details.league.strategy==='ncaa_bracket_v1'?'March Madness bracket selections and commissioner controls are available in the management workspace.':'The commissioner has not published any rounds yet.', 'small'));
  if(details.league.strategy==='ncaa_bracket_v1'){
    const link=node('a','Open March Madness workspace');link.href='/manage';rounds.append(link);
  }
  el('member-panel').hidden = true;
  el('league-panel').hidden = false;
  notice('Viewing ' + details.league.name, 'success');
}
function createPickForm(round, games, ownPicks) {
  const form = node('form');
  const choices = Array.isArray(round.weight_options) && round.weight_options.length ? round.weight_options : [round.weights];
  const allocation = node('label', 'Ranking weights');
  const weightSet = node('select');
  weightSet.name = 'allocation';
  choices.forEach((option, index) => {
    const label = node('option', option.join(' + '));
    label.value = String(index);
    weightSet.append(label);
  });
  const savedWeights = games.map(game => ownPicks.find(p => p.game_id === game.id)?.weight);
  if (savedWeights.every(value => Number.isInteger(value))) {
    const sortedSaved = [...savedWeights].sort((a, b) => a - b).join(',');
    const savedOption = choices.findIndex(option => [...option].sort((a, b) => a - b).join(',') === sortedSaved);
    if (savedOption >= 0) weightSet.value = String(savedOption);
  }
  allocation.append(weightSet);
  form.append(allocation);
  const fields = [];
  games.forEach((game, index) => {
    const pick = ownPicks.find(p => p.game_id === game.id);
    const line = node('div', null, 'pick-row');
    line.append(node('strong', game.away + ' at ' + game.home));
    line.append(node('p', 'Home spread: ' + game.home_spread, 'small'));
    const pair = node('div', null, 'pick-fields');
    const team = node('label', 'ATS pick');
    const side = node('select');
    side.name = 'side-' + index;
    for (const value of ['home','away']) {
      const option = node('option', value === 'home' ? game.home : game.away);
      option.value = value;
      side.append(option);
    }
    side.value = pick?.side || 'home';
    team.append(side);
    const rank = node('label', 'Confidence points');
    const weight = node('select');
    weight.name = 'weight-' + index;
    rank.append(weight);
    pair.append(team, rank); line.append(pair); form.append(line);
    fields.push({ game_id: game.id, side, weight, savedWeight: pick?.weight });
  });
  function updateWeights() {
    const list = choices[Number(weightSet.value)] || choices[0];
    fields.forEach((field, index) => {
      const previous = field.weight.value ? Number(field.weight.value) : field.savedWeight;
      field.weight.replaceChildren();
      for (const value of list) {
        const option = node('option', value);
        option.value = String(value);
        field.weight.append(option);
      }
      field.weight.value = list.includes(previous) ? String(previous) : String(list[index]);
    });
  }
  weightSet.addEventListener('change', updateWeights);
  updateWeights();
  let mvp;
  if (round.mvp_bonus > 0) {
    const label = node('label', 'Super Bowl MVP pick');
    mvp = node('input'); mvp.name = 'mvp'; mvp.maxLength = 100; mvp.required = true; mvp.placeholder = 'Player name';
    label.append(mvp); form.append(label);
  }
  const button = node('button', 'Submit / replace picks');
  button.type = 'submit'; form.append(button);
  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (button.disabled) return; // Synthetic or keyboard double-submit protection.
    const picks = fields.map(field => ({ game_id: field.game_id, side: field.side.value, weight: Number(field.weight.value) }));
    if (new Set(picks.map(p => p.weight)).size !== picks.length) {
      notice('Use each confidence weight once per round.', 'error'); return;
    }
    button.disabled = true;
    try {
      await command('picks_submit', { round_id: round.id, picks, ...(mvp ? { mvp_pick: mvp.value.trim() } : {}) });
      notice('Your picks were saved. You can change them until the deadline.', 'success');
      await openLeague(activeLeagueId);
      notice('Your picks were saved. You can change them until the deadline.', 'success');
    } catch (error) { notice(error.message, 'error'); }
    finally { button.disabled = false; }
  });
  return form;
}
el('account-form').addEventListener('submit', async event => {
  event.preventDefault();
  const form=el('account-form');
  if (form.getAttribute('aria-busy') === 'true') return;
  form.setAttribute('aria-busy','true');
  const buttons=[...form.querySelectorAll('button[type=submit]')];
  buttons.forEach(button=>button.disabled=true);
  const action = event.submitter?.value || 'login';
  try {
    const values={email:el('email').value.trim(),password:el('password').value,
      ...(action==='signup'?{display_name:el('display-name').value.trim()||undefined}:{})};
    if(action==='signup') {
      const result=await api.signup(values);
      notice(result.confirmation_required === false ? 'Account created. Sign in using your new password.' : 'Registration submitted. Check your email for a confirmation link before signing in.', 'success');
    } else {
      await api.login(values);
      await showSignedIn();
      notice('Welcome to GOAT Games!', 'success');
    }
  } catch (error) { notice(error.message.replaceAll('_',' '), 'error'); }
  finally {
    el('password').value='';el('password').type='password';form.setAttribute('aria-busy','false');
    el('show-password').textContent='Show password';el('show-password').setAttribute('aria-pressed','false');
    buttons.forEach(button=>button.disabled=false);
  }
});
el('show-password').addEventListener('click',event=>{
  const input=el('password'),show=input.type==='password';input.type=show?'text':'password';
  event.currentTarget.textContent=show?'Hide password':'Show password';
  event.currentTarget.setAttribute('aria-pressed',String(show));
});
el('recovery-form').addEventListener('submit',async event=>{
  event.preventDefault();const button=event.submitter || el('recovery-form').querySelector('button');
  if(button.disabled)return;button.disabled=true;
  try {await api.request('/auth/recover',{email:el('recovery-email').value.trim()},false);notice('If an eligible account exists, a recovery email will arrive. Check your inbox.','success');}
  catch(error){notice(error.message.replaceAll('_',' '),'error');}
  finally{button.disabled=false;}
});
el('join-form').addEventListener('submit', async event => {
  event.preventDefault();
  const button = el('join-form').querySelector('button[type=submit]');
  if (button.disabled) return;
  const league_id = el('invite-id').value.trim().toLowerCase();
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(league_id)) {
    notice('Please enter the complete invitation ID.', 'error'); return;
  }
  button.disabled = true;
  try {
    await command('enroll', { league_id });
    el('invite-id').value = '';
    notice('Join request received. Your commissioner must approve your entry before the league appears here.', 'success');
  } catch (error) { notice(error.message, 'error'); }
  finally { button.disabled = false; }
});
el('reload').addEventListener('click', async () => {
  try { await loadLeagues(); notice('Your leagues are up to date.', 'success'); }
  catch (error) { notice(error.message, 'error'); }
});
el('back').addEventListener('click', () => {
  activeLeagueId = '';
  el('league-panel').hidden = true;
  el('member-panel').hidden = false;
});
el('signout').addEventListener('click', async () => {
  try { await api.logout(); notice('Signed out. See you at the next game.'); }
  catch { notice('Signed out on this page. Server sign-out could not be confirmed. Close this page and retry when connected.', 'error'); }
  finally { showSignedOut(); }
});
showSignedOut();
loadGoatGamesCatalog();
