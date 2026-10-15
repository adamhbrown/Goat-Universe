/* GOAT Games practice rooms: local state, accessible controls, no backend calls. */
(() => {
  'use strict';
  const E = globalThis.GoatSports;
  if (!E) return;
  document.getElementById('arcade-fallback').hidden = true;
  const root = document.getElementById('experience');
  const announcement = document.getElementById('arcade-announcement');
  const modes = {
    gridiron: { number: '01', name: '1st & BAA', tagline: 'Goats of the Gridiron Playoff League', room: 'THE FOOTBALL WAR ROOM', headline: 'Make the call.', sub: 'Read the matchup. Pick a side against the spread. Put your confidence on the line.', cta: 'Run practice picks', noun: 'FOOTBALL' },
    hoops: { number: '02', name: 'Horns & Hoops', tagline: "Downtown’s BAAsketball Showcase XXXV", room: 'THE BRACKET LOUNGE', headline: 'Trust your madness.', sub: 'Favorites are comfortable. Upsets are memorable. Build your path to the crown.', cta: 'Reveal my champion', noun: 'BASKETBALL' },
    crossover: { number: '03', name: 'GOAT Crossover', tagline: 'Two Sports, 1 Competition', room: 'THE DUAL-SPORT ARENA', headline: 'Own both sides.', sub: 'One court. One sheet of ice. Make your series calls and bring them together.', cta: 'Build combined prediction', noun: 'BASKETBALL + HOCKEY' },
    greatness: { number: '04', name: 'League of Greatness', tagline: 'Fantasy Football Championships', room: 'THE FRANCHISE CLUBHOUSE', headline: 'Your team. Your call.', sub: 'Set the lineup. Read the rivalry. See what your choices do when the lights come on.', cta: 'Run practice matchup', noun: 'FANTASY FOOTBALL' },
    classic: { number: '05', name: 'The GOAT Classic', tagline: 'Take Your Swing at History', room: 'THE OCTOBER CLUB', headline: 'Write your October.', sub: 'Choose the clubs. Call the series length. Build a postseason worth remembering.', cta: 'Reveal my October', noun: 'BASEBALL' },
  };
  const keys = Object.keys(modes);
  let sport = 'gridiron';
  const football = E.createFootball(), footballBracket = E.createBracket(), hoops = E.createBracket(), classic = E.createBracket(true), crossover = E.createCrossover(), fantasy = E.createFantasy();
  const stateFor = key => key === 'hoops' ? hoops : key === 'classic' ? classic : footballBracket;
  const revealed = { gridiron: false, hoops: false, crossover: false, greatness: false, classic: false };
  let stamped = new Set(), franchise = 'Gold Standard', storageAvailable = true, rememberPassport = false, franchiseTouched = false;
  const storageKey = 'goatville-kodak-practice-passport-v1';
  const esc = text => String(text).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  function loadPassport() {
    // Only called following the visitor's explicit storage opt-in.
    try {
      const raw = localStorage.getItem(storageKey);
      if (!raw) return;
      if (raw.length > 2048) throw new Error('Oversized passport');
      const stored = JSON.parse(raw);
      const fields = ['version', 'verification', 'stamps', 'franchise'];
      if (!stored || stored.version !== 1 || stored.verification !== 'local-unverified' ||
          Object.keys(stored).some(key => !fields.includes(key)) ||
          !Array.isArray(stored.stamps) || stored.stamps.length > 5 ||
          stored.stamps.some(key => !keys.includes(key)) ||
          !['Gold Standard', 'Night Shift', 'Summit Club'].includes(stored.franchise)) throw new Error('Invalid passport');
      stored.stamps.forEach(key => stamped.add(key));
      if (!franchiseTouched) franchise = stored.franchise;
    } catch { storageAvailable = false; }
  }
  function savePassport() {
    if (rememberPassport && storageAvailable) {
      try { localStorage.setItem(storageKey, JSON.stringify({ version: 1, verification: 'local-unverified', stamps: [...stamped], franchise })); }
      catch { storageAvailable = false; }
    }
    renderPassport();
  }
  function renderPassport() {
    document.getElementById('passport-count').textContent = `${stamped.size} / 5`;
    document.getElementById('passport-stamps').innerHTML = keys.map(key => `<li class="${stamped.has(key) ? 'stamped' : ''}"><span>${modes[key].number}</span><div><strong>${esc(modes[key].name)}</strong><small>${stamped.has(key) ? 'PRACTICE COMPLETED' : 'EXPERIENCE AWAITS'}</small></div><b aria-label="${stamped.has(key) ? 'Stamped' : 'Not yet stamped'}">${stamped.has(key) ? '✓' : '◇'}</b></li>`).join('');
    document.getElementById('franchise-name').value = franchise;
    document.getElementById('passport-remember').checked = rememberPassport;
    document.getElementById('passport-clear').textContent = rememberPassport ? 'Clear passport & turn off saving' : 'Clear this visit’s passport';
    document.getElementById('passport-storage').textContent = !storageAvailable ? 'Saved data is unavailable. Your passport works in memory for this page visit only.' : rememberPassport ? 'Saving local-unverified stamps only in this browser. Opt-in is required again after reload.' : 'Memory only for this visit. Browser storage is not accessed unless you opt in.';
  }
  function announce(text) { announcement.textContent = text; }
  function teamButton(id, { action, key, selected, disabled = false, extra = '', prefix = '' }) {
    const team = E.team(id);
    if (!team) return `<button class="team-option waiting" type="button" data-focus="${key}" ${extra} disabled><span>—</span><strong>Awaiting your pick</strong></button>`;
    return `<button class="team-option${selected ? ' selected' : ''}" type="button" data-action="${action}" data-focus="${key}" ${extra} aria-pressed="${Boolean(selected)}" ${disabled ? 'disabled' : ''}><span class="team-monogram">${prefix || String(team.seed).padStart(2, '0')}</span><strong>${esc(team.name)}</strong><i aria-hidden="true">${selected ? '✓' : '＋'}</i></button>`;
  }
  function environment() {
    const drawings = {
      gridiron: '<path d="M70 30h580v300H70Z"/><path d="M130 30v300m58-300v300m58-300v300m58-300v300m58-300v300m58-300v300m58-300v300m58-300v300m58-300v300"/><path d="M300 200q60-110 120 0-60 110-120 0Z"/><path d="M360 160v80m-10-60h20m-20 20h20m-20 20h20"/>',
      hoops: '<path d="M70 30h580v300H70ZM360 30v300"/><circle cx="360" cy="180" r="55"/><path d="M70 100h90v160H70m580-160h-90v160h90M70 60a120 120 0 0 1 0 240m580-240a120 120 0 0 0 0 240"/>',
      crossover: '<path d="M70 30h290v300H70Z"/><path d="M360 30h200q90 0 90 90v120q0 90-90 90H360"/><circle cx="360" cy="180" r="55"/><path d="M70 100h90v160H70m490-160v160m-200-80h290"/><circle cx="550" cy="100" r="28"/><circle cx="550" cy="260" r="28"/>',
      greatness: '<path d="m360 20 140 70-25 135-115 110-115-110-25-135Z"/><path d="m295 130 65 35 65-35-20 70-45 45-45-45Z"/><path d="m295 130-15-55 55 35 25-60 25 60 55-35-15 55"/><path d="M70 80h100m-100 40h60m-60 40h85m380-40h100m-80 40h80m-100 40h100"/>',
      classic: '<path d="m360 30 240 240H120Z"/><path d="m360 95 155 155-155 80-155-80Z"/><path d="m360 150 95 95-95 65-95-65Z"/><circle cx="360" cy="246" r="15"/><path d="M120 270 70 315m530-45 50 45"/>',
    };
    return `<svg class="room-environment" viewBox="0 0 720 360" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">${drawings[sport]}</svg>`;
  }
  function hero() {
    const mode = modes[sport];
    return `<header class="room-hero">${environment()}<div class="room-location"><span>${mode.number} / ${mode.room}</span><span>GOATVILLE ORIGINAL</span></div><div class="room-title"><div><h1>${esc(mode.name)}</h1><p class="official-tagline">${esc(mode.tagline)}</p></div><span class="sport-word">${mode.noun}</span></div><div class="room-intro"><h2>${mode.headline}</h2><p>${mode.sub}</p></div></header>`;
  }
  function resultsHeader(label, title, text) { return `<div class="result-heading"><span class="eyebrow">${label}</span><h3>${esc(title)}</h3><p>${esc(text)}</p></div>`; }
  function footballRoom() {
    const result = revealed.gridiron ? E.resolveFootball(football) : null;
    return `<div class="room-content"><div class="room-section-heading"><div><span class="eyebrow">THE CONFIDENCE LADDER</span><h3>Four calls. Rank your conviction.</h3></div><span class="completion-count">${football.picks.filter(Boolean).length} / 4 SELECTED</span></div><p class="instruction">Select the team you expect to cover its fictional spread. Rank confidence from 1 to 4; 4 is strongest. Changing a rank swaps the other assignment.</p><div class="pick-grid">${E.fixtures.map((f, i) => {
      const selected = football.picks[i];
      return `<article class="pick-card"><div class="fixture-top"><span>EXHIBITION ${String(i + 1).padStart(2, '0')}</span><label>Confidence<select aria-label="Confidence for exhibition ${i + 1}" data-action="rank" data-index="${i}" data-focus="rank-${i}">${[1, 2, 3, 4].map(n => `<option value="${n}"${football.ranks[i] === n ? ' selected' : ''}>${n}${n === 4 ? ' · strongest' : ''}</option>`).join('')}</select></label></div>${teamButton(f.home, { action: 'football-pick', key: `fp-${i}-${f.home}`, selected: selected === f.home, prefix: `${f.spread > 0 ? '+' : ''}${f.spread}`, extra: `data-index="${i}" data-team="${f.home}"` })}${teamButton(f.away, { action: 'football-pick', key: `fp-${i}-${f.away}`, selected: selected === f.away, prefix: `${-f.spread > 0 ? '+' : ''}${-f.spread}`, extra: `data-index="${i}" data-team="${f.away}"` })}<details class="scouting" id="scouting-${i}"><summary>Reveal matchup intel <span aria-hidden="true">+</span></summary><p>${f.note} Fictional scouting for practice.</p></details>${result ? `<div class="fixture-result"><span>FICTIONAL FINAL</span><strong>${E.team(f.home).short} ${f.homeScore} — ${f.awayScore} ${E.team(f.away).short}</strong><small>${selected === result.games[i].cover ? `Covered · +${football.ranks[i]} practice points` : 'Did not cover · 0 practice points'}</small></div>` : ''}</article>`;
    }).join('')}</div>${result ? `<section class="result-card" tabindex="-1" id="room-result">${resultsHeader('PRACTICE RESULT · FICTIONAL OUTCOMES', `${result.points} / 10 confidence points`, 'These are fixed demonstration outcomes. Your practice points never enter official GOAT Games scoring.')}<button type="button" class="primary-button" data-action="reset" data-focus="reset-gridiron">Make a fresh set of calls ↻</button></section>` : `<div class="room-actions"><button class="primary-button" type="button" data-action="resolve" data-focus="resolve-gridiron">Run practice picks <span aria-hidden="true">↗</span></button><span>No stakes. All instinct.</span></div>`}<details class="extra-room" id="football-bracket-room"><summary>Open the playoff bracket simulator <span aria-hidden="true">+</span></summary><p class="instruction">An 8-team exhibition bracket, separate from official playoff formats. Choose winners to open the next round. Changing an earlier pick clears affected later picks.</p>${bracketView(footballBracket, 'football')}</details></div>`;
  }
  function bracketView(state, key) {
    const labels = key === 'classic' ? ['Division round · best of 5', 'League round · best of 7', 'Championship · best of 7'] : ['Opening round', 'Semifinals', 'Championship'];
    return `<div class="bracket-scroll" role="region" aria-label="${key === 'classic' ? 'Baseball series' : 'Exhibition'} bracket. Scroll horizontally for later rounds." tabindex="0"><div class="bracket-board">${state.picks.map((round, r) => `<section class="bracket-round"><h4><span>0${r + 1}</span>${labels[r]}</h4><div class="round-matches">${round.map((winner, m) => {
      const pair = E.participants(state, r, m), ready = pair.every(Boolean);
      return `<article class="bracket-match"><span class="match-label">${r === 2 ? 'THE FINAL CALL' : `MATCH ${m + 1}`}</span>${pair.map((id, side) => teamButton(id, { action: 'bracket-pick', key: `${key}-${r}-${m}-${side}`, selected: winner === id && !!id, disabled: !ready, extra: `data-bracket="${key}" data-round="${r}" data-match="${m}" data-team="${id || ''}"` })).join('')}${state.series ? `<label class="series-length">Series length<select aria-label="Games for ${labels[r]}, match ${m + 1}" data-action="bracket-length" data-bracket="${key}" data-round="${r}" data-match="${m}" data-focus="length-${key}-${r}-${m}" ${!winner ? 'disabled' : ''}><option value="">Choose games</option>${Array.from({ length: r === 0 ? 3 : 4 }, (_, i) => i + (r === 0 ? 3 : 4)).map(n => `<option value="${n}"${state.lengths[r][m] === n ? ' selected' : ''}>${n} games</option>`).join('')}</select></label>` : ''}</article>`;
    }).join('')}</div></section>`).join('')}</div></div>`;
  }
  function bracketRoom() {
    const state = stateFor(sport), isClassic = sport === 'classic', complete = E.bracketComplete(state), champion = E.team(state.picks[2][0]);
    return `<div class="room-content"><div class="room-section-heading"><div><span class="eyebrow">${isClassic ? 'THE POSTSEASON PATH' : 'THE UPSET PATH'}</span><h3>${isClassic ? 'Every series tells a story.' : 'Pick a winner. Open the next round.'}</h3></div><span class="completion-count">${E.bracketProgress(state)} / 7 PICKS${isClassic ? ` · ${state.lengths.flat().filter(Number.isInteger).length} / 7 LENGTHS` : ''}</span></div><p class="instruction">8 fictional teams. A condensed exhibition format${isClassic ? '; division series use best of 5, later rounds best of 7' : ', separate from the official college tournament'}. ${isClassic ? 'Choose each series winner and number of games.' : 'Choose a higher seed number to make an upset pick.'} Earlier edits clear affected later picks.</p><div class="bracket-stats"><span>${isClassic ? 'PROJECTED GAMES' : 'UPSET PICKS'}<b>${isClassic ? state.lengths.flat().reduce((sum, n) => sum + (n || 0), 0) : E.upsetCount(state)}</b></span><span>YOUR PROJECTED CHAMPION<b>${champion ? esc(champion.name) : 'The crown is open'}</b></span><span class="swipe-hint">EXPLORE THE ROUNDS ↔</span></div>${bracketView(state, sport)}<div class="room-actions"><button class="primary-button" type="button" data-action="resolve" data-focus="resolve-${sport}">${modes[sport].cta} <span aria-hidden="true">↗</span></button><button class="text-button" data-action="reset" data-focus="reset-${sport}" type="button">Reset bracket ↻</button></div>${revealed[sport] && complete ? `<section class="result-card championship-reveal" id="room-result" tabindex="-1"><span class="crown-art" aria-hidden="true">♛</span>${resultsHeader('YOUR FICTIONAL EXHIBITION CHAMPION', champion.name, isClassic ? `Your October: 7 series, ${state.lengths.flat().reduce((sum, n) => sum + n, 0)} projected games. This is your prediction, not a competition result.` : `${E.upsetCount(state)} upset picks. One champion. Your bracket has been stamped in your local passport.`)}<div class="prediction-path">${state.picks.map((round, r) => `<div><span>${r === 0 ? 'OPENING PICKS' : r === 1 ? 'FINALISTS' : 'CHAMPION'}</span><p>${round.map((id, m) => `${esc(E.team(id).name)}${isClassic ? ` in ${state.lengths[r][m]}` : ''}`).join(' · ')}</p></div>`).join('')}</div></section>` : ''}</div>`;
  }
  function crossoverRoom() {
    return `<div class="room-content"><div class="room-section-heading"><div><span class="eyebrow">FOUR SERIES. ONE PREDICTION CARD.</span><h3>Two arenas. Same competitive instinct.</h3></div><span class="completion-count">${crossover.filter(s => s.winner && s.length).length} / 4 COMPLETE</span></div><p class="instruction">Four independent fictional exhibition series. Pick the winner and length of each best-of-seven matchup, then build your combined card.</p><div class="dual-arena">${['Basketball', 'Hockey'].map((name, sportIndex) => `<section class="arena-side ${sportIndex ? 'ice-side' : 'court-side'}"><div class="arena-label"><span aria-hidden="true">${sportIndex ? '╱' : '◎'}</span><h4>${name}</h4><small>BEST OF SEVEN</small></div>${E.series.map((s, i) => s.sport !== name ? '' : `<article class="pick-card"><div class="fixture-top"><span>EXHIBITION ${sportIndex ? 'ICE' : 'COURT'} ${i % 2 + 1}</span></div>${[s.a, s.b].map(id => teamButton(id, { action: 'series-pick', key: `series-${i}-${id}`, selected: crossover[i].winner === id, extra: `data-index="${i}" data-team="${id}"` })).join('')}<label class="series-length">Call the series length<select aria-label="Games for ${name} exhibition ${i % 2 + 1}" data-action="series-length" data-index="${i}" data-focus="series-length-${i}" ${!crossover[i].winner ? 'disabled' : ''}><option value="">Choose games</option>${[4, 5, 6, 7].map(n => `<option value="${n}"${crossover[i].length === n ? ' selected' : ''}>${n} games</option>`).join('')}</select></label></article>`).join('')}</section>`).join('')}</div><div class="room-actions"><button class="primary-button" type="button" data-action="resolve" data-focus="resolve-crossover">Build combined prediction <span aria-hidden="true">↗</span></button><button class="text-button" data-action="reset" data-focus="reset-crossover" type="button">Start fresh ↻</button></div>${revealed.crossover && E.crossoverComplete(crossover) ? `<section class="result-card" id="room-result" tabindex="-1">${resultsHeader('YOUR COMBINED PREDICTION · FICTIONAL EXHIBITION', `${crossover.reduce((sum, s) => sum + s.length, 0)} games of conviction.`, 'Four series calls. Two sports. Your own GOAT Crossover card.')}<div class="combined-card">${crossover.map((pick, i) => `<div><span>${E.series[i].sport.toUpperCase()}</span><strong>${esc(E.team(pick.winner).name)}</strong><b>IN ${pick.length}</b></div>`).join('')}</div></section>` : ''}</div>`;
  }
  function fantasyRoom() {
    const players = E.lineup(fantasy), result = revealed.greatness ? E.resolveFantasy(fantasy) : null;
    const projection = players.reduce((sum, player) => sum + (player?.projection || 0), 0);
    return `<div class="room-content"><div class="clubhouse-banner"><div><span class="eyebrow">YOUR FRANCHISE</span><h3>${esc(franchise)}</h3><p>Tonight’s exhibition rivalry: your clubhouse vs. The Midnight Club. All athletes and numbers below are fictional.</p></div><div class="matchup-preview"><span>PRACTICE PROJECTION</span><strong>${projection}<i>vs.</i>86</strong><small>${players.filter(Boolean).length} / 5 STARTERS SELECTED</small></div></div><div class="roster-board">${E.roster.map((slot, i) => `<section class="roster-slot"><div class="roster-position">${slot.slot}<small>START ONE</small></div><div class="roster-options">${slot.options.map(player => `<button type="button" class="roster-player${fantasy[i] === player.id ? ' selected' : ''}" data-action="start-player" data-index="${i}" data-player="${player.id}" data-focus="player-${player.id}" aria-pressed="${fantasy[i] === player.id}"><span class="player-avatar" aria-hidden="true">${player.name.split(' ').map(n => n[0]).join('')}</span><span><strong>${player.name}</strong><small>${player.style}</small></span><b>${player.projection}<small>PROJ.</small></b><i aria-hidden="true">${fantasy[i] === player.id ? '✓' : '＋'}</i></button>`).join('')}</div></section>`).join('')}</div><div class="room-actions"><button class="primary-button" type="button" data-action="resolve" data-focus="resolve-greatness">Run practice matchup <span aria-hidden="true">↗</span></button><button class="text-button" data-action="reset" data-focus="reset-greatness" type="button">Reset lineup ↻</button></div>${result ? `<section class="result-card" id="room-result" tabindex="-1">${resultsHeader('FICTIONAL PRACTICE RESULT', `${result.points} – ${result.opponent} · ${result.outcome === 'win' ? 'Clubhouse win' : result.outcome === 'tie' ? 'Dead even' : 'The rivalry continues'}`, 'Fixed demonstration performances show how roster choices change the outcome. This does not affect any real league.')}<div class="lineup-result">${result.players.map(p => `<div><span>${p.name}</span><strong>${p.actual} <small>PTS</small></strong></div>`).join('')}</div></section>` : ''}<div class="clubhouse-bottom"><section class="trophy-gallery"><span class="eyebrow">THE TROPHY ROOM · GALLERY CONCEPT</span><div>${[['◇', 'Division banner'], ['♜', 'League crown'], ['◎', 'Legacy ring']].map(([icon, name]) => `<div><span aria-hidden="true">${icon}</span><strong>${name}</strong><small>NO TITLE AWARDED</small></div>`).join('')}</div></section><details class="integration-path" id="league-integration-path"><summary>The road to your real league <span aria-hidden="true">+</span></summary><p>Next: verified league identity, read-only roster import, official scoring mappings and commissioner review. Real accounts and league connections belong to the separate backend workstream.</p><a href="index.html#game-details-greatness">Read the official competition explanation ↗</a></details></div></div>`;
  }
  function render({ resultFocus = false } = {}) {
    const focus = document.activeElement?.dataset?.focus;
    const openPanels = [...root.querySelectorAll('details[open][id]')].map(panel => panel.id);
    root.dataset.sport = sport;
    root.setAttribute('aria-labelledby', `tab-${sport}`);
    root.innerHTML = hero() + (sport === 'gridiron' ? footballRoom() : sport === 'crossover' ? crossoverRoom() : sport === 'greatness' ? fantasyRoom() : bracketRoom()) + '<p id="room-validation" class="room-validation" role="status" aria-live="polite"></p>';
    openPanels.forEach(id => { const panel = document.getElementById(id); if (panel) panel.open = true; });
    if (resultFocus) document.getElementById('room-result')?.focus({ preventScroll: false });
    else if (focus) [...root.querySelectorAll('[data-focus]')].find(el => el.dataset.focus === focus)?.focus({ preventScroll: true });
  }
  function validation(message) { document.getElementById('room-validation').textContent = message; announce(message); }
  function invalidate() { revealed[sport] = false; }
  function resolve() {
    let complete;
    if (sport === 'gridiron') complete = !!E.resolveFootball(football);
    else if (sport === 'crossover') complete = E.crossoverComplete(crossover);
    else if (sport === 'greatness') complete = !!E.resolveFantasy(fantasy);
    else complete = E.bracketComplete(stateFor(sport));
    if (!complete) {
      const message = sport === 'gridiron' ? 'Choose a side in all four matchups before running your practice picks.' : sport === 'greatness' ? 'Choose one starter for each of the five lineup positions.' : sport === 'crossover' ? 'Choose all four series winners and a length from 4 to 7 games for each.' : sport === 'classic' ? 'Complete all seven series winners and seven series lengths before revealing your October.' : 'Complete all seven bracket picks, including your champion.';
      validation(message); return;
    }
    revealed[sport] = true; stamped.add(sport); savePassport(); render({ resultFocus: true });
    announce(`${modes[sport].name} practice complete. Your local passport has ${stamped.size} of 5 stamps.`);
  }
  function reset() {
    if (sport === 'gridiron') Object.assign(football, E.createFootball());
    else if (sport === 'greatness') fantasy.splice(0, fantasy.length, ...E.createFantasy());
    else if (sport === 'crossover') crossover.splice(0, crossover.length, ...E.createCrossover());
    else Object.assign(stateFor(sport), E.createBracket(sport === 'classic'));
    revealed[sport] = false; render(); announce('Fresh practice. Your completed passport stamps are preserved.');
  }
  root.addEventListener('click', event => {
    const button = event.target.closest('button[data-action]'); if (!button) return;
    const data = button.dataset;
    if (data.action === 'resolve') { resolve(); return; }
    if (data.action === 'reset') { reset(); return; }
    if (data.action === 'football-pick') E.pickFootball(football, Number(data.index), data.team);
    else if (data.action === 'bracket-pick') E.choose(stateFor(data.bracket), Number(data.round), Number(data.match), data.team);
    else if (data.action === 'series-pick') E.pickSeries(crossover, Number(data.index), data.team);
    else if (data.action === 'start-player') E.startPlayer(fantasy, Number(data.index), data.player);
    if (data.action !== 'bracket-pick' || data.bracket !== 'football') invalidate();
    render();
  });
  root.addEventListener('change', event => {
    const data = event.target.dataset, value = Number(event.target.value);
    if (data.action === 'rank') { E.rankFootball(football, Number(data.index), value); announce('Confidence ranks swapped. 4 is your strongest call.'); }
    else if (data.action === 'bracket-length') E.setLength(stateFor(data.bracket), Number(data.round), Number(data.match), value);
    else if (data.action === 'series-length') E.lengthSeries(crossover, Number(data.index), value);
    else return;
    invalidate(); render();
  });
  function selectSport(key, { focusTab = false, updateHash = true } = {}) {
    sport = keys.includes(key) ? key : 'gridiron';
    document.querySelectorAll('[role=tab]').forEach(tab => {
      const selected = tab.dataset.sport === sport; tab.setAttribute('aria-selected', String(selected)); tab.tabIndex = selected ? 0 : -1;
      if (selected && focusTab) { tab.focus(); tab.scrollIntoView({ block: 'nearest', inline: 'nearest' }); }
    });
    if (updateHash && location.hash !== `#${sport}`) history.pushState(null, '', `#${sport}`);
    document.title = `${modes[sport].name} — Practice | GOAT Arcade`; render();
  }
  const tabs = document.querySelector('.sport-tabs');
  tabs.addEventListener('click', event => { const tab = event.target.closest('[data-sport]'); if (tab) { selectSport(tab.dataset.sport); root.scrollIntoView({ block: 'start', behavior: 'instant' }); } });
  tabs.addEventListener('keydown', event => {
    const focusedSport = event.target.closest('[data-sport]')?.dataset.sport || sport;
    const index = keys.indexOf(focusedSport);
    const target = event.key === 'ArrowRight' ? keys[(index + 1) % keys.length] : event.key === 'ArrowLeft' ? keys[(index + keys.length - 1) % keys.length] : event.key === 'Home' ? keys[0] : event.key === 'End' ? keys[4] : null;
    if (target) { event.preventDefault(); selectSport(target, { focusTab: true }); }
  });
  window.addEventListener('popstate', () => selectSport(location.hash.slice(1), { updateHash: false }));
  window.addEventListener('hashchange', () => selectSport(location.hash.slice(1), { updateHash: false }));
  document.getElementById('passport-toggle').addEventListener('click', event => {
    const drawer = document.getElementById('passport-drawer'); drawer.hidden = !drawer.hidden;
    event.currentTarget.setAttribute('aria-expanded', String(!drawer.hidden));
  });
  document.getElementById('passport-clear').addEventListener('click', () => {
    stamped.clear(); franchise = 'Gold Standard';
    if (rememberPassport) { try { localStorage.removeItem(storageKey); } catch { storageAvailable = false; } }
    rememberPassport = false; franchiseTouched = false;
    renderPassport(); render(); announce('The current passport is cleared and browser saving is off.');
  });
  document.getElementById('franchise-name').addEventListener('change', event => { franchise = event.target.value; franchiseTouched = true; savePassport(); render(); announce(`Your clubhouse identity is ${franchise}.`); });
  function updateGpi() {
    const values = ['form', 'moment', 'resolve'].map(key => {
      const value = Number(document.getElementById(`gpi-${key}`).value); document.getElementById(`gpi-${key}-value`).textContent = value; return value;
    });
    document.getElementById('gpi-value').textContent = E.gpi(values);
  }
  ['form', 'moment', 'resolve'].forEach(key => document.getElementById(`gpi-${key}`).addEventListener('input', updateGpi));
  document.getElementById('passport-remember').addEventListener('change', event => {
    if (event.target.checked) { rememberPassport = true; storageAvailable = true; loadPassport(); savePassport(); }
    else {
      try { localStorage.removeItem(storageKey); } catch { storageAvailable = false; }
      rememberPassport = false; renderPassport();
    }
    render(); announce(rememberPassport && storageAvailable ? 'Browser saving enabled for local-unverified souvenirs.' : 'Your passport stays in memory for this visit.');
  });
  renderPassport(); updateGpi(); selectSport(location.hash.slice(1), { updateHash: false });
})();
