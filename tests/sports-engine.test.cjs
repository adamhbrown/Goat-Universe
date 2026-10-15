const assert = require('node:assert/strict');
const { test } = require('node:test');
const E = require('../assets/sports-engine.js');
function fillBracket(series = false) {
  const state = E.createBracket(series);
  for (const [round, winners] of [[0, ['gold', 'summit', 'desert', 'iron']], [1, ['gold', 'iron']], [2, ['gold']]]) {
    winners.forEach((id, match) => { assert.equal(E.choose(state, round, match, id), true); if (series) E.setLength(state, round, match, round === 0 ? 4 : 6); });
  }
  return state;
}
test('bracket unlocks only valid participants and reaches one champion', () => {
  const state = E.createBracket();
  assert.equal(E.choose(state, 1, 0, 'gold'), false);
  assert.equal(E.choose(state, 0, 0, 'summit'), false);
  assert.deepEqual(E.participants(state, 0, 0), ['gold', 'harbor']);
  const complete = fillBracket();
  assert.equal(E.bracketProgress(complete), 7); assert.equal(E.bracketComplete(complete), true);
  assert.equal(complete.picks[2][0], 'gold');
});
test('editing an opener invalidates every affected prediction, even a surviving winner', () => {
  const state = fillBracket(true);
  assert.equal(E.choose(state, 0, 1, 'copper'), true);
  assert.equal(state.picks[1][0], null); assert.equal(state.lengths[1][0], null);
  assert.equal(state.picks[2][0], null); assert.equal(state.lengths[2][0], null);
  assert.equal(state.picks[1][1], 'iron'); assert.equal(state.lengths[1][1], 6);
  assert.equal(E.bracketComplete(state), false);
});
test('baseball series lengths respect best-of-five and best-of-seven formats', () => {
  const state = E.createBracket(true);
  assert.equal(E.setLength(state, 0, 0, 4), false);
  E.choose(state, 0, 0, 'gold');
  assert.equal(E.setLength(state, 0, 0, 6), false); assert.equal(E.setLength(state, 0, 0, 2), false);
  assert.equal(E.setLength(state, 0, 0, 5), true);
  const complete = fillBracket(true); assert.equal(E.bracketComplete(complete), true);
  assert.equal(E.setLength(complete, 2, 0, 3), false); assert.equal(E.setLength(complete, 2, 0, 7), true);
  E.choose(complete, 2, 0, 'iron'); assert.equal(complete.lengths[2][0], null);
});
test('upset count follows the selected higher-numbered seed', () => {
  const state = E.createBracket(); E.choose(state, 0, 0, 'harbor'); E.choose(state, 0, 1, 'copper');
  assert.equal(E.upsetCount(state), 2); E.choose(state, 0, 0, 'gold'); assert.equal(E.upsetCount(state), 1);
});
test('confidence ranks swap uniquely and invalid ranks leave state unchanged', () => {
  const state = E.createFootball(); assert.equal(E.rankFootball(state, 0, 4), true);
  assert.deepEqual(state.ranks, [4, 2, 3, 1]);
  const before = JSON.stringify(state); assert.equal(E.rankFootball(state, 0, 5), false); assert.equal(E.rankFootball(state, -1, 2), false);
  assert.equal(JSON.stringify(state), before);
});
test('practice ATS covers use the spread and require a complete valid card', () => {
  const state = E.createFootball(); assert.equal(E.resolveFootball(state), null);
  ['harbor', 'summit', 'coast', 'metro'].forEach((id, i) => assert.equal(E.pickFootball(state, i, id), true));
  const result = E.resolveFootball(state); assert.equal(result.points, 10); assert.equal(result.max, 10);
  assert.equal(result.games[0].cover, 'harbor', 'winning outright by three does not cover −3.5');
  E.pickFootball(state, 0, 'gold'); assert.equal(E.resolveFootball(state).points, 9);
  assert.equal(E.pickFootball(state, 0, 'desert'), false);
});
test('combined crossover card needs four winners and legal series lengths', () => {
  const state = E.createCrossover(); assert.equal(E.crossoverComplete(state), false);
  assert.equal(E.lengthSeries(state, 0, 5), false); assert.equal(E.pickSeries(state, 0, 'desert'), false);
  E.series.forEach((series, i) => { E.pickSeries(state, i, series.a); assert.equal(E.lengthSeries(state, i, 3), false); E.lengthSeries(state, i, 7); });
  assert.equal(E.crossoverComplete(state), true);
  E.lengthSeries(state, 0, 8); assert.equal(state[0].length, 7);
});
test('fantasy decisions produce different deterministic practice outcomes', () => {
  const state = E.createFantasy(); assert.equal(E.resolveFantasy(state), null); assert.equal(E.startPlayer(state, 0, 'rb1'), false);
  E.roster.forEach((slot, i) => E.startPlayer(state, i, slot.options[0].id));
  assert.equal(E.resolveFantasy(state).points, 82); assert.equal(E.resolveFantasy(state).outcome, 'tie');
  E.startPlayer(state, 1, 'rb2'); E.startPlayer(state, 4, 'fx2');
  assert.equal(E.resolveFantasy(state).points, 96); assert.equal(E.resolveFantasy(state).outcome, 'win');
  E.roster.forEach((slot, i) => E.startPlayer(state, i, slot.options[1].id)); assert.equal(E.resolveFantasy(state).outcome, 'loss');
});
test('illustrative GPI is bounded, deterministic and rejects invalid inputs', () => {
  assert.equal(E.gpi([70, 60, 80]), 69); assert.equal(E.gpi([0, 0, 0]), 0); assert.equal(E.gpi([100, 100, 100]), 100);
  assert.equal(E.gpi([NaN, 0, 0]), null); assert.equal(E.gpi([101, 0, 0]), null); assert.equal(E.gpi([0, 0]), null);
});
