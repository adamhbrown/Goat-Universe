// A checked-in allowlist of individually reviewed, recreational game entrypoints.
// New entries must be introduced through code review; never accept visitor-supplied paths.
// This first entry is an integration fixture, NOT an official competition or production game.
import {validateAttraction} from './protocol.mjs';

const reviewed = Object.freeze({
  'integration-test': Object.freeze({
    specification: Object.freeze({
      id: 'integration-test',
      version: 1,
      title: 'Guest challenge test',
      achievements: Object.freeze(['first-test'])
    }),
    relativeEntry: './challenge.html'
  })
});

export function resolveReviewedGuestEntry({attraction, entryURL, windowImpl}) {
  const spec = validateAttraction(attraction);
  const allowed = Object.hasOwn(reviewed, spec.id) ? reviewed[spec.id] : null;
  if (!allowed || spec.version !== allowed.specification.version ||
      spec.title !== allowed.specification.title ||
      spec.achievements.length !== allowed.specification.achievements.length ||
      !spec.achievements.every((item, index) => item === allowed.specification.achievements[index]))
    throw new Error('unreviewed_game');

  // Resolve against the active guest host document. This supports a staging
  // path prefix without allowing callers to choose another HTML file.
  const expected = new URL(allowed.relativeEntry, windowImpl.location.href);
  const entry = new URL(entryURL, windowImpl.location.href);
  if (!['http:', 'https:'].includes(entry.protocol) ||
      entry.origin !== windowImpl.location.origin ||
      entry.username || entry.password || entry.search || entry.hash ||
      entry.href !== expected.href)
    throw new Error('invalid_game_entry');
  return Object.freeze({spec, entry: expected});
}
