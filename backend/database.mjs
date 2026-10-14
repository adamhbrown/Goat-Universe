import { PGlite } from '@electric-sql/pglite';
import { readFile, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { mkdirSync } from 'node:fs';

const migrations = fileURLToPath(new URL('../supabase/migrations/', import.meta.url));
const bootstrap = `
  create role anon; create role authenticated; create role service_role;
  create schema auth;
  create table auth.users(id uuid primary key, email text unique, raw_user_meta_data jsonb default '{}');
  create function auth.uid() returns uuid language sql stable as $$
    select nullif(current_setting('request.jwt.claim.sub', true),'')::uuid;
  $$;
  grant usage on schema auth to anon,authenticated,service_role;
  grant execute on function auth.uid() to anon,authenticated,service_role;
  create schema dev_auth;
  create table dev_auth.credentials(user_id uuid primary key references auth.users(id), hash text not null, salt text not null);
  create table dev_auth.sessions(token_hash text primary key, refresh_hash text unique not null, user_id uuid references auth.users(id), expires_at timestamptz not null, refresh_expires_at timestamptz not null);
  create table dev_auth.migrations(name text primary key);
`;

/** Development uses PostgreSQL WASM, not an in-memory business-logic substitute. */
export class LocalDatabase {
  constructor(path) {
    if (path) mkdirSync(path, { recursive: true, mode: 0o700 });
    this.db = new PGlite(path); this.queue = Promise.resolve();
  }
  exclusive(fn) {
    const next = this.queue.then(fn, fn);
    this.queue = next.catch(() => {});
    return next;
  }
  async init() {
    await this.db.waitReady;
    const found = await this.db.query("select to_regclass('dev_auth.migrations') as exists");
    if (!found.rows[0].exists) await this.db.exec(bootstrap);
    for (const file of (await readdir(migrations)).filter(f => f.endsWith('.sql')).sort()) {
      const applied = await this.db.query('select 1 from dev_auth.migrations where name=$1', [file]);
      if (applied.rows.length) continue;
      await this.db.transaction(async tx => {
        await tx.exec(await readFile(migrations + file, 'utf8'));
        await tx.query('insert into dev_auth.migrations(name) values($1)', [file]);
      });
    }
    return this;
  }
  async rpc(fn, p, userId, role = 'authenticated') {
    if (!['goat_command', 'goat_query', 'goat_payment_event'].includes(fn)) throw new Error('invalid_rpc');
    if (!['authenticated', 'service_role', 'anon'].includes(role)) throw new Error('invalid_role');
    return this.exclusive(() => this.db.transaction(async tx => {
      await tx.exec(`set local role ${role}`);
      await tx.query("select set_config('request.jwt.claim.sub',$1,true)", [userId || '']);
      const r = await tx.query(`select public.${fn}($1::jsonb) as result`, [JSON.stringify(p)]);
      return r.rows[0].result;
    }));
  }
  systemRpc(fn, p) { return this.rpc(fn, p, null, 'service_role'); }
  health() { return this.exclusive(async () => (await this.db.query('select public.goat_health() as health')).rows[0].health); }
  close() { return this.db.close(); }
}

export class SupabaseDatabase {
  constructor(config, fetchImpl = fetch) { this.config = config; this.fetch = fetchImpl; }
  async rpc(fn, p, userToken, system = false) {
    if (!['goat_command', 'goat_query', 'goat_payment_event'].includes(fn)) throw new Error('invalid_rpc');
    const key = system ? this.config.systemKey : this.config.publishableKey;
    if (!key) throw new Error('billing_system_key_missing');
    const headers = { apikey: key, 'Content-Type': 'application/json' };
    // Publishable keys and modern secret keys are not JWTs. User JWT stays separate.
    if (!system) headers.Authorization = `Bearer ${userToken}`;
    else if (key.startsWith('eyJ')) headers.Authorization = `Bearer ${key}`;
    const response = await this.fetch(`${this.config.url}/rest/v1/rpc/${fn}`, {
      method: 'POST', headers, body: JSON.stringify({ p }), signal: AbortSignal.timeout(15000)
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || 'database_request_failed');
    return data;
  }
  systemRpc(fn, p) { return this.rpc(fn, p, null, true); }
  async health() {
    const response = await this.fetch(`${this.config.url}/rest/v1/rpc/goat_health`, { method: 'POST', headers: { apikey: this.config.publishableKey, 'Content-Type': 'application/json' }, body: '{}', signal: AbortSignal.timeout(5000) });
    if (!response.ok) throw new Error('database_unavailable');
    return response.json();
  }
}
