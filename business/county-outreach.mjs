// County-level GOAT Games outreach planning. No network calls, no email sending.
export function normalizeCounty(row) {
  if (!row || typeof row !== 'object') throw new TypeError('county record required');
  const fips = String(row.fips ?? '').padStart(5, '0');
  if (!/^\d{5}$/.test(fips)) throw new RangeError('county FIPS must have five digits');
  const state = String(row.state ?? '').trim().toUpperCase();
  const county = String(row.county ?? '').trim();
  if (!/^\d{5}$/.test(fips) || !/^[A-Z]{2}$/.test(state) || !county) throw new RangeError('valid county FIPS, state and county required');
  return { fips, state, county };
}
export function createProspect({ id, fips, state, county, organization, sourceUrl, contactEmail = null, permission = 'unverified' }) {
  const place = normalizeCounty({ fips, state, county });
  if (!id || !organization || !/^https:\/\//.test(String(sourceUrl ?? ''))) throw new RangeError('id, organization and HTTPS source required');
  if (!['unverified', 'permitted', 'opted_out'].includes(permission)) throw new RangeError('invalid permission');
  return { ...place, id: String(id), organization: String(organization), sourceUrl: String(sourceUrl), contactEmail, permission, status: permission === 'opted_out' ? 'opted_out' : 'research', lastContactedAt: null };
}
export function queueForReview(prospect) {
  if (!prospect || prospect.permission !== 'permitted' || prospect.status === 'opted_out' || prospect.optedOutAt || prospect.suppressed === true || !prospect.contactEmail) {
    return { allowed: false, reason: 'permission/contact review required' };
  }
  return { allowed: true, status: 'human_review', prospectId: prospect.id };
}
export function dedupeProspects(rows) {
  const byKey = new Map();
  for (const row of rows) {
    const key = [row.fips, String(row.organization).toLowerCase().trim()].join(':');
    const prior = byKey.get(key);
    if (!prior) { byKey.set(key, { ...row }); continue; }
    // Suppression wins over a previously permitted duplicate; never resurrect opt-outs.
    const suppressed = [prior, row].some(p => p.permission === 'opted_out' || p.status === 'opted_out' || p.optedOutAt || p.suppressed === true);
    if (suppressed) byKey.set(key, { ...prior, permission: 'opted_out', status: 'opted_out', suppressed: true });
    else if (prior.permission !== 'permitted') byKey.set(key, { ...prior, permission: 'unverified' });
  }
  return [...byKey.values()];
}
