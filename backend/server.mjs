import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { LocalDatabase, SupabaseDatabase } from './database.mjs';
import { LocalAuth, SupabaseAuth } from './auth.mjs';
import { configuration } from './config.mjs';
import { checkout, paymentRecord, verifiedStripeEvent } from './billing.mjs';
import { publicCatalog } from './rules/goat-games.mjs';
import { competitionAsset } from './games/routes.mjs';

export async function application(config = configuration()) {
  const db = config.mode === 'local' ? await new LocalDatabase(config.localPath).init() : new SupabaseDatabase(config);
  const auth = config.mode === 'local' ? new LocalAuth(db) : new SupabaseAuth(config);
  const limits = new Map();
  const server = createServer(async (req, res) => {
    const headers = { 'Content-Type': 'application/json', 'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer',
      'Content-Security-Policy': "default-src 'none'; script-src 'self'; style-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'" };
    if (config.appEnv === 'production') headers['Strict-Transport-Security'] = 'max-age=31536000';
    function respond(status, result) { res.writeHead(status, headers); res.end(JSON.stringify(result)); }
    try {
      if (req.headers.origin && req.headers.origin !== config.appOrigin) return respond(403, { error: 'origin_denied' });
      const url = new URL(req.url, 'http://localhost');
      if (req.method === 'GET' && url.pathname === '/goat-games') return respond(200, publicCatalog());
      if (req.method === 'GET' && (url.pathname.startsWith('/games') || ['/portal/bracket.mjs','/portal/forms.mjs','/rules/goat-games.mjs'].includes(url.pathname))) {
        const asset = await competitionAsset(url.pathname);
        if (asset) { headers['Content-Type'] = asset.type; res.writeHead(200, headers); return res.end(asset.content); }
      }
      if (req.method === 'GET' && url.pathname === '/health') {
        try { return respond(200, { status: 'ok', environment: config.appEnv, database: config.mode, ...(await db.health()), payments_enabled: config.paymentsEnabled, auth_email_enabled: config.authEmailEnabled }); }
        catch { return respond(503, { status: 'unavailable', environment: config.appEnv }); }
      }
      const portalFiles = { '/manage':'manage.html', '/manage/ui.mjs':'manage.mjs', '/manage/style.css':'manage.css', '/manage/forms.mjs':'forms.mjs', '/manage/bracket.mjs':'bracket.mjs', '/auth/callback':'callback.html', '/auth/callback.mjs':'callback.mjs' };
      if (req.method === 'GET' && url.pathname === '/nfl61.json') {
        const content = await readFile(new URL('./rules/nfl-playoffs-61.json', import.meta.url));
        res.writeHead(200, headers); return res.end(content);
      }
      if (req.method === 'GET' && Object.hasOwn(portalFiles, url.pathname)) {
        const file = portalFiles[url.pathname];
        headers['Content-Type'] = file.endsWith('.mjs') ? 'text/javascript' : file.endsWith('.css') ? 'text/css' : 'text/html';
        const content = await readFile(new URL('./portal/' + file, import.meta.url));
        res.writeHead(200, headers); return res.end(content);
      }
      if (req.method === 'GET' && ['/admin','/admin.mjs','/admin.css','/play','/play.mjs','/play.css','/crm','/crm.mjs','/crm.css'].includes(url.pathname)) {
        const file = url.pathname === '/admin' ? 'admin.html' : url.pathname === '/play' ? 'play.html' : url.pathname === '/crm' ? 'crm.html' : url.pathname.slice(1);
        headers['Content-Type'] = file.endsWith('.mjs') ? 'text/javascript' : file.endsWith('.css') ? 'text/css' : 'text/html';
        const content = await readFile(new URL('./console/' + file, import.meta.url));
        res.writeHead(200, headers); return res.end(content);
      }
      if (req.method !== 'POST') return respond(404, { error: 'route_not_found' });
      const key = req.socket.remoteAddress;
      const now = Date.now();
      for (const [k, value] of limits) if (value.until <= now) limits.delete(k);
      if (!limits.has(key) && limits.size >= 10000) return respond(429, { error: 'rate_limit' });
      const rate = limits.get(key) || { count: 0, until: now + 60000 };
      limits.set(key, rate);
      if (++rate.count > 120) return respond(429, { error: 'rate_limit' });
      let size = 0; const chunks = [];
      const max = url.pathname === '/billing/webhook' ? 262144 : 32768;
      for await (const chunk of req) { size += chunk.length; if (size > max) throw new Error('request_too_large'); chunks.push(chunk); }
      const raw = Buffer.concat(chunks);
      if (url.pathname === '/billing/webhook') {
        if (!config.paymentsEnabled) throw new Error('payments_not_enabled');
        const event = verifiedStripeEvent(raw, req.headers['stripe-signature'], config.webhookSecret);
        return respond(200, await db.systemRpc('goat_payment_event', paymentRecord(event, config.tiers)));
      }
      if (!req.headers['content-type']?.startsWith('application/json')) return respond(415, { error: 'json_required' });
      const p = JSON.parse(raw.toString('utf8'));
      if (p === null || Array.isArray(p) || typeof p !== 'object') throw new Error('invalid_request');
      if (['/auth/signup','/auth/login','/auth/refresh','/auth/recover','/auth/confirm','/auth/reset','/auth/password'].includes(url.pathname)) {
        const authKey = `auth:${key}`;
        const authRate = limits.get(authKey) || { count: 0, until: now + 60000 }; limits.set(authKey, authRate);
        if (++authRate.count > 10) return respond(429, { error: 'rate_limit' });
        if(url.pathname!=='/auth/password')return respond(url.pathname.endsWith('signup') ? 201 : 200, await auth[url.pathname.split('/').at(-1)](p));
      }
      const token = req.headers.authorization?.startsWith('Bearer ') ? req.headers.authorization.slice(7) : null;
      const user = await auth.user(token);
      if (url.pathname === '/auth/password') return respond(200,await auth.password(p,token));
      if (url.pathname === '/auth/logout') { await auth.logout(token); return respond(200, { logged_out: true }); }
      if (url.pathname === '/commands') return respond(200, await db.rpc('goat_command', p, user.databaseIdentity));
      if (url.pathname === '/query') return respond(200, await db.rpc('goat_query', p, user.databaseIdentity));
      if (url.pathname === '/billing/checkout') return respond(200, await checkout(user.id, p.tier, config));
      if (url.pathname === '/outreach/prepare') {
        const records = await db.rpc('goat_query', { op: 'crm_records' }, user.databaseIdentity);
        const prospect = records.prospects.find(x => x.id === p.prospect_id);
        if (!prospect || prospect.permission === 'do_not_contact') throw new Error('prospect_unavailable');
        // Deterministic preparation; no AI subscription or outbound sender is required.
        return respond(200, await db.rpc('goat_command', { op: 'crm_draft', prospect_id: prospect.id,
          subject: `Introduction: GOAT Universe and ${prospect.organization}`,
          body: `Hello,\n\nI'm Adam Brown, founder of GOAT Universe. We are developing a sports competition and publishing platform powered by Downtown Sports Nation and GOATverse Publications.\n\nOur research found: ${prospect.evidence}\n\nWould an introductory conversation about a possible ${prospect.category === 'investor' ? 'investment' : 'commercial'} relationship be useful?\n\nAdam Brown\nGOAT Universe\n\nInternal draft awaiting approval. No message has been sent.`
        }, user.databaseIdentity));
      }
      return respond(404, { error: 'route_not_found' });
    } catch (err) {
      const code = /^[a-z][a-z0-9_]+$/.test(err.message) ? err.message : 'request_failed';
      const status = /auth_email_not_enabled|email_recovery_unavailable|password_updated_session_revocation_failed/.test(code) ? 503 : /authentication_required|invalid_credentials|verified_email_required/.test(code) ? 401 :
        /required$|denied$|forbidden/.test(code) || err.code === '42501' ? 403 :
        err.code === '23505' ? 409 : code === 'request_too_large' ? 413 : 400;
      respond(status, { error: code });
    }
  });
  server.requestTimeout = 15000;
  server.headersTimeout = 10000;
  return { server, db, auth, async close() { await new Promise(resolve => server.close(resolve)); if (db.close) await db.close(); } };
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const config = configuration();
  const app = await application(config);
  app.server.listen(config.port, config.host, () => console.log(`GOAT backend listening on ${config.host}:${config.port} (${config.appEnv}/${config.mode})`));
  const stop = async () => { await app.close(); process.exit(0); };
  process.on('SIGTERM', stop); process.on('SIGINT', stop);
}
