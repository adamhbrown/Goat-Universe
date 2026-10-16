/* Device-only souvenirs. No identity, competition authority, network or automatic storage. */
(function (root) {
  'use strict';
  const sports = ['gridiron', 'hoops', 'crossover', 'greatness', 'classic'];
  const districts = ['town-square', 'championship-district', 'tee-district', 'club-goat', 'goat-island', 'mountain-lodge'];
  const catalog = Object.freeze([...sports, ...districts, 'sports-iq']);
  const identities = Object.freeze(['Gold Standard', 'Night Shift', 'Summit Club']);
  const storageKey = 'goatville-kodak-guest-journal-v2';
  function validate(value) {
    if (!value || Array.isArray(value) || typeof value !== 'object') return false;
    const fields = ['version', 'verification', 'stamps', 'franchise'];
    return Object.keys(value).length === fields.length && fields.every(key => Object.hasOwn(value, key)) &&
      value.version === 2 && value.verification === 'local-unverified' &&
      Array.isArray(value.stamps) && value.stamps.length <= catalog.length &&
      value.stamps.every(id => catalog.includes(id)) && new Set(value.stamps).size === value.stamps.length && identities.includes(value.franchise);
  }
  function createJournal(getStorage = () => root.localStorage) {
    let stamps = new Set(), franchise = identities[0], touched = false, storage = null, remembering = false, available = true;
    const listeners = new Set();
    const snapshot = () => ({ version: 2, verification: 'local-unverified', stamps: [...stamps], franchise });
    const state = () => ({ ...snapshot(), remembering, available });
    function notify() { listeners.forEach(fn => fn(state())); }
    function save() {
      if (remembering && storage && available) {
        try { storage.setItem(storageKey, JSON.stringify(snapshot())); } catch { available = false; }
      }
      notify();
    }
    return Object.freeze({
      state, snapshot,
      has: id => stamps.has(id),
      count: group => (group || catalog).filter(id => stamps.has(id)).length,
      stamp(id) { if (!catalog.includes(id)) return false; stamps.add(id); save(); return true; },
      setFranchise(value) { if (!identities.includes(value)) return false; franchise = value; touched = true; save(); return true; },
      remember(enabled) {
        if (enabled) {
          remembering = true; available = true;
          try {
            storage = getStorage();
            const raw = storage.getItem(storageKey);
            if (raw !== null) {
              if (typeof raw !== 'string' || raw.length > 4096) throw new Error('Oversized souvenir journal');
              const stored = JSON.parse(raw);
              if (!validate(stored)) throw new Error('Invalid souvenir journal');
              stored.stamps.forEach(id => stamps.add(id));
              if (!touched) franchise = stored.franchise;
            }
          } catch { available = false; }
          save();
        } else {
          // Only a prior opt-in can have acquired storage. Opt-out deletes that saved copy.
          if (storage) { try { storage.removeItem(storageKey); } catch { available = false; } }
          remembering = false; storage = null; notify();
        }
      },
      clear() {
        if (storage) { try { storage.removeItem(storageKey); } catch { available = false; } }
        stamps.clear(); franchise = identities[0]; touched = false; remembering = false; storage = null; notify();
      },
      subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); },
    });
  }
  const api = Object.freeze({ catalog, sports: Object.freeze(sports), districts: Object.freeze(districts), identities, storageKey, validate, createJournal });
  root.GoatPassport = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.goatGuestJournal = createJournal();
})(globalThis);
