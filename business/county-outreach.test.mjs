import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeCounty, createProspect, queueForReview, dedupeProspects } from './county-outreach.mjs';
const base = { id: 'a', fips: '01001', state: 'AL', county: 'Autauga', organization: 'Example League', sourceUrl: 'https://example.org', contactEmail: 'contact@example.org' };

test('FIPS preserves five-digit identifiers', () => assert.equal(normalizeCounty({ fips: 1001, state: 'al', county: 'Autauga' }).fips, '01001'));
test('unverified prospect cannot be queued', () => assert.equal(queueForReview(createProspect(base)).allowed, false));
test('permitted contact enters human review only', () => assert.deepEqual(queueForReview(createProspect({ ...base, permission: 'permitted' })), { allowed: true, status: 'human_review', prospectId: 'a' }));
test('opt-outs override previously permitted contacts', () => {
  const p = createProspect({ ...base, permission: 'permitted' });
  for (const changed of [{ permission: 'opted_out' }, { status: 'opted_out' }, { suppressed: true }, { optedOutAt: '2026-10-17' }]) {
    assert.equal(queueForReview({ ...p, ...changed }).allowed, false);
  }
});
test('deduplication preserves opt-out regardless of record order', () => {
  const permitted = createProspect({ ...base, permission: 'permitted' });
  const optedOut = { ...permitted, permission: 'opted_out', status: 'opted_out' };
  for (const records of [[permitted, optedOut], [optedOut, permitted]]) {
    const [result] = dedupeProspects(records);
    assert.equal(result.permission, 'opted_out');
    assert.equal(queueForReview(result).allowed, false);
  }
});
test('deduplicates organizations by county', () => {
  const p = createProspect(base);
  assert.equal(dedupeProspects([p, { ...p, organization: 'example league' }, { ...p, fips: '01003' }]).length, 2);
});
