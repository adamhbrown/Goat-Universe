import { randomUUID, randomBytes, scrypt as scryptCallback, createHash, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
const scrypt = promisify(scryptCallback);
const digest = token => createHash('sha256').update(token).digest('hex');
function input({ email, password, display_name }) {
  if (typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) throw new Error('invalid_email');
  if (typeof password !== 'string' || password.length < 12 || password.length > 200) throw new Error('password_length_12_to_200');
  if (display_name !== undefined && (typeof display_name !== 'string' || !display_name.trim() || display_name.length > 80)) throw new Error('invalid_display_name');
  return { email: email.trim().toLowerCase(), password, display_name: display_name?.trim() };
}
export class LocalAuth {
  constructor(database) { this.database = database; }
  async signup(params) {
    const p = input(params), id = randomUUID(), salt = randomBytes(16).toString('hex');
    const hash = (await scrypt(p.password, salt, 64)).toString('hex');
    await this.database.exclusive(() => this.database.db.transaction(async tx => {
      await tx.query('insert into auth.users(id,email,raw_user_meta_data) values($1,$2,$3)', [id, p.email, JSON.stringify({ display_name: p.display_name })]);
      await tx.query('insert into dev_auth.credentials(user_id,hash,salt) values($1,$2,$3)', [id, hash, salt]);
    })).catch(() => { throw new Error('account_creation_failed'); });
    return { user: { id, email: p.email }, confirmation_required: false, environment: 'local-development' };
  }
  async login(params) {
    const p = input(params);
    const rows = await this.database.exclusive(() => this.database.db.query('select u.id,c.hash,c.salt from auth.users u join dev_auth.credentials c on c.user_id=u.id where u.email=$1', [p.email]));
    const account = rows.rows[0];
    const calculated = await scrypt(p.password, account?.salt || 'unknown-account-placeholder', 64);
    if (!account || !timingSafeEqual(calculated, Buffer.from(account.hash, 'hex'))) throw new Error('invalid_credentials');
    const token = randomBytes(32).toString('base64url'), refresh = randomBytes(32).toString('base64url');
    await this.database.exclusive(() => this.database.db.query("insert into dev_auth.sessions(token_hash,refresh_hash,user_id,expires_at,refresh_expires_at) values($1,$2,$3,now()+interval '1 hour',now()+interval '30 days')", [digest(token), digest(refresh), account.id]));
    return { access_token: token, refresh_token: refresh, expires_in: 3600, token_type: 'bearer' };
  }
  async refresh(params) {
    if (typeof params.refresh_token !== 'string' || params.refresh_token.length > 4096) throw new Error('invalid_refresh_token');
    const token = randomBytes(32).toString('base64url'), refresh = randomBytes(32).toString('base64url');
    const result = await this.database.exclusive(() => this.database.db.query("update dev_auth.sessions set token_hash=$1,refresh_hash=$2,expires_at=now()+interval '1 hour' where refresh_hash=$3 and refresh_expires_at>now() returning user_id", [digest(token),digest(refresh),digest(params.refresh_token)]));
    if (!result.rows.length) throw new Error('invalid_refresh_token');
    return { access_token: token, refresh_token: refresh, expires_in: 3600, token_type: 'bearer' };
  }
  async user(token) {
    if (!token || token.length > 4096) throw new Error('authentication_required');
    const r = await this.database.exclusive(() => this.database.db.query('select u.id,u.email from dev_auth.sessions s join auth.users u on u.id=s.user_id where token_hash=$1 and expires_at>now()', [digest(token)]));
    if (!r.rows[0]) throw new Error('authentication_required');
    return { ...r.rows[0], databaseIdentity: r.rows[0].id };
  }
  logout(token) { return this.database.exclusive(() => this.database.db.query('delete from dev_auth.sessions where token_hash=$1', [digest(token)])); }
}
export class SupabaseAuth {
  constructor(config, fetchImpl = fetch) { this.config = config; this.fetch = fetchImpl; }
  async call(path, method, body, token) {
    const response = await this.fetch(`${this.config.url}/auth/v1/${path}`, {
      method, headers: { apikey: this.config.publishableKey, 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(15000)
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(path === 'user' ? 'authentication_required' : 'authentication_failed');
    return result;
  }
  signup(params) { const p = input(params); return this.call('signup', 'POST', { email: p.email, password: p.password, data: { display_name: p.display_name } }); }
  login(params) { const p = input(params); return this.call('token?grant_type=password', 'POST', { email: p.email, password: p.password }); }
  refresh(params) {
    if (typeof params.refresh_token !== 'string' || params.refresh_token.length > 8192) throw new Error('invalid_refresh_token');
    return this.call('token?grant_type=refresh_token','POST',{refresh_token:params.refresh_token});
  }
  async user(token) {
    if (!token || token.length > 8192) throw new Error('authentication_required');
    const user = await this.call('user', 'GET', null, token);
    if (!user.email_confirmed_at || !user.id) throw new Error('verified_email_required');
    return { ...user, databaseIdentity: token };
  }
  logout(token) { return this.call('logout', 'POST', {}, token); }
}
