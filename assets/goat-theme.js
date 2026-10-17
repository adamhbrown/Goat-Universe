/* Founder-supplied official theme. Source is assigned only after a play action. */
(() => {
  'use strict';
  const audio = document.getElementById('goat-theme-audio');
  const button = document.getElementById('theme-play');
  const status = document.getElementById('theme-status');
  const lounge = document.getElementById('theme-lounge');
  if (!audio || !button) return;
  function update() {
    const playing = !audio.paused && !audio.ended;
    button.innerHTML = playing ? 'PAUSE THE THEME <span aria-hidden="true">Ⅱ</span>' : 'PLAY THE OFFICIAL THEME <span aria-hidden="true">▶</span>';
    button.setAttribute('aria-pressed', String(playing));
    lounge.classList.toggle('is-playing', playing);
    status.textContent = playing ? 'Now playing: GOATUNIVERSE — Official Theme.' : 'Sound is your call. Press play to listen.';
    window.dispatchEvent(new CustomEvent('goat-theme-state', { detail: { playing } }));
  }
  async function play() {
    if (!audio.getAttribute('src')) audio.src = audio.dataset.src;
    audio.hidden = false; audio.volume = .55;
    try { await audio.play(); update(); return true; }
    catch { update(); status.textContent = 'Playback is unavailable here. Try the native audio play control.'; return false; }
  }
  function pause() { audio.pause(); update(); }
  button.addEventListener('click', () => { if (audio.paused) play(); else pause(); });
  ['play', 'pause', 'ended'].forEach(event => audio.addEventListener(event, update));
  audio.addEventListener('error', () => {
    status.textContent = 'The theme could not load. You can keep exploring GOATVILLE.';
    button.setAttribute('aria-pressed', 'false'); lounge.classList.remove('is-playing');
    window.dispatchEvent(new CustomEvent('goat-theme-state', { detail: { playing: false } }));
  });
  globalThis.GoatTheme = { play, pause, get playing() { return !audio.paused && !audio.ended; } };
})();
