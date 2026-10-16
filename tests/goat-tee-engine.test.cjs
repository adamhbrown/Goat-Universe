const assert = require('node:assert/strict');
const { test } = require('node:test');
const E = require('../assets/goat-tee-engine.js');
test('shots consume one putt, reject duplicate input and settle on the green', () => {
  const state = E.createHole(); assert.equal(E.shoot(state, 0, 50), true); assert.equal(E.shoot(state, 0, 50), false);
  E.finishShot(state); assert.equal(state.putts, 1); assert.equal(state.phase, 'ready'); assert.ok(state.ball.x > 300); assert.equal(state.ball.y, 280);
});
test('a deliberate direct putt can sink the first cup', () => {
  const state = E.createHole(); E.shoot(state, -15, 68); E.finishShot(state);
  assert.equal(state.phase, 'sunk'); assert.equal(state.putts, 1); assert.deepEqual({ x: state.ball.x, y: state.ball.y }, E.HOLES[0].cup);
  assert.equal(E.shoot(state, 0, 50), false);
});
test('rails reflect shots and rocks block a direct path', () => {
  const rail = E.createHole(); E.shoot(rail, 180, 100); E.advance(rail, .1); E.advance(rail, .1); assert.ok(rail.ball.vx > 0);
  const rock = E.createHole(1); E.shoot(rock, 0, 65); E.finishShot(rock); assert.ok(rock.ball.x < 337); assert.equal(rock.phase, 'ready');
});
test('sand shortens an otherwise identical shot', () => {
  const grass = E.createHole(1), sand = E.createHole(1);
  Object.assign(grass.ball, { x: 410, y: 250 }); Object.assign(sand.ball, { x: 410, y: 305 });
  E.shoot(grass, 0, 40); E.shoot(sand, 0, 40); E.finishShot(grass); E.finishShot(sand); assert.ok(sand.ball.x < grass.ball.x - 20);
});
test('ten missed putts finish a hole honestly as unfinished', () => {
  const state = E.createHole();
  for (let i = 0; i < 10; i++) { E.shoot(state, 180, 5); E.finishShot(state); }
  assert.equal(state.phase, 'limit'); assert.equal(state.putts, 10); assert.equal(E.shoot(state, 0, 50), false);
});
test('invalid shot inputs do not corrupt the round', () => {
  const state = E.createHole(); assert.equal(E.shoot(state, NaN, 50), false); assert.equal(E.shoot(state, 0, Infinity), false);
  assert.equal(state.putts, 0); assert.throws(() => E.createHole(3), RangeError); assert.throws(() => E.createHole(-1), RangeError);
});
test('identical shots settle consistently at different animation frame sizes', () => {
  const a = E.createHole(2), b = E.createHole(2); E.shoot(a, -60, 70); E.shoot(b, -60, 70);
  while (a.phase === 'moving') E.advance(a, 1 / 60); while (b.phase === 'moving') E.advance(b, 1 / 30);
  assert.ok(Math.abs(a.ball.x - b.ball.x) < .01); assert.ok(Math.abs(a.ball.y - b.ball.y) < .01);
});
test('both obstacle courses have reproducible playable routes to the cup', () => {
  const routes = [[1, [[-31,56],[-6,43]]], [2, [[-40,60],[90,50],[-51,55]]]];
  for (const [index, shots] of routes) {
    const state = E.createHole(index);
    for (const [angle, power] of shots) { assert.equal(E.shoot(state, angle, power), true); E.finishShot(state); }
    assert.equal(state.phase, 'sunk'); assert.equal(state.putts, shots.length);
  }
});
