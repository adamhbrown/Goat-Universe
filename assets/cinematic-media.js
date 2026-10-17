/* Reusable, opt-in arrival media. No media download or sound before a user action. */
(() => {
  'use strict';
  class GoatCinema {
    constructor(container) {
      this.container = container;
      this.dialog = container.closest('dialog');
      this.video = container.querySelector('[data-cinema-video]');
      this.line = container.querySelector('[data-cinema-line]');
      this.status = container.querySelector('[data-cinema-status]');
      this.progress = container.querySelector('[data-cinema-progress]');
      this.soundButton = container.querySelector('[data-cinema-sound]');
      this.duration = Math.max(1, Math.min(15, Number(container.dataset.duration) || 8));
      this.motion = matchMedia('(prefers-reduced-motion: reduce)');
      this.frame = 0; this.audio = null; this.sounding = false; this.running = false;
      this.source = container.dataset.videoSrc || '';
      container.querySelector('[data-cinema-close]')?.addEventListener('click', () => this.close());
      container.querySelector('[data-cinema-skip]')?.addEventListener('click', () => this.close(true));
      container.querySelector('[data-cinema-replay]')?.addEventListener('click', () => this.start());
      this.soundButton?.addEventListener('click', () => this.toggleSound());
      this.dialog?.addEventListener('close', () => this.stop());
      this.dialog?.addEventListener('cancel', () => this.stop());
      this.video?.addEventListener('error', () => this.fallback('The video is unavailable. The original visual study is ready instead.'));
      this.video?.addEventListener('ended', () => this.finish());
      this.motion.addEventListener('change', () => { if (this.motion.matches) this.finish(); });
      document.addEventListener('visibilitychange', () => { if (document.hidden && this.running) this.finish(); });
      container.goatCinema = this;
    }
    open(trigger) {
      this.trigger = trigger;
      if (this.dialog && typeof this.dialog.showModal === 'function') this.dialog.showModal();
      else if (this.dialog) this.dialog.setAttribute('open', '');
      document.body.classList.add('cinema-open');
      globalThis.GoatTheme?.pause();
      this.start();
    }
    start() {
      cancelAnimationFrame(this.frame); this.running = true;
      this.container.classList.remove('is-finished');
      this.container.classList.toggle('is-reduced', this.motion.matches);
      this.container.classList.add('is-running');
      this.status.textContent = this.motion.matches ? 'Still-frame arrival. Enter the universe whenever you’re ready.' : 'Original 8-second visual study. Skip at any time.';
      this.progress.style.width = '0%';
      if (this.motion.matches) { this.finish(); return; }
      if (this.source && this.video) {
        // Set data-video-src only after the asset and its commercial clearance are verified.
        this.video.src = this.source; this.video.controls = true; this.video.muted = !this.sounding;
        this.video.hidden = false; this.video.currentTime = 0;
        const captions = this.container.dataset.captionsSrc;
        if (captions && !this.video.querySelector('track')) {
          const track = document.createElement('track'); track.kind = 'captions'; track.label = 'English'; track.srclang = 'en'; track.src = captions; track.default = true; this.video.append(track);
        }
        this.video.play()?.catch(() => {
          if (this.video.error) this.fallback('The video is unavailable. The original visual study is ready instead.');
          else this.status.textContent = 'Playback is paused. Use the video play control, or enter the universe now.';
        });
      }
      this.started = performance.now();
      const tick = now => {
        if (!this.running) return;
        const elapsed = (now - this.started) / 1000;
        this.progress.style.width = `${Math.min(100, elapsed / this.duration * 100)}%`;
        const copy = elapsed < 2.6 ? 'SPORTS ARE<br>THE FRONT DOOR.' : elapsed < 5.2 ? 'GREATNESS<br>LIVES HERE.' : 'WHERE THE<br>GOATS PLAY.';
        if (this.line.innerHTML !== copy) this.line.innerHTML = copy;
        if (elapsed >= this.duration) this.finish(); else this.frame = requestAnimationFrame(tick);
      };
      this.frame = requestAnimationFrame(tick);
      if (this.sounding && !this.source) {
        if (globalThis.GoatTheme) { this.usingTheme = true; globalThis.GoatTheme.play(); } else this.playTones();
      }
    }
    fallback(message) {
      if (this.video) { this.video.pause(); this.video.hidden = true; }
      this.status.textContent = message;
      this.container.classList.add('has-fallback');
    }
    finish() {
      this.running = false; cancelAnimationFrame(this.frame);
      this.video?.pause(); this.stopAudio();
      this.container.classList.remove('is-running'); this.container.classList.add('is-finished');
      this.progress.style.width = '100%'; this.line.innerHTML = 'WHERE THE<br>GOATS PLAY.';
      this.status.textContent = this.motion.matches ? 'Reduced motion is on. Your universe is ready.' : 'Your universe is ready. Enter now or replay the arrival.';
    }
    stopAudio() {
      if (this.audio) { this.audio.close().catch(() => {}); this.audio = null; }
      if (this.usingTheme) { globalThis.GoatTheme?.pause(); this.usingTheme = false; }
    }
    stop() {
      this.running = false; cancelAnimationFrame(this.frame); this.video?.pause(); this.stopAudio();
      this.sounding = false; this.updateSound(); this.container.classList.remove('is-running'); document.body.classList.remove('cinema-open');
    }
    close(enter = false) {
      this.stop();
      if (this.dialog && typeof this.dialog.close === 'function') this.dialog.close(); else this.dialog?.removeAttribute('open');
      if (enter) {
        const target = document.getElementById('universe');
        target?.focus({ preventScroll: true }); target?.scrollIntoView({ behavior: this.motion.matches ? 'instant' : 'smooth' });
        history.replaceState(null, '', '#universe');
      } else this.trigger?.focus({ preventScroll: true });
    }
    updateSound() {
      this.soundButton.textContent = this.sounding ? 'SOUND ON ◉' : 'SOUND OFF ◌';
      this.soundButton.setAttribute('aria-pressed', String(this.sounding));
    }
    toggleSound() {
      this.sounding = !this.sounding;
      if (this.video && this.source) this.video.muted = !this.sounding;
      else if (this.sounding && globalThis.GoatTheme) {
        this.usingTheme = true;
        globalThis.GoatTheme.play().then(played => {
          if (!this.usingTheme || (this.dialog && !this.dialog.open)) { globalThis.GoatTheme.pause(); return; }
          this.sounding = played; this.updateSound();
          if (!played) this.status.textContent = 'The theme is unavailable here. Your universe is still ready.';
        });
      } else if (this.sounding) this.playTones(); else this.stopAudio();
      this.updateSound();
    }
    playTones() {
      this.stopAudio();
      const Audio = window.AudioContext || window.webkitAudioContext;
      if (!Audio) { this.sounding = false; this.status.textContent = 'Sound is unavailable in this browser. Enjoy the visual arrival.'; this.updateSound(); return; }
      try {
        const context = new Audio(); this.audio = context;
        context.resume().catch(() => {});
        // An original, restrained three-note arrival cue; not a recording or licensed song.
        [146.83, 220, 293.66].forEach((frequency, i) => {
          const oscillator = context.createOscillator(), gain = context.createGain();
          oscillator.type = 'sine'; oscillator.frequency.value = frequency;
          const begin = context.currentTime + i * .55;
          gain.gain.setValueAtTime(0, begin); gain.gain.linearRampToValueAtTime(.035, begin + .15); gain.gain.exponentialRampToValueAtTime(.0001, begin + 1.7);
          oscillator.connect(gain); gain.connect(context.destination); oscillator.start(begin); oscillator.stop(begin + 1.8);
        });
      } catch { this.sounding = false; this.status.textContent = 'Sound is unavailable. The visual arrival is ready.'; this.updateSound(); }
    }
  }
  document.querySelectorAll('[data-cinematic]').forEach(container => new GoatCinema(container));
  document.querySelectorAll('[data-open-cinema]').forEach(trigger => trigger.addEventListener('click', () => {
    document.getElementById(trigger.dataset.openCinema)?.querySelector('[data-cinematic]')?.goatCinema?.open(trigger);
  }));
  globalThis.GoatCinema = GoatCinema;
})();
