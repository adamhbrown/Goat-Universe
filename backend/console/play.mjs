// GOAT Games participant portal. No tokens in localStorage or analytics by default.
let accessToken = '';
let refreshToken = '';
let myUserId = '';
let activeLeagueId = '';
let authorizedLeagues = [];
let selectedCatalogGame = null;
const el = id => document.getElementById(id);
const APPROVED_SOUNDTRACK = Object.freeze([
  // Add only owner-approved, licensed, same-origin music files after upload and review.
  // { title: 'Approved title', src: '/media/approved-file.mp3' }
]);
function initializeSoundtrack() {
  const track = APPROVED_SOUNDTRACK[0];
  const player = el('soundtrack-player');
  if (!track || !/^\/media\/[a-z0-9][a-z0-9._/-]*\.(?:mp3|m4a|ogg)$/i.test(track.src)) return;
  const audio = el('soundtrack-audio');
  const toggle = el('soundtrack-toggle');
  const mute = el('soundtrack-mute');
  const volume = el('soundtrack-volume');
  audio.src = track.src;
  audio.volume = Number(volume.value) / 100;
  el('soundtrack-title').textContent = track.title;
  player.hidden = false;
  const sync = () => {
    const playing = !audio.paused;
    toggle.textContent = playing ? 'Pause' : 'Play';
    toggle.setAttribute('aria-label', playing ? 'Pause soundtrack' : 'Play soundtrack');
    toggle.setAttribute('aria-pressed', String(playing));
    mute.textContent = audio.muted ? 'Unmute' : 'Mute';
    mute.setAttribute('aria-pressed', String(audio.muted));
  };
  toggle.addEventListener('click', async () => {
    try { if (audio.paused) await audio.play(); else audio.pause(); }
    catch { notice('Soundtrack playback was blocked by your browser. Press Play again.', 'error'); }
    sync();
  });
  mute.addEventListener('click', () => { audio.muted = !audio.muted; sync(); });
  volume.addEventListener('input', () => { audio.volume = Number(volume.value) / 100; });
  audio.addEventListener('play', sync);
  audio.addEventListener('pause', sync);
  audio.addEventListener('ended', sync);
  sync();
}

const node = (tag, text, className) => {
  const item = document.createElement(tag);
  if (text !== undefined && text !== null) item.textContent = String(text);
  if (className) item.className = className;
  return item;
};
const GPI_SCOPES = Object.freeze([
  ['global', 'Global'], ['block', 'Block'], ['county', 'County'], ['state', 'State'], ['region', 'Region']
]);
const GST_TIME_ZONE = 'America/New_York';
const gstClockFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: GST_TIME_ZONE, weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
  hour: 'numeric', minute: '2-digit', second: '2-digit', timeZoneName: 'short'
});
const gstDeadlineFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: GST_TIME_ZONE, month: 'short', day: 'numeric', year: 'numeric',
  hour: 'numeric', minute: '2-digit', timeZoneName: 'short'
});
function renderGstClock(now = new Date()) {
  const clock = el('gst-clock');
  if (!clock || Number.isNaN(now.getTime())) return;
  clock.dateTime = now.toISOString();
  clock.textContent = gstClockFormatter.format(now);
}
function renderGpi(gpi) {
  const list = el('gpi-rankings');
  const verified = gpi?.verified === true && gpi.ranks && typeof gpi.ranks === 'object' && !Array.isArray(gpi.ranks);
  list.replaceChildren();
  for (const [key, label] of GPI_SCOPES) {
    const record = verified && gpi.ranks[key] && typeof gpi.ranks[key] === 'object' ? gpi.ranks[key] : null;
    const rank = Number.isSafeInteger(record?.rank) && record.rank > 0 ? record.rank : null;
    const total = Number.isSafeInteger(record?.total) && record.total >= rank ? record.total : null;
    const place = typeof record?.label === 'string' && record.label.trim() ? record.label.trim().slice(0, 80) : label + ' standing';
    const card = node('article', null, 'gpi-card');
    card.append(node('h4', label), node('strong', rank ? '#' + rank.toLocaleString('en-US') : '—'),
      node('p', rank && total ? place + ' · of ' + total.toLocaleString('en-US') : rank ? place : 'Not ranked'));
    list.append(card);
  }
  el('gpi-status').textContent = verified
    ? 'Only authenticated, verified competition results are included.'
    : 'Ranks appear after verified competition results are available. No estimated or practice ranks are shown.';
}
function notice(message, type = '') {
  el('notice').textContent = message;
  el('notice').className = 'notice ' + type;
}
async function send(path, payload, authenticated = true, allowRefresh = true) {
  const response = await fetch('/' + path, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(authenticated && accessToken ? { Authorization: 'Bearer ' + accessToken } : {})
    },
    body: JSON.stringify(payload)
  });
  if (response.status === 401 && authenticated && allowRefresh && refreshToken) {
    try {
      const session = await send('auth/refresh', { refresh_token: refreshToken }, false, false);
      accessToken = session.access_token;
      refreshToken = session.refresh_token;
      return await send(path, payload, true, false);
    } catch {
      showSignedOut();
      throw new Error('session_expired_please_sign_in');
    }
  }
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || 'request_failed');
  return result;
}
function openGameJourney(game) {
  selectedCatalogGame = game;
  // Display the status supplied by the public catalog, never a simulated launch.
  const status = game.local_scoring_status === 'implemented_development'
    ? 'Development engine available. No live competition or public entries are open.'
    : game.local_scoring_status === 'verified_structure'
      ? 'League structure documented. Hosted play and automated scoring are not open.'
      : 'Rules and scoring are pending approval. Real entries and picks are not open.';
  el('game-journey-title').textContent = game.name;
  el('game-journey-mechanics').textContent = game.mechanics;
  el('game-journey-status').textContent = status;
  el('game-journey-member-link').textContent = accessToken ? 'View my leagues' : 'Sign in or view my leagues';
  const journey = el('game-journey');
  journey.hidden = false;
  renderGameJourneyMemberLeagues();
  journey.scrollIntoView?.({ behavior: 'auto', block: 'start' });
}
function renderGameJourneyMemberLeagues() {
  const holder = el('game-journey-member-leagues');
  holder.replaceChildren();
  el('game-journey-member-link').textContent = accessToken ? 'View all my leagues' : 'Sign in or view my leagues';
  if (!selectedCatalogGame || !accessToken) return;
  // This list comes only from the authenticated /query leagues response.
  const matches = authorizedLeagues.filter(league => league.sport === selectedCatalogGame.sport);
  if (!matches.length) {
    holder.append(node('p', 'No authorized ' + selectedCatalogGame.name + ' leagues on this account yet. Commissioners can issue private invitations.', 'small'));
    return;
  }
  holder.append(node('h4', 'Your ' + selectedCatalogGame.name + ' competitions'));
  for (const league of matches) {
    const control = node('button', 'Open ' + league.name, 'secondary');
    control.type = 'button';
    control.addEventListener('click', async () => {
      control.disabled = true;
      try {
        await openLeague(league.id);
        el('league-panel').scrollIntoView?.({ behavior: 'auto', block: 'start' });
      } catch (error) {
        notice(error.message, 'error');
      } finally { control.disabled = false; }
    });
    holder.append(control);
  }
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
          : game.local_scoring_status === 'verified_structure'
            ? 'Verified format · Hosted play not live'
            : 'Rulebook and scoring under development', 'small'));
      const explore = node('button', 'Explore ' + game.name, 'game-explore');
      explore.type = 'button';
      explore.addEventListener('click', () => openGameJourney(game));
      card.append(explore);
      list.append(card);
    }
  } catch {
    list.replaceChildren(node('p', 'The GOAT Games catalog is temporarily unavailable. Please try again later.', 'small'));
  }
}
async function query(op, extras = {}) { return send('query', { op, ...extras }); }
async function command(op, extras = {}) { return send('commands', { op, ...extras }); }
function showSignedOut() {
  accessToken = ''; refreshToken = ''; myUserId = ''; activeLeagueId = '';
  authorizedLeagues = [];
  renderGameJourneyMemberLeagues();
  renderGpi(null);
  el('account-panel').hidden = false;
  el('member-panel').hidden = true;
  el('league-panel').hidden = true;
}
async function showSignedIn() {
  const me = await query('me');
  myUserId = me.profile.user_id;
  el('member-name').textContent = 'Welcome, ' + me.profile.display_name;
  renderGpi(me.gpi);
  el('account-panel').hidden = true;
  el('member-panel').hidden = false;
  el('league-panel').hidden = true;
  await loadLeagues();
}
async function loadLeagues() {
  const leagues = await query('leagues');
  authorizedLeagues = leagues;
  renderGameJourneyMemberLeagues();
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
  return Number.isNaN(date.getTime()) ? 'TBD' : gstDeadlineFormatter.format(date) + ' GST';
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
      for (const approved of [true, false]) {
        const control = node('button', approved ? 'Approve entry' : 'Decline entry', approved ? '' : 'secondary');
        control.type = 'button';
        control.addEventListener('click', async () => {
          control.disabled = true;
          try {
            await command('entry_decide', { league_id: id, user_id: entry.user_id, approved });
            await openLeague(id);
            notice(approved ? 'Entry approved.' : 'Entry declined.', 'success');
          } catch (error) { control.disabled = false; notice(error.message, 'error'); }
        });
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
  const action = event.submitter?.value || 'login';
  try {
    const result = await send('auth/' + action, {
      email: el('email').value.trim(),
      password: el('password').value,
      ...(action === 'signup' ? { display_name: el('display-name').value.trim() || undefined } : {})
    }, false);
    el('password').value = '';
    accessToken = result.access_token || result.session?.access_token || '';
    refreshToken = result.refresh_token || result.session?.refresh_token || '';
    if (!accessToken) {
      notice(result.confirmation_required === false ? 'Account created. Sign in using your new password.' : 'Account created. Check your email for a confirmation link, then sign in.', 'success');
      return;
    }
    await showSignedIn();
    notice('Welcome to GOAT Games!', 'success');
  } catch (error) { el('password').value = ''; notice(error.message, 'error'); }
});
el('join-form').addEventListener('submit', async event => {
  event.preventDefault();
  const league_id = el('invite-id').value.trim().toLowerCase();
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(league_id)) {
    notice('Please enter the complete invitation ID.', 'error'); return;
  }
  try {
    await command('enroll', { league_id });
    el('invite-id').value = '';
    notice('Join request received. Your commissioner must approve your entry before the league appears here.', 'success');
  } catch (error) { notice(error.message, 'error'); }
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
  try { if (accessToken) await send('auth/logout', {}); }
  catch { /* Clear the browser session even if the server is unreachable. */ }
  finally { showSignedOut(); notice('Signed out. See you at the next game.'); }
});
showSignedOut();
renderGstClock();
if (typeof setInterval === 'function') setInterval(renderGstClock, 1000);
loadGoatGamesCatalog();
initializeSoundtrack();
