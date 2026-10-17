import {goatvilleTime} from './gst-time.js';
export {goatvilleTime} from './gst-time.js';
export function mountGoatvilleClock(document, window) {
  if (document.getElementById('gv-gst-clock')) return;
  const clock = document.createElement('aside');
  clock.id = 'gv-gst-clock';
  clock.setAttribute('aria-label', 'Goatville Standard Time');
  clock.title = 'Goatville Standard Time · America/New_York · device clock; official deadlines use server UTC';
  const name = document.createElement('span');
  name.textContent = 'Goatville Standard Time';
  const time = document.createElement('time');
  const date = document.createElement('small');
  clock.append(name, time, date);
  document.body.append(clock);
  // Native modal dialogs occupy the browser's top layer. Keep the clock inside
  // an open dialog so the Explore menu or cinematic entrance cannot cover it.
  if (typeof window.MutationObserver === 'function') {
    const placeClock = () => {
      const dialogs = document.querySelectorAll('dialog[open]');
      (dialogs[dialogs.length - 1] || document.body).append(clock);
    };
    const observer = new window.MutationObserver(records => {
      if (records.some(record => record.target.tagName === 'DIALOG')) placeClock();
    });
    observer.observe(document.body, {subtree: true, attributes: true, attributeFilter: ['open']});
    placeClock();
  }
  const update = () => {
    const value = goatvilleTime(new Date());
    time.textContent = value.time + ' GST';
    time.dateTime = value.utc;
    date.textContent = value.date;
  };
  update();
  // No live region: screen readers must not announce every second.
  let timer = window.setInterval(update, 1000);
  document.addEventListener('visibilitychange', () => {
    window.clearInterval(timer);
    if (!document.hidden) { update(); timer = window.setInterval(update, 1000); }
  });
}
if (typeof document !== 'undefined') mountGoatvilleClock(document, window);
