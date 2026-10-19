// A presentation-only catalog: no checkout, tracking, inventory, pricing or account data.
(() => {
  const buttons = [...document.querySelectorAll('[data-filter]')];
  const cards = [...document.querySelectorAll('.collection[data-category]')];
  const status = document.getElementById('filter-status');
  for (const button of buttons) {
    button.addEventListener('click', () => {
      const selected = button.dataset.filter;
      for (const control of buttons) control.setAttribute('aria-pressed', String(control === button));
      let visible = 0;
      for (const card of cards) {
        const matches = selected === 'all' || card.dataset.category === selected;
        card.hidden = !matches;
        if (matches) visible++;
      }
      status.textContent = 'Showing ' + visible + ' proposed collection' + (visible === 1 ? '' : 's') +
        '. This is a design gallery, not a checkout.';
    });
  }
  // Source-of-truth: America/New_York; both displays use the same Date object
  // and formatter, ensuring second-level equality through DST changes.
  const east = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York', hour: '2-digit', minute: '2-digit',
    second: '2-digit', hour12: true
  });
  const goatville = document.getElementById('gst-time');
  const newYork = document.getElementById('ny-time');
  const updateTime = () => {
    const time = east.format(new Date());
    goatville.textContent = time;
    newYork.textContent = time;
  };
  updateTime();
  // The clocks are decorative information on this gallery, and the interval
  // must not trigger backend calls or store visitor data.
  if (typeof window.setInterval === 'function') window.setInterval(updateTime, 1000);
})();