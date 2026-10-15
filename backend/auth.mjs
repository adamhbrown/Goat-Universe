import { randomUUID, randomBytes, scrypt as scryptCallback, createHash, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
const scrypt = promisify(scryptCallback);
const digest = token => createHash('sha256').update(token).digest('hex');
function emailInput(email) {
  if(typeof email!=='string'||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||email.length>254)throw new Error('invalid_email');
  return email.trim().toLowerCase();
}
function passwordInput(password) {
  if(typeof password!=='string'||password.length<12||password.length>200)throw new Error('password_length_12_to_200');
  return password;
}
function linkInput(token_hash) {
  if(typeof token_hash!=='string'||!/[a-z0-9]/i.test(token_hash)||!/^[a-zA-Z0-9_-]{16,512}$/.test(token_hash))throw new Error('invalid_email_link');
  return token_hash;
}
function input({ email, password, display_name }) {
  email=emailInput(email);password=passwordInput(password);
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
    const created=await this.database.exclusive(() => this.database.db.query("insert into dev_auth.sessions(token_hash,refresh_hash,user_id,expires_at,refresh_expires_at) select $1,$2,$3,now()+interval '1 hour',now()+interval '30 days' from dev_auth.credentials where user_id=$3 and hash=$4 and salt=$5 returning user_id", [digest(token), digest(refresh), account.id,account.hash,account.salt]));
    if(!created.rows.length)throw new Error('invalid_credentials');
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
  async password(params,token) {
    const next=passwordInput(params.new_password),current=passwordInput(params.current_password);
    const account=(await this.database.exclusive(()=>this.database.db.query('select c.* from dev_auth.credentials c join dev_auth.sessions s on s.user_id=c.user_id where s.token_hash=$1 and s.expires_at>now()',[digest(token)]))).rows[0];
    if(!account)throw new Error('authentication_required');
    const calculated=await scrypt(current,account.salt,64);
    if(!timingSafeEqual(calculated,Buffer.from(account.hash,'hex')))throw new Error('invalid_credentials');
    const salt=randomBytes(16).toString('hex'),hash=(await scrypt(next,salt,64)).toString('hex');
    await this.database.exclusive(()=>this.database.db.transaction(async tx=>{
      const changed=await tx.query('update dev_auth.credentials set hash=$1,salt=$2 where user_id=$3 and hash=$4 and salt=$5 and exists(select 1 from dev_auth.sessions where token_hash=$6 and expires_at>now()) returning user_id',[hash,salt,account.user_id,account.hash,account.salt,digest(token)]);
      if(!changed.rows.length)throw new Error('authentication_required');
      await tx.query('delete from dev_auth.sessions where user_id=$1',[account.user_id]);
    }));
    return {password_updated:true,sign_in_required:true};
  }
  recover(params) {emailInput(params.email);throw new Error('email_recovery_unavailable_in_local_development');}
  confirm(params) {linkInput(params.token_hash);throw new Error('hosted_email_flow_required');}
  reset(params) {passwordInput(params.new_password);linkInput(params.token_hash);throw new Error('hosted_email_flow_required');}
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
  emailGate() {if(!this.config.authEmailEnabled)throw new Error('auth_email_not_enabled');}
  callback() {return new URL('/auth/callback',this.config.appOrigin).href;}
  async signup(params) {
    const p=input(params);this.emailGate();
    const result=await this.call('signup?redirect_to='+encodeURIComponent(this.callback()),'POST',{email:p.email,password:p.password,data:{display_name:p.display_name}});
    const user=result.user||result;
    return {confirmation_required:!user.email_confirmed_at,environment:'supabase'};
  }
  async recover(params) {
    const email=emailInput(params.email);this.emailGate();
    // GoTrue's recovery endpoint intentionally uses the same response for
    // registered and unknown emails. No account lookup or arbitrary redirect.
    await this.call('recover?redirect_to='+encodeURIComponent(this.callback()),'POST',{email});
    return {recovery_requested:true};
  }
  async confirm(params) {
    const token_hash=linkInput(params.token_hash);this.emailGate();
    const session=await this.call('verify','POST',{token_hash,type:'email'});
    if(!session.user?.id||!session.user.email_confirmed_at||!session.access_token)throw new Error('email_confirmation_failed');
    // A scanner loading GET /auth/callback cannot confirm an address. Explicit
    // POST confirmation does not return a login session to the browser.
    await this.call('logout?scope=local','POST',{},session.access_token);
    return {email_confirmed:true,sign_in_required:true};
  }
  async reset(params) {
    const password=passwordInput(params.new_password),token_hash=linkInput(params.token_hash);this.emailGate();
    const session=await this.call('verify','POST',{token_hash,type:'recovery'});
    if(!session.user?.id||!session.user.email_confirmed_at||!session.access_token)throw new Error('email_recovery_failed');
    return this.replacePassword(password,session.access_token);
  }
  async password(params,token) {
    const next=passwordInput(params.new_password),current=passwordInput(params.current_password);
    const user=await this.user(token);
    const fresh=await this.login({email:user.email,password:current});
    if(fresh.user?.id!==user.id||!fresh.access_token)throw new Error('reauthentication_failed');
    return this.replacePassword(next,fresh.access_token);
  }
  async replacePassword(password,token) {
    try {await this.call('user','PUT',{password},token);}
    catch(error){try{await this.call('logout?scope=local','POST',{},token);}catch{}throw error;}
    // Database session guards reject old JWTs after GoTrue removes sessions.
    try {await this.call('logout?scope=global','POST',{},token);}
    catch {throw new Error('password_updated_session_revocation_failed');}
    return {password_updated:true,sign_in_required:true};
  }
  login(params) { const p = input(params); return this.call('token?grant_type=password', 'POST', { email: p.email, password: p.password }); }
  refresh(params) {
    if (typeof params.refresh_token !== 'string' || params.refresh_token.length > 8192) throw new Error('invalid_refresh_token');
    return this.call('token?grant_type=refresh_token','POST',{refresh_token:params.refresh_token});
  }
  async user(token) {
    if (!token || token.length > 8192) throw new Error('authentication_required');
    const user = await this.call('user', 'GET', null, token);
    if(user.is_anonymous||user.banned_until&&Date.parse(user.banned_until)>Date.now())throw new Error('authentication_required');
    if (!user.email_confirmed_at || !user.id) throw new Error('verified_email_required');
    return { ...user, databaseIdentity: token };
  }
  logout(token) { return this.call('logout', 'POST', {}, token); }
}
