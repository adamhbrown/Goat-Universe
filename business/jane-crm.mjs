// Tiffany Jane CRM domain model — offline planning; never sends communications.
export const CHANNELS = Object.freeze(['social', 'county', 'strategic100']);
export const STAGES = Object.freeze(['research', 'qualified', 'draft_ready', 'awaiting_approval', 'approved', 'contacted', 'engaged', 'meeting_requested', 'founder_handoff', 'closed_won', 'closed_lost', 'suppressed']);
const handoffStages = new Set(['founder_handoff', 'closed_won', 'closed_lost']);
export function createLead({ id, name, channel, sourceUrl, owner = 'Tiffany Jane', permission = 'unverified' }) {
  if (!id || !name || !CHANNELS.includes(channel) || !/^https:\/\//.test(String(sourceUrl ?? ''))) throw new RangeError('id, name, channel and HTTPS source are required');
  if (!['unverified', 'permitted', 'opted_out'].includes(permission)) throw new RangeError('invalid permission');
  return { id: String(id), name: String(name), channel, sourceUrl, owner, permission, stage: permission === 'opted_out' ? 'suppressed' : 'research', history: [] };
}
export function transitionLead(lead, nextStage, { actor = 'Tiffany Jane', note = '', at } = {}) {
  if (!STAGES.includes(nextStage)) throw new RangeError('invalid stage');
  if (!at || !Number.isFinite(Date.parse(at))) throw new RangeError('explicit ISO timestamp required');
  const suppressed = lead.permission === 'opted_out' || lead.stage === 'suppressed' || lead.suppressed === true;
  if (suppressed && nextStage !== 'suppressed') throw new Error('suppressed lead cannot be reactivated');
  if (nextStage === 'contacted' && (lead.permission !== 'permitted' || lead.stage !== 'approved')) throw new Error('contact requires permission and prior approval');
  if (handoffStages.has(nextStage) && actor !== 'Adam Brown') {
    if (nextStage !== 'founder_handoff') throw new Error('only founder may close opportunities');
  }
  return { ...lead, stage: nextStage, history: [...lead.history, { from: lead.stage, to: nextStage, actor, note, at }] };
}
export function suppressLead(lead, { at, reason = 'opt-out' } = {}) {
  if (!at || !Number.isFinite(Date.parse(at))) throw new RangeError('explicit ISO timestamp required');
  return { ...lead, permission: 'opted_out', suppressed: true, stage: 'suppressed', history: [...lead.history, { from: lead.stage, to: 'suppressed', actor: 'system', note: reason, at }] };
}
export function pipelineSummary(leads) {
  const result = { total: leads.length, byChannel: Object.fromEntries(CHANNELS.map(c => [c, 0])), byStage: Object.fromEntries(STAGES.map(s => [s, 0])) };
  for (const lead of leads) { if (lead.channel in result.byChannel) result.byChannel[lead.channel]++; if (lead.stage in result.byStage) result.byStage[lead.stage]++; }
  return result;
}
