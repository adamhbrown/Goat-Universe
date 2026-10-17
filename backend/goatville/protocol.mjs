// Browser-safe boundary for recreational games. No competition or identity imports.
export const CHANNEL = 'goatville.guest.v1';
const identifier = value => typeof value === 'string' && /^[a-z][a-z0-9-]{0,47}$/.test(value);
const plain = value => value !== null && typeof value === 'object' && !Array.isArray(value) &&
  [Object.prototype, null].includes(Object.getPrototypeOf(value));
const exact = (value, keys) => plain(value) && Object.keys(value).sort().join('|') === [...keys].sort().join('|');

export function validateAttraction(value) {
  if (!exact(value, ['id', 'version', 'title', 'achievements']) || !identifier(value.id) ||
      !Number.isSafeInteger(value.version) || value.version < 1 ||
      typeof value.title !== 'string' || !value.title.trim() || value.title.length > 80 ||
      !Array.isArray(value.achievements) || value.achievements.length > 16 ||
      value.achievements.some(id => !identifier(id)) || new Set(value.achievements).size !== value.achievements.length)
    throw new Error('invalid_attraction');
  return Object.freeze({...value, achievements: Object.freeze([...value.achievements])});
}

// The parent supplies the source WindowProxy and a fresh random session value.
// Opaque sandbox origins are expected; origin === 'null' alone is never identity.
export function createGuestSession({attraction, source, session, now = Date.now}) {
  const spec = validateAttraction(attraction);
  if (!source || typeof session !== 'string' || !/^[a-f0-9]{32}$/.test(session)) throw new Error('invalid_session');
  let closed = false, lastSequence = 0, accepted = 0;
  const issued = new Set();
  return Object.freeze({
    accept(event) {
      if (closed || accepted >= 32 || event?.source !== source || event.origin !== 'null') return null;
      const m = event.data;
      if (!exact(m, ['channel','session','attraction','version','sequence','type','achievement']) ||
          m.channel !== CHANNEL || m.session !== session || m.attraction !== spec.id || m.version !== spec.version ||
          !Number.isSafeInteger(m.sequence) || m.sequence <= lastSequence || m.sequence > 100000 ||
          m.type !== 'achievement' || !spec.achievements.includes(m.achievement) || issued.has(m.achievement)) return null;
      lastSequence = m.sequence; accepted++; issued.add(m.achievement);
      return Object.freeze({attraction: spec.id, version: spec.version, achievement: m.achievement,
        observed_at: now(), verification: 'local-unverified'});
    },
    close() { closed = true; }
  });
}

const KEY = 'goatville.guest-journal.v1';
const MAX_BYTES = 32768;
function validStamp(s) {
  return exact(s, ['attraction','version','achievement','observed_at','verification']) &&
    identifier(s.attraction) && identifier(s.achievement) && Number.isSafeInteger(s.version) && s.version > 0 &&
    Number.isSafeInteger(s.observed_at) && s.observed_at >= 0 && s.verification === 'local-unverified';
}
const stampKey = s => `${s.attraction}:${s.version}:${s.achievement}`;

// Persistence is opt-in. No identifiers, tokens, PII, scores, or network calls.
// Browser storage is attacker-editable and must never be imported as an award.
export function createGuestJournal({storage, persist = false} = {}) {
  let stamps = [];
  if (persist) {
    try {
      const raw = storage?.getItem(KEY);
      if (typeof raw === 'string' && raw.length <= MAX_BYTES) {
        const saved = JSON.parse(raw);
        if (exact(saved, ['version','stamps']) && saved.version === 1 && Array.isArray(saved.stamps) &&
            saved.stamps.length <= 100 && saved.stamps.every(validStamp) &&
            new Set(saved.stamps.map(stampKey)).size === saved.stamps.length) stamps = saved.stamps;
      }
    } catch { /* Corrupt, unavailable, or privacy-restricted storage starts empty. */ }
  }
  const list = () => stamps.map(s => ({...s}));
  return Object.freeze({
    list,
    record(stamp) {
      if (!validStamp(stamp)) throw new Error('invalid_guest_stamp');
      if (!stamps.some(s => stampKey(s) === stampKey(stamp))) stamps = [...stamps, {...stamp}].slice(-100);
      let saved = false;
      if (persist) {
        try { storage.setItem(KEY, JSON.stringify({version:1, stamps})); saved = true; } catch { /* Keep usable in memory. */ }
      }
      return {stamps:list(), persisted:saved};
    },
    clear() {
      stamps = [];
      try { storage?.removeItem(KEY); return true; } catch { return false; }
    }
  });
}
