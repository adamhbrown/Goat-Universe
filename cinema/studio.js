/* GOATVILLE Cinematic Screening Room.
   All media is selected by the visitor and remains in-memory on this device.
   There are no uploads, analytics, network calls, storage writes, or autoplay. */
(() => {
  'use strict';

  const byId = id => document.getElementById(id);
  const video = byId('screen-video');
  const music = byId('studio-music');
  const videoInput = byId('video-file');
  const audioInput = byId('audio-file');
  const playButton = byId('play');
  const pauseButton = byId('pause');
  const restartButton = byId('restart');
  const soundButton = byId('sound');
  const stage = document.querySelector('.stage-media');
  const progress = byId('progress');
  const timecode = byId('timecode');
  const feedback = byId('feedback');

  const resources = { video: null, audio: null };
  let soundEnabled = false;
  let loading = false;

  const announce = message => { feedback.textContent = message; };
  const hasVideo = () => Boolean(resources.video);
  const hasAudio = () => Boolean(resources.audio);
  const supportedFile = (file, kind) =>
    Boolean(file && typeof file.name === 'string' &&
      (file.type.startsWith(kind + '/') ||
       (kind === 'video' && /\.(mp4|m4v|mov|webm|ogv)$/i.test(file.name)) ||
       (kind === 'audio' && /\.(mp3|wav|aac|m4a|ogg|oga|flac)$/i.test(file.name))));

  function release(kind) {
    const url = resources[kind];
    if (url) URL.revokeObjectURL(url);
    resources[kind] = null;
  }

  function clock(seconds) {
    if (!Number.isFinite(seconds) || seconds < 0) return '00:00';
    const n = Math.floor(seconds);
    const minutes = String(Math.floor(n / 60)).padStart(2, '0');
    const secs = String(n % 60).padStart(2, '0');
    return minutes + ':' + secs;
  }

  function updateProgress() {
    const duration = video.duration;
    const pct = Number.isFinite(duration) && duration > 0
      ? Math.max(0, Math.min(100, Math.round(video.currentTime / duration * 100))) : 0;
    progress.style.width = pct + '%';
    progress.setAttribute('aria-valuenow', String(pct));
    timecode.textContent = clock(video.currentTime);
    if (hasAudio() && soundEnabled && !video.paused && !music.paused &&
        Number.isFinite(music.duration) && music.currentTime < music.duration &&
        Math.abs(music.currentTime - video.currentTime) > 0.35) {
      try { music.currentTime = Math.min(video.currentTime, music.duration); } catch { /* Leave playback usable. */ }
    }
  }

  function updateButtons() {
    const ready = hasVideo() && !loading;
    playButton.disabled = !ready || !video.paused && !video.ended;
    pauseButton.disabled = !ready || video.paused || video.ended;
    restartButton.disabled = !ready;
    soundButton.disabled = !ready;
    soundButton.setAttribute('aria-pressed', String(soundEnabled));
    soundButton.textContent = soundEnabled ? 'SOUND ON' : 'SOUND OFF';
    // Separate uploaded music replaces any video soundtrack.
    video.muted = !soundEnabled || hasAudio();
  }

  function pausePlayback() {
    video.pause();
    music.pause();
    updateButtons();
  }

  function clearResource(kind) {
    pausePlayback();
    const element = kind === 'video' ? video : music;
    element.removeAttribute('src');
    element.load();
    release(kind);
    if (kind === 'video') {
      stage.classList.remove('has-video');
      loading = false;
    }
    updateButtons();
    updateProgress();
  }

  function assignFile(kind, file) {
    if (!supportedFile(file, kind)) {
      announce('Please choose a browser-supported ' + kind + ' file.');
      return;
    }
    clearResource(kind);
    try {
      const url = URL.createObjectURL(file);
      resources[kind] = url;
      const element = kind === 'video' ? video : music;
      element.src = url;
      element.load();
      if (kind === 'video') {
        stage.classList.add('has-video');
        loading = true;
      }
      updateButtons();
      announce((kind === 'video' ? 'Video' : 'Soundtrack') +
        ' selected locally: ' + file.name + '. Nothing has been uploaded.');
    } catch {
      announce('Your browser could not open that media file. Try another supported format.');
      clearResource(kind);
    }
  }

  videoInput.addEventListener('change', () => {
    if (videoInput.files?.[0]) assignFile('video', videoInput.files[0]);
  });
  audioInput.addEventListener('change', () => {
    if (audioInput.files?.[0]) assignFile('audio', audioInput.files[0]);
  });

  video.addEventListener('loadedmetadata', () => {
    loading = false;
    updateButtons();
    updateProgress();
    announce('Video ready. Sound is ' + (soundEnabled ? 'enabled' : 'off') +
      '. Choose Play Cinematic when ready.');
  });

  video.addEventListener('canplay', () => {
    if (loading) {
      loading = false;
      updateButtons();
    }
  });

  video.addEventListener('error', () => {
    loading = false;
    updateButtons();
    announce('Your browser could not decode this video. Try an H.264 MP4 or another supported format.');
  });

  music.addEventListener('error', () => {
    announce('This soundtrack could not be decoded. You can still watch the video.');
  });

  video.addEventListener('timeupdate', updateProgress);
  video.addEventListener('pause', () => { music.pause(); updateButtons(); });
  video.addEventListener('play', updateButtons);
  video.addEventListener('ended', () => {
    music.pause();
    updateProgress();
    updateButtons();
    announce('Screening complete. Restart, try another file, or enter GOATVILLE.');
  });

  playButton.addEventListener('click', async () => {
    if (!hasVideo() || loading) return;
    if (video.ended) video.currentTime = 0;
    try {
      if (hasAudio()) {
        music.pause();
        const duration = music.duration;
        try { music.currentTime = Number.isFinite(duration) ?
          Math.min(video.currentTime, duration) : video.currentTime; } catch { /* Metadata may be pending. */ }
      }
      // Play is always initiated by a direct visitor action.
      const started = video.play();
      if (started?.then) await started;
      if (soundEnabled && hasAudio()) {
        try {
          const soundtrack = music.play();
          if (soundtrack?.then) await soundtrack;
        } catch {
          announce('Film playing, but the soundtrack needs another tap or a supported audio format.');
        }
      } else {
        announce('Now screening. Sound remains off until you enable it.');
      }
      updateButtons();
    } catch {
      pausePlayback();
      announce('Playback was blocked or the file is unsupported. Tap Play again or choose another file.');
    }
  });

  pauseButton.addEventListener('click', () => {
    pausePlayback();
    announce('Screening paused.');
  });

  restartButton.addEventListener('click', () => {
    if (!hasVideo()) return;
    pausePlayback();
    video.currentTime = 0;
    try { music.currentTime = 0; } catch { /* Audio may not be seekable. */ }
    updateProgress();
    announce('Rewound to the beginning. Press Play when ready.');
  });

  soundButton.addEventListener('click', async () => {
    if (!hasVideo()) return;
    soundEnabled = !soundEnabled;
    updateButtons();
    if (!soundEnabled) {
      music.pause();
      announce('Sound off. You can watch without audio.');
      return;
    }
    if (!video.paused && hasAudio()) {
      try {
        const soundtrack = music.play();
        if (soundtrack?.then) await soundtrack;
      } catch {
        announce('Sound enabled. Your browser may require you to press Play again for music.');
        return;
      }
    }
    announce('Sound enabled at your request.');
  });

  byId('clear').addEventListener('click', () => {
    clearResource('audio');
    clearResource('video');
    soundEnabled = false;
    videoInput.value = '';
    audioInput.value = '';
    updateButtons();
    announce('All selected media removed from this screening room. Nothing was uploaded.');
  });

  // Opening the shared universe navigation should not leave video or music playing behind a modal.
  document.addEventListener('goatverse:portal-open', () => {
    if(!video.paused || !music.paused){
      pausePlayback();
      announce('Screening paused while you explore GOAT Universe.');
    }
  });

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && !video.paused) pausePlayback();
  });

  window.addEventListener('pagehide', () => {
    video.pause();
    music.pause();
    release('audio');
    release('video');
  });

  updateButtons();
  updateProgress();
})();