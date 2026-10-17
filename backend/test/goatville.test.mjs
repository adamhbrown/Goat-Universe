import test from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {CHANNEL, createGuestSession, createGuestJournal, validateAttraction} from '../goatville/protocol.mjs';
import {mountGuestGame} from '../goatville/host.mjs';

const attraction = {id:'test-game', version:1, title:'Guest test', achievements:['first','second']};
const session = 'a'.repeat(32), source = {};
const message = changes => ({channel:CHANNEL, session, attraction:'test-game', version:1, sequence:1, type:'achievement', achievement:'first', ...changes});
const event = (changes = {}, envelope = {}) => ({source, origin:'null', data:message(changes), ...envelope});
const stamp = changes => ({attraction:'test-game', version:1, achievement:'first', observed_at:1234, verification:'local-unverified', ...changes});

test('guest protocol rejects wrong window, origin, nonce, version and competition authority fields', () => {
  const gate = createGuestSession({attraction, source, session, now:() => 1234});
  for (const e of [event({}, {source:{}}), event({}, {origin:'https://example.test'}),
    event({session:'b'.repeat(32)}), event({version:2}), event({attraction:'other'}), event({score:100}),
    event({baas:100}), event({gpi:99}), event({type:'official-result'}), event({achievement:'forged'}),
    event({sequence:NaN}), event({sequence:0}), event({sequence:1e20}), event({}, {data:null})])
    assert.equal(gate.accept(e), null);
  assert.deepEqual(gate.accept(event()), stamp());
});

test('guest completion is deduplicated, ordered and revoked on teardown', () => {
  const gate = createGuestSession({attraction, source, session});
  assert.ok(gate.accept(event()));
  assert.equal(gate.accept(event()), null);
  assert.equal(gate.accept(event({sequence:2})), null);
  assert.equal(gate.accept(event({sequence:1, achievement:'second'})), null);
  assert.ok(gate.accept(event({sequence:3, achievement:'second'})));
  gate.close(); assert.equal(gate.accept(event({sequence:4})), null);
});

test('attraction catalog validates strict IDs, sizes, unique awards and immutable snapshots', () => {
  for (const changes of [{id:'../escape'},{id:'<script>'},{version:0},{title:''},
    {achievements:['first','first']},{achievements:Array(17).fill('first')},{official:true}])
    assert.throws(() => validateAttraction({...attraction,...changes}), /invalid_attraction/);
  const copy = validateAttraction(attraction);
  assert.ok(Object.isFrozen(copy)); assert.ok(Object.isFrozen(copy.achievements));
  assert.throws(() => createGuestSession({attraction, source, session:'short'}), /invalid_session/);
});

test('guest memory mode never reads or writes browser storage', () => {
  let reads=0,writes=0;
  const storage = {getItem(){reads++;throw new Error('must not read');}, setItem(){writes++;throw new Error('must not write');}};
  const journal = createGuestJournal({storage});
  assert.equal(journal.record(stamp()).persisted, false);
  const list = journal.list(); list[0].achievement='tampered';
  assert.equal(journal.list()[0].achievement,'first');
  assert.throws(() => journal.record(stamp({verification:'official'})), /invalid_guest_stamp/);
  assert.throws(() => journal.record({...stamp(),baas:50}), /invalid_guest_stamp/);
  assert.equal(reads,0); assert.equal(writes,0);
});

test('opt-in journal survives reload, deduplicates, caps history and clears its own key', () => {
  const items = new Map([['unrelated','preserved']]);
  const storage = {getItem:key => items.get(key), setItem:(key,value) => items.set(key,value), removeItem:key => items.delete(key)};
  const journal = createGuestJournal({storage, persist:true});
  assert.equal(journal.record(stamp()).persisted,true);
  journal.record(stamp()); assert.equal(journal.list().length,1);
  for (let i=1;i<=110;i++) journal.record(stamp({version:i}));
  assert.equal(journal.list().length,100);
  const restored = createGuestJournal({storage, persist:true});
  assert.deepEqual(restored.list(),journal.list());
  assert.equal(restored.clear(),true); assert.deepEqual(restored.list(),[]);
  assert.deepEqual([...items],[['unrelated','preserved']]);
});

test('corrupt and unavailable storage fail to empty memory without network or authority', () => {
  for (const raw of ['{','x'.repeat(32769),JSON.stringify({version:99,stamps:[stamp()]}),
    JSON.stringify({version:1,stamps:[stamp({verification:'official'})]}),
    JSON.stringify({version:1,stamps:[stamp(),stamp()]})]) {
    const journal = createGuestJournal({persist:true, storage:{getItem:() => raw}});
    assert.deepEqual(journal.list(),[]);
    assert.equal(journal.record(stamp()).persisted,false);
  }
  const blocked = createGuestJournal({persist:true,storage:{getItem(){throw new Error('private');},removeItem(){throw new Error('private');}}});
  assert.equal(blocked.record(stamp()).persisted,false); assert.equal(blocked.clear(),false);
});

const reviewedGame = {id:'integration-test', version:1, title:'Guest challenge test', achievements:['first-test']};

test('host rejects every unreviewed same-origin page and unauthorized game metadata', () => {
  const dom = new JSDOM('<main></main>',{url:'https://guest.example/goatville/demo.html'}), w=dom.window;
  const container=w.document.querySelector('main');
  const attempt = (attraction, entryURL) => mountGuestGame({container, attraction, entryURL, windowImpl:w});
  for (const entryURL of [
    'https://evil.test/challenge.html', 'javascript:alert(1)', './challenge.html?token=secret',
    './challenge.html#fragment', './script.js', './private.html',
    '/challenge.html', '/backend/goatville/challenge.html', './nested/challenge.html'
  ]) assert.throws(() => attempt(reviewedGame, entryURL), /invalid_game_entry/);
  for (const altered of [
    {id:'test-game'}, {version:2}, {title:'Visitor-controlled title'},
    {achievements:['unexpected']}, {achievements:['first-test','extra']}
  ]) assert.throws(() => attempt({...reviewedGame,...altered}, './challenge.html'), /unreviewed_game/);
  assert.equal(container.children.length, 0);
  dom.window.close();
});

test('reviewed fixture mounts in a strict sandbox, accepts only valid guest stamps and revokes on teardown', () => {
  const dom = new JSDOM('<main></main>',{url:'https://guest.example/goatville/demo.html'}), w=dom.window;
  const container=w.document.querySelector('main');
  const received=[];
  const host=mountGuestGame({container,attraction:reviewedGame,entryURL:'./challenge.html',
    windowImpl:w,onAchievement:s => received.push(s)});
  assert.equal(host.frame.getAttribute('sandbox'),'allow-scripts');
  assert.equal(host.frame.title,'Guest challenge test');
  assert.equal(host.frame.getAttribute('referrerpolicy'),'no-referrer');
  assert.equal(host.frame.src,'https://guest.example/goatville/challenge.html');
  let init;
  host.frame.contentWindow.postMessage = m => { init=m; };
  host.frame.dispatchEvent(new w.Event('load'));
  assert.equal(init.type,'init'); assert.equal(init.reducedMotion,false);
  const data={channel:CHANNEL,session:init.session,attraction:'integration-test',
    version:1,sequence:1,type:'achievement',achievement:'first-test'};
  w.dispatchEvent(new w.MessageEvent('message',{source:host.frame.contentWindow,origin:'null',data}));
  assert.equal(received.length,1);
  assert.equal(received[0].verification,'local-unverified');
  host.destroy(); host.destroy();
  assert.equal(container.children.length,0);
  w.dispatchEvent(new w.MessageEvent('message',{source:host.frame.contentWindow,origin:'null',data}));
  assert.equal(received.length,1); dom.window.close();
});

test('catalog entry resolution honors a hosted app path prefix but not lookalike HTML', () => {
  const dom = new JSDOM('<main></main>',{url:'https://guest.example/Goat-Universe/backend/goatville/demo.html'});
  const w=dom.window, container=w.document.querySelector('main');
  const game=mountGuestGame({container,attraction:reviewedGame,entryURL:'./challenge.html',windowImpl:w});
  assert.equal(game.frame.src,'https://guest.example/Goat-Universe/backend/goatville/challenge.html');
  game.destroy();
  assert.throws(() => mountGuestGame({container,attraction:reviewedGame,
    entryURL:'../../other/challenge.html',windowImpl:w}),/invalid_game_entry/);
  dom.window.close();
});
