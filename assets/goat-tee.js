/* Browser-local, just-for-fun play. No network, accounts, storage or official scoring. */
(() => {
  'use strict';
  const engine = globalThis.GoatTeeEngine, game = document.getElementById('tee-game');
  if (!engine || !game) return;
  const byId = id => document.getElementById(id);
  const svg = byId('tee-course'), putt = byId('tee-putt'), next = byId('tee-next'), restart = byId('tee-restart');
  const inputs = byId('tee-inputs'), aim = byId('tee-aim'), power = byId('tee-power'), status = byId('tee-status');
  const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let state = engine.createHole(), scores = [], playing = false, frame = 0, lastTime = 0, accumulator = 0;
  function element(name, attributes) {
    const node = document.createElementNS('http://www.w3.org/2000/svg', name);
    Object.entries(attributes).forEach(([key, value]) => node.setAttribute(key, value)); return node;
  }
  const total = () => scores.reduce((sum, score) => sum + score.putts, 0) + (scores[state.index] ? 0 : state.putts);
  function draw() {
    const { x, y } = state.ball;
    ['tee-ball', 'tee-ball-ring', 'tee-ball-shadow'].forEach(id => {
      byId(id).setAttribute('cx', x.toFixed(2)); byId(id).setAttribute('cy', (y + (id === 'tee-ball-shadow' ? 3 : 0)).toFixed(2));
      byId(id).setAttribute('visibility', state.phase === 'sunk' ? 'hidden' : 'visible');
    });
    const angle = Number(aim.value) * Math.PI / 180, length = 45 + Number(power.value) * 1.8;
    byId('tee-aim-line').setAttribute('d', `M${x} ${y}l${Math.cos(angle) * length} ${Math.sin(angle) * length}`);
    byId('tee-aim-line').setAttribute('visibility', playing && state.phase === 'ready' ? 'visible' : 'hidden');
    byId('tee-aim-value').textContent = `${Number(aim.value) < 0 ? '−' : ''}${Math.abs(Number(aim.value))}°`;
    byId('tee-power-value').textContent = `${power.value}%`; byId('tee-total').textContent = total();
    game.dataset.phase = playing ? state.phase : 'idle';
  }
  function describeCourse() {
    const { x, y } = state.ball, hole = engine.HOLES[state.index];
    byId('course-description').textContent = `${hole.name}. Ball at ${Math.round(x)}, ${Math.round(y)}. Cup at ${hole.cup.x}, ${hole.cup.y}. ${state.putts} putts. Aim with the sliders, or tap the green. Then press Putt.`;
  }
  function drawCourse() {
    const hole = engine.HOLES[state.index];
    byId('tee-hole-number').textContent = `HOLE ${String(state.index + 1).padStart(2, '0')} / 03`;
    byId('tee-hole-name').textContent = hole.name; byId('course-title').textContent = `GOAT TEE — ${hole.name}`;
    byId('tee-par').textContent = hole.par; byId('tee-course-hint').textContent = hole.tip;
    byId('tee-cup').setAttribute('transform', `translate(${hole.cup.x} ${hole.cup.y})`);
    const obstacles = byId('tee-obstacles'); obstacles.replaceChildren();
    hole.sand.forEach(sand => obstacles.append(element('ellipse', { cx: sand.x, cy: sand.y, rx: sand.rx, ry: sand.ry, fill: 'url(#sand-dots)', stroke: '#d0bb83', 'stroke-width': 2 })));
    hole.obstacles.forEach(rock => {
      obstacles.append(element('rect', { x: rock.x + 4, y: rock.y + 6, width: rock.width, height: rock.height, rx: 5, fill: '#071b1677' }));
      obstacles.append(element('rect', { ...rock, rx: 5, fill: '#697060', stroke: '#abb298', 'stroke-width': 2 }));
      obstacles.append(element('path', { d: `M${rock.x + 8} ${rock.y + 10}h${rock.width - 16}M${rock.x + 8} ${rock.y + 10}v${rock.height - 20}`, fill: 'none', stroke: '#c9cfac', 'stroke-opacity': '.4', 'stroke-width': 2 }));
    });
    document.querySelectorAll('.tee-scorecard li').forEach((row, i) => row.classList.toggle('is-current', i === state.index));
    aim.value = hole.aim; power.value = hole.power; describeCourse(); draw();
  }
  function begin() {
    cancelAnimationFrame(frame); state = engine.createHole(); scores = []; playing = true;
    game.classList.add('is-playing'); game.classList.remove('is-complete'); byId('tee-ready').hidden = true;
    inputs.hidden = false; inputs.disabled = false; next.hidden = true; restart.hidden = false; putt.textContent = 'PUTT ↗';
    [1, 2, 3].forEach(i => { byId(`tee-score-${i}`).textContent = '—'; });
    status.textContent = 'Your green. Aim, set your power, then putt. Sink all three holes!';
    drawCourse(); putt.focus({ preventScroll: true });
  }
  function finishHole() {
    const sunk = state.phase === 'sunk'; scores[state.index] = { putts: state.putts, sunk };
    byId(`tee-score-${state.index + 1}`).textContent = sunk ? String(state.putts) : `${state.putts}*`;
    inputs.disabled = true; inputs.hidden = true; next.hidden = false;
    if (state.index === engine.HOLES.length - 1) {
      const completed = scores.filter(score => score.sunk).length, sum = total(), par = engine.HOLES.reduce((v, h) => v + h.par, 0);
      status.textContent = completed < 3 ? `${completed} of 3 cups sunk in ${sum} putts. * marks a 10-putt limit. The green wants a rematch.`
        : `All 3 cups sunk in ${sum} putts. ${sum === par ? 'Right on par' : sum < par ? `${par - sum} under par` : `${sum - par} over par`}. ${sum <= par ? 'Billy GOAT is taking notes.' : 'A very respectable detour.'}`;
      game.classList.add('is-complete'); next.textContent = 'PLAY AGAIN ↻'; restart.hidden = true;
    } else {
      status.textContent = sunk ? `${state.putts === 1 ? 'HOLE IN ONE!' : 'In the cup!'} ${state.putts} ${state.putts === 1 ? 'putt' : 'putts'}. ${state.index === 0 ? 'Captain GOAT has a little challenge next.' : 'The Summit is calling.'}`
        : '10-putt limit reached. This hole is marked unfinished (*). A fresh green is waiting.';
      next.textContent = 'NEXT HOLE ↗';
    }
    describeCourse(); draw(); next.focus({ preventScroll: true });
  }
  function finishShot() {
    if (state.phase === 'sunk' || state.phase === 'limit') finishHole();
    else {
      inputs.disabled = false; putt.textContent = 'PUTT AGAIN ↗';
      const hole = engine.HOLES[state.index], distance = Math.round(Math.hypot(state.ball.x - hole.cup.x, state.ball.y - hole.cup.y));
      status.textContent = `${state.putts} ${state.putts === 1 ? 'putt' : 'putts'}. ${distance < 80 ? 'You’re close. A gentle tap might do it.' : 'Find your line and give it another go.'}`;
      describeCourse(); draw();
    }
  }
  function animate(time) {
    if (!playing || state.phase !== 'moving') return;
    accumulator += Math.min((time - lastTime) / 1000, .05); lastTime = time;
    while (accumulator >= engine.STEP && state.phase === 'moving') { engine.advance(state, engine.STEP); accumulator -= engine.STEP; }
    draw(); if (state.phase === 'moving') frame = requestAnimationFrame(animate); else finishShot();
  }
  function shoot() {
    if (!playing || !engine.shoot(state, Number(aim.value), Number(power.value))) return;
    inputs.disabled = true; putt.textContent = 'BALL IN MOTION…'; status.textContent = 'Rolling…'; draw();
    if (motion.matches) { engine.finishShot(state); finishShot(); }
    else { accumulator = 0; lastTime = performance.now(); frame = requestAnimationFrame(animate); }
  }
  byId('tee-start').addEventListener('click', begin); restart.addEventListener('click', begin); putt.addEventListener('click', shoot);
  next.addEventListener('click', () => {
    if (state.index === engine.HOLES.length - 1) { begin(); return; }
    state = engine.createHole(state.index + 1); inputs.hidden = false; inputs.disabled = false; next.hidden = true; putt.textContent = 'PUTT ↗';
    status.textContent = engine.HOLES[state.index].tip; drawCourse(); putt.focus({ preventScroll: true });
  });
  [aim, power].forEach(input => input.addEventListener('input', draw));
  svg.addEventListener('click', event => {
    if (!playing || state.phase !== 'ready') return;
    const rect = svg.getBoundingClientRect();
    aim.value = engine.aimAt(state, (event.clientX - rect.left) / rect.width * 720, (event.clientY - rect.top) / rect.height * 420); draw();
  });
  function settleMotion() { if (state.phase === 'moving') { cancelAnimationFrame(frame); engine.finishShot(state); finishShot(); } }
  document.addEventListener('visibilitychange', () => { if (document.hidden) settleMotion(); });
  motion.addEventListener('change', () => { if (motion.matches) settleMotion(); });
  drawCourse();
})();
