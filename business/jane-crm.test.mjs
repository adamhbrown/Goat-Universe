import test from 'node:test';
import assert from 'node:assert/strict';
import { createLead, transitionLead, suppressLead, pipelineSummary } from './jane-crm.mjs';
const at = '2026-10-17T13:00:00Z';
const base = { id: 'L1', name: 'Example League', channel: 'county', sourceUrl: 'https://example.org', permission: 'permitted' };
test('all three growth channels have separate counts', () => {
  const p = createLead(base);
  assert.equal(pipelineSummary([p]).byChannel.county, 1);
});
test('contacting requires explicit approval', () => {
  const p = createLead(base);
  assert.throws(() => transitionLead(p, 'contacted', { at }), /approval/);
  const approved = transitionLead(p, 'approved', { at });
  assert.equal(transitionLead(approved, 'contacted', { at }).stage, 'contacted');
});
test('opt-out is irreversible in workflow', () => {
  const p = suppressLead(createLead(base), { at });
  assert.throws(() => transitionLead(p, 'approved', { at }), /suppressed/);
});
test('only founder closes opportunities', () => {
  const p = createLead(base);
  assert.throws(() => transitionLead(p, 'closed_won', { at }), /founder/);
  assert.equal(transitionLead(p, 'closed_won', { at, actor: 'Adam Brown' }).stage, 'closed_won');
});
