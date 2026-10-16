// In-process API abuse protection for the development backend.
// No trust in X-Forwarded-For: reverse-proxy identity must be established by the
// approved gateway before any production multi-instance rollout.
export function createRequestLimiter({
  now = Date.now,
  windowMs = 60_000,
  maxClients = 10_000,
  postLimit = 120,
  authLimit = 10,
  sweepIntervalMs = 10_000
} = {}) {
  for (const value of [windowMs,maxClients,postLimit,authLimit,sweepIntervalMs]) {
    if (!Number.isSafeInteger(value) || value < 1) throw new Error('invalid_rate_limit_configuration');
  }
  if (typeof now !== 'function') throw new Error('invalid_rate_limit_clock');
  const clients=new Map();
  let nextSweep=0;

  function sweep(at) {
    for(const [key,bucket] of clients) if(bucket.until <= at) clients.delete(key);
    nextSweep = at + Math.min(windowMs,sweepIntervalMs);
  }
  function allow(socketAddress,scope='post') {
    if(scope !== 'post' && scope !== 'auth') throw new Error('invalid_rate_limit_scope');
    // socketAddress is the *socket peer*, never a visitor-controlled header.
    const key=typeof socketAddress === 'string' && socketAddress.length && socketAddress.length <= 128
      ? socketAddress : 'unknown-peer';
    const at=now();
    if(!Number.isSafeInteger(at) || at < 0) throw new Error('invalid_rate_limit_time');
    if(at >= nextSweep) sweep(at);
    let bucket=clients.get(key);
    if(!bucket || bucket.until <= at) {
      if(!bucket && clients.size >= maxClients) return false;
      bucket={until:at + windowMs,post:0,auth:0};
      clients.set(key,bucket);
    }
    if(scope === 'post') return ++bucket.post <= postLimit;
    return ++bucket.auth <= authLimit;
  }
  return Object.freeze({
    allow,
    // Count only; no user identifiers or IPs returned to callers.
    activeClients:()=>clients.size
  });
}
