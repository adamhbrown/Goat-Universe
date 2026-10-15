/* GOAT Arcade practice models. All teams, athletes and outcomes are fictional. */
(function (root) {
  'use strict';
  const teams = [
    { id: 'gold', name: 'Gold City Royals', short: 'GCR', seed: 1 },
    { id: 'harbor', name: 'Harbor Night Owls', short: 'HNO', seed: 8 },
    { id: 'summit', name: 'Summit Ridge', short: 'SUM', seed: 4 },
    { id: 'copper', name: 'Copper Valley', short: 'COP', seed: 5 },
    { id: 'desert', name: 'Desert Outlaws', short: 'OUT', seed: 3 },
    { id: 'coast', name: 'Coastal Breakers', short: 'COA', seed: 6 },
    { id: 'iron', name: 'Ironwood Club', short: 'IRN', seed: 2 },
    { id: 'metro', name: 'Metro Afterhours', short: 'MET', seed: 7 },
  ];
  const team = id => teams.find(t => t.id === id);
  function createBracket(series = false) { return { picks: [[null, null, null, null], [null, null], [null]], lengths: [[null, null, null, null], [null, null], [null]], series }; }
  function participants(state, round, match) {
    if (!Number.isInteger(round) || !Number.isInteger(match) || !state.picks[round] || match < 0 || match >= state.picks[round].length) return [];
    return round === 0 ? teams.slice(match * 2, match * 2 + 2).map(t => t.id) : state.picks[round - 1].slice(match * 2, match * 2 + 2);
  }
  function choose(state, round, match, id) {
    const options = participants(state, round, match);
    if (options.length !== 2 || options.some(t => !t) || !options.includes(id)) return false;
    if (state.picks[round][match] === id) return true;
    state.picks[round][match] = id; state.lengths[round][match] = null;
    // A changed participant changes every match on its path, even if its opponent
    // had been the selected winner. Clear predictions and series lengths together.
    let affected = match;
    for (let r = round + 1; r < state.picks.length; r += 1) {
      affected = Math.floor(affected / 2);
      state.picks[r][affected] = null;
      state.lengths[r][affected] = null;
    }
    return true;
  }
  function setLength(state, round, match, length) {
    if (!state.series || !state.picks[round]?.[match]) return false;
    const min = round === 0 ? 3 : 4, max = round === 0 ? 5 : 7;
    if (!Number.isInteger(length) || length < min || length > max) return false;
    state.lengths[round][match] = length; return true;
  }
  function bracketProgress(state) { return state.picks.flat().filter(Boolean).length; }
  function bracketComplete(state) { return bracketProgress(state) === 7 && (!state.series || state.lengths.flat().every(Number.isInteger)); }
  function upsetCount(state) {
    return state.picks.reduce((count, round, r) => count + round.filter((winner, m) => {
      if (!winner) return false;
      const opponent = participants(state, r, m).find(id => id !== winner);
      return team(winner).seed > (team(opponent)?.seed ?? 99);
    }).length, 0);
  }
  const fixtures = [
    { id: 'f0', home: 'gold', away: 'harbor', spread: -3.5, homeScore: 27, awayScore: 24, note: 'Gold City protects the pocket. Harbor wants a late, chaotic finish.' },
    { id: 'f1', home: 'summit', away: 'copper', spread: -2.5, homeScore: 31, awayScore: 20, note: 'Summit brings the ground game. Copper likes to take the top off the defense.' },
    { id: 'f2', home: 'desert', away: 'coast', spread: 1.5, homeScore: 17, awayScore: 21, note: 'Desert lives for fourth down. Coastal keeps the tempo high.' },
    { id: 'f3', home: 'iron', away: 'metro', spread: -6.5, homeScore: 28, awayScore: 24, note: 'Ironwood controls the clock. Metro is one big play from changing the night.' },
  ];
  function createFootball() { return { picks: [null, null, null, null], ranks: [1, 2, 3, 4] }; }
  function pickFootball(state, index, id) {
    const f = fixtures[index]; if (!f || ![f.home, f.away].includes(id)) return false;
    state.picks[index] = id; return true;
  }
  function rankFootball(state, index, rank) {
    if (!Number.isInteger(index) || index < 0 || index > 3 || !Number.isInteger(rank) || rank < 1 || rank > 4) return false;
    const other = state.ranks.indexOf(rank), old = state.ranks[index];
    state.ranks[index] = rank; if (other !== index) state.ranks[other] = old; return true;
  }
  function resolveFootball(state) {
    if (state.picks.length !== 4 || state.picks.some((id, i) => ![fixtures[i].home, fixtures[i].away].includes(id)) || new Set(state.ranks).size !== 4 || state.ranks.some(r => ![1, 2, 3, 4].includes(r))) return null;
    const games = fixtures.map((f, i) => ({ ...f, cover: f.homeScore + f.spread > f.awayScore ? f.home : f.away, selected: state.picks[i], rank: state.ranks[i] }));
    return { games, points: games.reduce((sum, g) => sum + (g.cover === g.selected ? g.rank : 0), 0), max: 10 };
  }
  const series = [
    { id: 'b1', sport: 'Basketball', a: 'gold', b: 'harbor' }, { id: 'b2', sport: 'Basketball', a: 'summit', b: 'copper' },
    { id: 'h1', sport: 'Hockey', a: 'desert', b: 'coast' }, { id: 'h2', sport: 'Hockey', a: 'iron', b: 'metro' },
  ];
  function createCrossover() { return series.map(s => ({ id: s.id, winner: null, length: null })); }
  function pickSeries(state, index, winner) {
    const s = series[index]; if (!s || ![s.a, s.b].includes(winner)) return false;
    state[index].winner = winner; return true;
  }
  function lengthSeries(state, index, length) {
    if (!state[index]?.winner || !Number.isInteger(length) || length < 4 || length > 7) return false;
    state[index].length = length; return true;
  }
  function crossoverComplete(state) { return state.length === 4 && state.every((s, i) => [series[i].a, series[i].b].includes(s.winner) && Number.isInteger(s.length) && s.length >= 4 && s.length <= 7); }
  const roster = [
    { slot: 'QB', options: [{ id: 'qb1', name: 'Miles Mercer', style: 'Pocket precision', projection: 20, actual: 22 }, { id: 'qb2', name: 'Jace Wilder', style: 'Rushing upside', projection: 22, actual: 16 }] },
    { slot: 'RB', options: [{ id: 'rb1', name: 'Knox Bennett', style: 'Workhorse touches', projection: 17, actual: 18 }, { id: 'rb2', name: 'Theo Slate', style: 'Big-play ceiling', projection: 19, actual: 24 }] },
    { slot: 'WR', options: [{ id: 'wr1', name: 'Remy Cross', style: 'Reliable targets', projection: 16, actual: 15 }, { id: 'wr2', name: 'Cole Archer', style: 'Downfield threat', projection: 18, actual: 9 }] },
    { slot: 'TE', options: [{ id: 'te1', name: 'Drew Sterling', style: 'Red-zone role', projection: 11, actual: 14 }, { id: 'te2', name: 'Nico Voss', style: 'Volume play', projection: 12, actual: 10 }] },
    { slot: 'FLEX', options: [{ id: 'fx1', name: 'Ash Rowan', style: 'Steady floor', projection: 14, actual: 13 }, { id: 'fx2', name: 'Finn Calder', style: 'Boom-or-bust', projection: 16, actual: 21 }] },
  ];
  function createFantasy() { return [null, null, null, null, null]; }
  function startPlayer(state, slot, id) { if (!roster[slot]?.options.some(p => p.id === id)) return false; state[slot] = id; return true; }
  function lineup(state) { return roster.map((s, i) => s.options.find(p => p.id === state[i]) ?? null); }
  function resolveFantasy(state) {
    const players = lineup(state); if (players.some(p => !p)) return null;
    const points = players.reduce((sum, p) => sum + p.actual, 0), opponent = 82;
    return { players, points, opponent, outcome: points > opponent ? 'win' : points === opponent ? 'tie' : 'loss' };
  }
  function gpi(values) {
    const weights = [0.4, 0.35, 0.25];
    if (values.length !== 3 || values.some(v => !Number.isFinite(v) || v < 0 || v > 100)) return null;
    return Math.round(values.reduce((sum, v, i) => sum + v * weights[i], 0));
  }
  const api = { teams, team, createBracket, participants, choose, setLength, bracketProgress, bracketComplete, upsetCount, fixtures, createFootball, pickFootball, rankFootball, resolveFootball, series, createCrossover, pickSeries, lengthSeries, crossoverComplete, roster, createFantasy, startPlayer, lineup, resolveFantasy, gpi };
  root.GoatSports = Object.freeze(api); if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(globalThis);
