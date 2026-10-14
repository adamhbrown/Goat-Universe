export function pickCommand(round, games, rows, mvp) {
  const allowed = new Set(games.filter(g => g.round_id === round.id).map(g => g.id));
  if (rows.length !== allowed.size || new Set(rows.map(x => x.game_id)).size !== allowed.size || rows.some(x => !allowed.has(x.game_id))) throw new Error('Choose every game once.');
  if (rows.some(x => !['home','away'].includes(x.side) || !Number.isSafeInteger(x.weight))) throw new Error('Choose a team and whole-number ranking for every game.');
  const weights = rows.map(x => x.weight).sort((a,b) => a-b);
  if (!round.weight_options.some(option => JSON.stringify([...option].sort((a,b) => a-b)) === JSON.stringify(weights))) throw new Error('Use one of the allowed ranking allocations exactly once.');
  if (round.mvp_bonus && !mvp?.trim()) throw new Error('Enter your Super Bowl MVP selection.');
  return { op:'picks_submit', round_id:round.id, picks:rows, ...(round.mvp_bonus ? {mvp_pick:mvp.trim()} : {}) };
}

// Tokens live in this closure, not browser storage, URLs, or the DOM.
export function client(fetchImpl = fetch) {
  let access = '', refresh = '', rotation;
  async function request(path, body, authenticated = true, retried = false) {
    const sentAccess = access;
    const response = await fetchImpl(path, { method:'POST', headers:{'Content-Type':'application/json', ...(authenticated && access ? {Authorization:`Bearer ${access}`} : {})}, body:JSON.stringify(body), credentials:'omit' });
    const result = await response.json();
    if (response.status === 401 && authenticated && refresh && !retried) {
      // A delayed response may refer to the old token after another request
      // finished refreshing. Retry with the new token instead of rotating again.
      if (sentAccess !== access && access) return request(path, body, authenticated, true);
      // Multiple dashboard queries share one rotation, so the single-use
      // refresh token is never submitted twice concurrently.
      rotation ||= request('/auth/refresh', {refresh_token:refresh}, false).then(setSession).finally(() => { rotation = undefined; });
      await rotation;
      return request(path, body, authenticated, true);
    }
    if (!response.ok) throw new Error(result.error || 'request_failed');
    return result;
  }
  function setSession(result) {
    access = result.access_token || ''; refresh = result.refresh_token || '';
    if (!access) throw new Error('authentication_required');
    return result;
  }
  return {
    request,
    async login(body) { return setSession(await request('/auth/login',body,false)); },
    signup(body) { return request('/auth/signup',body,false); },
    query(body) { return request('/query',body); },
    command(body) { return request('/commands',body); },
    async logout() { try { if(access) await request('/auth/logout',{}); } finally { access='';refresh=''; } }
  };
}
