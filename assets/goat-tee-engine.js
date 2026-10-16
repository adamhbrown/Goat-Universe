/* Deterministic, dependency-free putting physics in 720 × 420 SVG coordinates. */
(function (root) {
  'use strict';
  const BALL_RADIUS = 8, MAX_PUTTS = 10, STEP = 1 / 120;
  const HOLES = [
    { name: 'The Welcome Green', par: 2, tee: { x: 110, y: 280 }, cup: { x: 580, y: 150 }, aim: -15, power: 65,
      tip: 'Find your touch. A little less power can go a long way.', obstacles: [], sand: [] },
    { name: "Captain's Bend", par: 3, tee: { x: 120, y: 300 }, cup: { x: 590, y: 110 }, aim: -38, power: 60,
      tip: 'The captain left a rock in the way. Go around it, or try a bank shot.',
      obstacles: [{ x: 345, y: 185, width: 48, height: 170 }], sand: [{ x: 440, y: 305, rx: 70, ry: 38 }] },
    { name: 'The Summit', par: 3, tee: { x: 110, y: 320 }, cup: { x: 600, y: 95 }, aim: -52, power: 60,
      tip: 'Two rocks. One cup. Go on, give Powder GOAT something to talk about.',
      obstacles: [{ x: 290, y: 190, width: 45, height: 150 }, { x: 445, y: 65, width: 45, height: 150 }],
      sand: [{ x: 545, y: 300, rx: 75, ry: 43 }, { x: 160, y: 105, rx: 55, ry: 30 }] },
  ];
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  function createHole(index = 0) {
    if (!Number.isInteger(index) || index < 0 || index >= HOLES.length) throw new RangeError('Unknown GOAT TEE hole');
    const hole = HOLES[index];
    return { index, ball: { x: hole.tee.x, y: hole.tee.y, vx: 0, vy: 0 }, putts: 0, phase: 'ready', elapsed: 0 };
  }
  function shoot(state, angle, power) {
    if (state.phase !== 'ready' || !Number.isFinite(angle) || !Number.isFinite(power)) return false;
    const radians = clamp(angle, -180, 180) * Math.PI / 180;
    const speed = clamp(power, 5, 100) * 6.5;
    state.ball.vx = Math.cos(radians) * speed; state.ball.vy = Math.sin(radians) * speed;
    state.putts += 1; state.phase = 'moving'; state.elapsed = 0;
    return true;
  }
  function collideRock(ball, rock) {
    const x = clamp(ball.x, rock.x, rock.x + rock.width), y = clamp(ball.y, rock.y, rock.y + rock.height);
    let dx = ball.x - x, dy = ball.y - y, distance = Math.hypot(dx, dy);
    if (distance >= BALL_RADIUS) return;
    if (distance === 0) {
      const edge = [
        { d: ball.x - rock.x, nx: -1, ny: 0 }, { d: rock.x + rock.width - ball.x, nx: 1, ny: 0 },
        { d: ball.y - rock.y, nx: 0, ny: -1 }, { d: rock.y + rock.height - ball.y, nx: 0, ny: 1 },
      ].sort((a, b) => a.d - b.d)[0];
      ball.x += edge.nx * (edge.d + BALL_RADIUS + .01); ball.y += edge.ny * (edge.d + BALL_RADIUS + .01);
      dx = edge.nx; dy = edge.ny; distance = 1;
    } else {
      ball.x += dx / distance * (BALL_RADIUS - distance + .01); ball.y += dy / distance * (BALL_RADIUS - distance + .01);
    }
    const nx = dx / distance, ny = dy / distance, dot = ball.vx * nx + ball.vy * ny;
    if (dot < 0) { ball.vx -= 1.75 * dot * nx; ball.vy -= 1.75 * dot * ny; }
  }
  function collideRails(ball) {
    if (ball.x < 44) { ball.x = 44; ball.vx = Math.abs(ball.vx) * .78; }
    if (ball.x > 676) { ball.x = 676; ball.vx = -Math.abs(ball.vx) * .78; }
    if (ball.y < 44) { ball.y = 44; ball.vy = Math.abs(ball.vy) * .78; }
    if (ball.y > 376) { ball.y = 376; ball.vy = -Math.abs(ball.vy) * .78; }
    const cx = ball.x < 84 ? 84 : ball.x > 636 ? 636 : ball.x;
    const cy = ball.y < 84 ? 84 : ball.y > 336 ? 336 : ball.y;
    if (cx === ball.x || cy === ball.y) return;
    const dx = ball.x - cx, dy = ball.y - cy, distance = Math.hypot(dx, dy);
    if (distance <= 40) return;
    const nx = dx / distance, ny = dy / distance;
    ball.x = cx + nx * 40; ball.y = cy + ny * 40;
    const dot = ball.vx * nx + ball.vy * ny;
    if (dot > 0) { ball.vx -= 1.78 * dot * nx; ball.vy -= 1.78 * dot * ny; }
  }
  function advance(state, dt = STEP) {
    if (state.phase !== 'moving' || !Number.isFinite(dt) || dt <= 0) return state;
    let remaining = Math.min(dt, .1);
    const hole = HOLES[state.index];
    while (remaining > 1e-8 && state.phase === 'moving') {
      const step = Math.min(STEP, remaining); remaining -= step;
      const ball = state.ball, speed = Math.hypot(ball.vx, ball.vy);
      const inSand = hole.sand.some(s => ((ball.x - s.x) / s.rx) ** 2 + ((ball.y - s.y) / s.ry) ** 2 < 1);
      const nextSpeed = Math.max(0, speed - (inSand ? 560 : 200) * step), ratio = speed > 0 ? nextSpeed / speed : 0;
      const vx = ball.vx * ratio, vy = ball.vy * ratio;
      ball.x += (ball.vx + vx) * .5 * step; ball.y += (ball.vy + vy) * .5 * step;
      ball.vx = vx; ball.vy = vy;
      collideRails(ball); hole.obstacles.forEach(rock => collideRock(ball, rock)); state.elapsed += step;
      if (Math.hypot(ball.x - hole.cup.x, ball.y - hole.cup.y) < 14 && Math.hypot(ball.vx, ball.vy) < 220) {
        ball.x = hole.cup.x; ball.y = hole.cup.y; ball.vx = 0; ball.vy = 0; state.phase = 'sunk';
      } else if (nextSpeed < .5 || state.elapsed >= 8) {
        ball.vx = 0; ball.vy = 0; state.phase = state.putts >= MAX_PUTTS ? 'limit' : 'ready';
      }
    }
    return state;
  }
  function finishShot(state) {
    for (let n = 0; state.phase === 'moving' && n < 1200; n += 1) advance(state, STEP);
    return state;
  }
  function aimAt(state, x, y) { return Math.round(Math.atan2(y - state.ball.y, x - state.ball.x) * 180 / Math.PI); }
  const api = Object.freeze({ BALL_RADIUS, MAX_PUTTS, STEP, HOLES, createHole, shoot, advance, finishShot, aimAt });
  root.GoatTeeEngine = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(globalThis);
