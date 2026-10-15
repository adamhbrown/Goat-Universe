import {CHANNEL, createGuestSession, validateAttraction} from './protocol.mjs';
import {resolveApprovedGuestEntry} from './catalog.mjs';

// Only reviewed static entry files may be passed by the host's catalog.
// Separate documents keep a strict parent CSP; srcdoc would inherit its policy.
export function mountGuestGame({container, attraction, entryURL, onAchievement = () => {}, windowImpl = window}) {
  const spec = validateAttraction(attraction);
  if (!container || container.ownerDocument?.defaultView !== windowImpl || typeof onAchievement !== 'function')
    throw new Error('invalid_game_host');
  const session = [...windowImpl.crypto.getRandomValues(new Uint8Array(16))].map(b => b.toString(16).padStart(2,'0')).join('');
  const reducedMotion = windowImpl.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
  // The URL must be the exact reviewed entry for this attraction/version.
  // Same-origin alone is not authorization to frame another HTML page.
  const entry = resolveApprovedGuestEntry({
    attraction: spec, entryURL, origin: windowImpl.location.origin, hostModuleURL: import.meta.url
  });
  const frame = container.ownerDocument.createElement('iframe');
  frame.title = spec.title;
  frame.setAttribute('sandbox', 'allow-scripts'); // Intentionally omit allow-same-origin.
  frame.setAttribute('referrerpolicy', 'no-referrer');
  frame.setAttribute('allow', "camera 'none'; microphone 'none'; geolocation 'none'; payment 'none'; fullscreen 'none'");
  frame.style.cssText = 'width:100%;height:300px;border:1px solid currentColor;';
  frame.src = entry.href;
  frame.addEventListener('load', () => {
    // '*' is necessary for an opaque sandbox target. This contains no identity,
    // account data, credentials or official score authority.
    frame.contentWindow.postMessage({channel:CHANNEL, type:'init', session,
      attraction:spec.id, version:spec.version, reducedMotion}, '*');
  }, {once:true});
  container.append(frame);
  const gate = createGuestSession({attraction:spec, source:frame.contentWindow, session});
  const receive = event => {
    const stamp = gate.accept(event);
    if (stamp) onAchievement(stamp);
  };
  windowImpl.addEventListener('message', receive);
  let destroyed = false;
  return Object.freeze({
    frame,
    destroy() {
      if (destroyed) return;
      destroyed = true; gate.close();
      windowImpl.removeEventListener('message', receive);
      frame.remove();
    }
  });
}
