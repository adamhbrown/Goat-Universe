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
export function client(fetchImpl = fetch, {onSessionEnd = () => {}} = {}) {
  let access = '', refresh = '', rotation, generation = 0;
  function clear(reason) {
    generation++; access = ''; refresh = ''; rotation = undefined;
    if (reason) onSessionEnd(reason);
  }
  async function request(path, body, authenticated = true, retried = false) {
    const sentAccess = access, started = generation;
    const response = await fetchImpl(path, { method:'POST', headers:{'Content-Type':'application/json', ...(authenticated && access ? {Authorization:`Bearer ${access}`} : {})}, body:JSON.stringify(body), credentials:'omit', signal:AbortSignal.timeout(15000) });
    const result = await response.json();
    // A late login, rotation or dashboard response must never restore a session
    // or private view after sign-out, or overwrite a newly signed-in account.
    if (started !== generation) throw new Error('session_changed_please_sign_in');
    if (response.status === 401 && authenticated && refresh && !retried) {
      // A delayed response may refer to the old token after another request
      // finished refreshing. Retry with the new token instead of rotating again.
      if (sentAccess !== access && access) return request(path, body, authenticated, true);
      // Multiple dashboard queries share one rotation, so the single-use
      // refresh token is never submitted twice concurrently.
      if (!rotation) {
        const pending = request('/auth/refresh', {refresh_token:refresh}, false).then(setSession);
        rotation = pending;
        // Keep an old promise's cleanup from clearing a newer rotation.
        pending.finally(() => { if (rotation === pending) rotation = undefined; }).catch(() => {});
      }
      try { await rotation; }
      catch (error) {
        if (started !== generation) throw error;
        clear('session_expired_please_sign_in');
        throw new Error('session_expired_please_sign_in');
      }
      return request(path, body, authenticated, true);
    }
    if (response.status === 401 && authenticated) clear('session_expired_please_sign_in');
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
    async login(body) { clear(); return setSession(await request('/auth/login',body,false)); },
    signup(body) { return request('/auth/signup',body,false); },
    query(body) { return request('/query',body); },
    command(body) { return request('/commands',body); },
    forget() { clear('page_left'); },
    async logout() {
      const token = access, oldRefresh = refresh;
      clear('signed_out');
      if (!token) return;
      const send = (path, body, bearer) => fetchImpl(path, {method:'POST',headers:{'Content-Type':'application/json',...(bearer?{Authorization:`Bearer ${bearer}`}:{})},body:JSON.stringify(body),credentials:'omit',signal:AbortSignal.timeout(15000)});
      let response = await send('/auth/logout',{},token);
      // An expired access token can still have a valid refresh token. Revoke
      // that session too, without ever restoring it in this client.
      if (response.status === 401 && oldRefresh) {
        const refreshed = await send('/auth/refresh',{refresh_token:oldRefresh});
        if (!refreshed.ok) throw new Error('server_signout_unconfirmed');
        const session = await refreshed.json();
        if (!session.access_token) throw new Error('server_signout_unconfirmed');
        response = await send('/auth/logout',{},session.access_token);
      }
      if (!response.ok) throw new Error('server_signout_unconfirmed');
    }
  };
}
