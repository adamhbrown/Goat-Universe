/* Small progressive enhancements. Every destination is still a standard link. */
(() => {
  'use strict';
  const mode = document.getElementById('goatMode');
  mode?.addEventListener('click', () => {
    const enabled = document.body.classList.toggle('goat-mode');
    mode.textContent = `GOAT MODE: ${enabled ? 'ON' : 'OFF'}`;
    mode.classList.toggle('active', enabled);
    mode.setAttribute('aria-pressed', String(enabled));
  });

  function openGameDetail() {
    if (!location.hash.startsWith('#game-details-')) return;
    const panel = document.getElementById(location.hash.slice(1));
    if (panel instanceof HTMLDetailsElement) panel.open = true;
  }
  document.querySelectorAll('.games-card-link').forEach(link => {
    link.addEventListener('click', () => {
      const panel = document.getElementById(link.hash.slice(1));
      if (panel instanceof HTMLDetailsElement) panel.open = true;
    });
  });
  openGameDetail();
  window.addEventListener('hashchange', openGameDetail);

  const destinations = [...document.querySelectorAll('[data-destination]')];
  function lightDestination(destination) {
    destinations.forEach(link => link.classList.toggle('is-active', link.dataset.destination === destination));
  }
  destinations.forEach(link => {
    link.addEventListener('pointerenter', () => lightDestination(link.dataset.destination));
    link.addEventListener('focus', () => lightDestination(link.dataset.destination));
    link.addEventListener('click', () => lightDestination(link.dataset.destination));
  });
  const enter = document.querySelector('.enter-universe');
  enter?.addEventListener('click', () => {
    // Focus provides a clear keyboard/screen-reader landing point without an animation gate.
    document.getElementById('universe')?.focus({ preventScroll: true });
  });

  if ('IntersectionObserver' in window) {
    const mobileLinks = [...document.querySelectorAll('.mobile-nav a')];
    const visible = new Map();
    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => visible.set(entry.target.id, entry.isIntersecting));
      const section = [...visible].find(([, isVisible]) => isVisible)?.[0];
      mobileLinks.forEach(link => {
        const active = link.hash === `#${section}`;
        link.classList.toggle('is-current', active);
        if (active) link.setAttribute('aria-current', 'location');
        else link.removeAttribute('aria-current');
      });
    }, { rootMargin: '-10% 0px -55% 0px', threshold: 0 });
    mobileLinks.forEach(link => {
      const section = document.getElementById(link.hash.slice(1));
      if (section) observer.observe(section);
    });
  }
})();
