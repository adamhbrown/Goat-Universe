import {mountGuestGame} from './host.mjs';
import {createGuestJournal} from './protocol.mjs';
const $ = id => document.getElementById(id);
const spec = {id:'integration-test',version:1,title:'Guest challenge test',achievements:['first-test']};
let journal = createGuestJournal(), game;
const render = () => {
  $('stamps').replaceChildren(...journal.list().map(s => {
    const li = document.createElement('li'); li.textContent = `${s.attraction}: ${s.achievement} (local, unverified)`; return li;
  }));
};
$('persist').addEventListener('change', () => {
  const current = journal.list();
  // Avoid reading localStorage at all until the guest chooses persistence.
  let storage;
  if ($('persist').checked) { try { storage = window.localStorage; } catch { /* Private mode fallback. */ } }
  const cleared = $('persist').checked || journal.clear();
  journal = createGuestJournal({storage, persist:$('persist').checked});
  let saved = false;
  for (const stamp of current) saved = journal.record(stamp).persisted;
  render();
  $('status').textContent = !cleared ? 'Memory mode enabled. Previous device storage could not be cleared.' :
    $('persist').checked ? (current.length && !saved ? 'Device storage unavailable; guest stamps stay in memory.' : 'Remembering guest stamps on this device is enabled.') : 'Guest stamps stay in memory; saved device stamps were cleared.';
});
$('start').addEventListener('click', () => {
  game?.destroy();
  game = mountGuestGame({container:$('game'), attraction:spec, entryURL:new URL('./challenge.html', import.meta.url), onAchievement(stamp) {
    const result = journal.record(stamp); render();
    $('status').textContent = result.persisted ? 'Unverified guest stamp saved on this device.' : 'Unverified guest stamp kept in memory.';
  }});
  $('status').textContent = 'Test challenge running.';
});
$('stop').addEventListener('click', () => { game?.destroy(); game = null; $('status').textContent = 'Challenge stopped.'; });
$('clear').addEventListener('click', () => { const cleared = journal.clear(); render(); $('status').textContent = cleared ? 'Guest stamps cleared.' : 'Memory cleared. Device storage is unavailable.'; });
window.addEventListener('pagehide', () => game?.destroy());
