// County-level GOAT Games outreach planning. No network calls, no email sending.
export function normalizeCounty(row) {
  if (!row || typeof row !== 'object') throw new TypeError('county record required');
  const fips = String(row.fips ?? '').padStart(5, '0');
  if (!/^\d{5}$/.test(fips)) throw new RangeError('county FIPS must have five digits');
  const state = String(row.state ?? '').trim().toUpperCase();
  const county = String(row.county ?? '').trim();
  if (!/^[A-Z]{2}$/.test(state) || !county) throw new RangeError('state and county required');
  return { fips, state, county };
}
export function createProspect({ id, fips, state, county, organization, sourceUrl, contactEmail = null, permission = 'unverified' }) {
  const place = normalizeCounty({ fips, state, county });
  if (!id || !organization || !/^https:\/\//.test(String(sourceUrl ?? ''))) throw new RangeError('id, organization and HTTPS source required');
  if (!['unverified', 'permitted', 'opted_out'].includes(permission)) throw new RangeError('invalid permission');
  return { ...place, id: String(id), organization: String(organization), sourceUrl: String(sourceUrl), contactEmail, permission, status: 'research', lastContactedAt: null };
}
export function queueForReview(prospect) {
  if (prospect.permission !== 'permitted' || !prospect.contactEmail || prospect.status === 'opted_out') return { allowed: false, reason: 'permission/contact review required' };
  return { allowed: true, status: 'human_review', prospectId: prospect.id };
}
export function dedupeProspects(rows) {
  const seen = new Set();
  return rows.filter(row => {
    const key = [row.fips, String(row.organization).toLowerCase().trim()].join(':');
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
