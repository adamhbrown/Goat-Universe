import test from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {goatvilleTime,mountGoatvilleClock} from '../experience/gst-clock.js';
import {formatGST} from '../experience/gst-time.js';

test('GST follows New York across both DST transitions and preserves UTC instants', () => {
  for (const [utc,time,date] of [
    ['2026-03-08T06:59:59Z','01:59:59 AM','Mar 8, 2026'],
    ['2026-03-08T07:00:00Z','03:00:00 AM','Mar 8, 2026'],
    ['2026-11-01T05:59:59Z','01:59:59 AM','Nov 1, 2026'],
    ['2026-11-01T06:00:00Z','01:00:00 AM','Nov 1, 2026'],
    ['2026-10-17T02:00:00Z','10:00:00 PM','Oct 16, 2026']
  ]) {
    const instant=new Date(utc),value=goatvilleTime(instant);
    assert.equal(value.time,time);assert.equal(value.date,date);
    assert.equal(value.utc,instant.toISOString());
    assert.equal(formatGST(utc),date+' · '+time+' GST');
  }
});
test('clock mounts once, stores its machine-readable instant in UTC and pauses when hidden', () => {
  const dom=new JSDOM('<!doctype html><body></body>');
  let intervals=0,clears=0;
  const win={setInterval(){intervals++;return intervals;},clearInterval(){clears++;}};
  const doc=dom.window.document;
  mountGoatvilleClock(doc,win);mountGoatvilleClock(doc,win);
  assert.equal(doc.querySelectorAll('#gv-gst-clock').length,1);
  assert.match(doc.querySelector('time').textContent,/GST$/);
  assert.match(doc.querySelector('time').dateTime,/Z$/);
  assert.equal(doc.querySelector('[aria-live]'),null);
  assert.equal(intervals,1);
  doc.dispatchEvent(new dom.window.Event('visibilitychange'));
  assert.equal(clears,1);assert.equal(intervals,1);
  dom.window.close();
});
test('clock remains in the native modal top layer and returns after close', async () => {
  const dom=new JSDOM('<!doctype html><body><dialog></dialog></body>');
  const doc=dom.window.document,dialog=doc.querySelector('dialog');
  mountGoatvilleClock(doc,dom.window);
  dialog.setAttribute('open','');
  await new Promise(resolve=>dom.window.queueMicrotask(resolve));
  assert.equal(doc.getElementById('gv-gst-clock').parentElement,dialog);
  dialog.removeAttribute('open');
  await new Promise(resolve=>dom.window.queueMicrotask(resolve));
  assert.equal(doc.getElementById('gv-gst-clock').parentElement,doc.body);
  dom.window.close();
});
