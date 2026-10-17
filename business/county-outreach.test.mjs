import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeCounty, createProspect, queueForReview, dedupeProspects } from './county-outreach.mjs';

test('FIPS preserves five-digit identifiers', () => {
  assert.equal(normalizeCounty({ fips: 1001, state: 'al', county: 'Autauga' }).fips, '01001');
});
test('prospects default to unverified and cannot be queued', () => {
  const p = createProspect({ id: 'a', fips: '01001', state: 'AL', county: 'Autauga', organization: 'Example League', sourceUrl: 'https://example.org' });
  assert.equal(queueForReview(p).allowed, false);
});
test('permitted contacts require human review, never auto-send', () => {
  const p = createProspect({ id: 'a', fips: '01001', state: 'AL', county: 'Autauga', organization: 'Example League', sourceUrl: 'https://example.org', contactEmail: 'contact@example.org', permission: 'permitted' });
  assert.deepEqual(queueForReview(p), { allowed: true, status: 'human_review', prospectId: 'a' });
  assert.equal(queueForReview({ ...p, permission: 'opted_out' }).allowed, false);
});
test('deduplicates organizations within each county', () => {
  const p = { fips: '01001', organization: 'Example League' };
  assert.equal(dedupeProspects([p, { ...p, organization: 'example league' }, { ...p, fips: '01003' }]).length, 2);
});
