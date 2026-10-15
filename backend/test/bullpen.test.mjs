import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { application } from '../server.mjs';
import { configuration } from '../config.mjs';
import { LocalDatabase } from '../database.mjs';
import { LocalAuth } from '../auth.mjs';

// Transport/security fixtures, NOT independent AI agents or live workstream reports.
const PROMPT = 'Team, give me the status of our five GOAT Games and the October 21 engineering deadline.';
let app, base, acceptanceMessage;
const users = {};
async function call(path, body, who = 'adam', extra = {}) {
  const r = await fetch(base + path, { method:'POST',headers:{'Content-Type':'application/json',...(users[who] ? {Authorization:`Bearer ${users[who].token}`} : {}),...extra},body:JSON.stringify(body) });
  return {status:r.status,data:await r.json()};
}
async function cmd(body, who = 'adam') {
  const result = await call('/bullpen/commands',body,who); assert.equal(result.status,200,JSON.stringify(result)); return result.data;
}
async function query(body = {op:'snapshot'}, who = 'adam') {
  const result = await call('/bullpen/query',body,who); assert.equal(result.status,200,JSON.stringify(result)); return result.data;
}
async function bind(seat, kind = 'manual', enabled = true) {
  const current = (await query()).seats.find(s => s.id === seat);
  return cmd({op:'seat_bind',seat,user_id:users[seat].id,enabled,connection_kind:kind,version:current.version});
}
before(async () => {
  app = await application({...configuration({}),localPath:undefined});
  await new Promise(resolve => app.server.listen(0,'127.0.0.1',resolve)); base = `http://127.0.0.1:${app.server.address().port}`;
  for (const name of ['adam','tiffany','pope','codex','outsider']) {
    const account = await app.auth.signup({email:`bullpen-${name}@fixture.invalid`,password:'TEST-Fixture-Password-1234',display_name:'TEST '+name});
    const login = await app.auth.login({email:`bullpen-${name}@fixture.invalid`,password:'TEST-Fixture-Password-1234'});
    users[name] = {id:account.user.id,token:login.access_token};
  }
  await app.db.db.query("update bullpen_private.seats set user_id=$1,enabled=true where id='adam'",[users.adam.id]);
});
after(async () => { await app.close(); });

test('private records require live authentication and explicit membership; public shell is empty',async () => {
  const shell = await fetch(base + '/bullpen'); assert.equal(shell.status,200);
  assert.match(shell.headers.get('content-security-policy'),/frame-ancestors 'none'/);
  const html = await shell.text(); assert.match(html,/GOAT Universe Bullpen/); assert.doesNotMatch(html,/bullpen-adam@/);
  assert.equal((await call('/bullpen/query',{},'anonymous')).status,401);
  assert.equal((await call('/bullpen/query',{},'outsider')).status,403);
  assert.equal((await call('/bullpen/query',{},'adam',{Origin:'https://untrusted.invalid'})).status,403);
  await app.db.db.query("insert into public.goat_roles(user_id,role) values($1,'executive')",[users.outsider.id]);
  assert.equal((await call('/bullpen/query',{},'outsider')).status,403,'General executive role cannot enter the Bullpen');
  await app.db.db.query("update auth.users set raw_user_meta_data=$1 where id=$2",[JSON.stringify({seat:'adam',role:'executive'}),users.outsider.id]);
  assert.equal((await call('/bullpen/query',{},'outsider')).status,403,'User metadata cannot grant a seat');
  for (const role of ['anon','authenticated','service_role']) {
    await assert.rejects(app.db.db.transaction(async tx => { await tx.exec(`set local role ${role}`); await tx.query('select * from bullpen_private.messages'); }),/permission denied/);
  }
  await assert.rejects(app.db.rpc('bullpen_query',{},null,'anon'),/permission denied/);
  await assert.rejects(app.db.rpc('bullpen_query',{},null),/authentication_required/);
  await assert.rejects(app.db.rpc('bullpen_command',{op:'message_post',content:'TEST'},users.outsider.id),/bullpen_membership_required/);
});

test('exact CEO prompt persists once, mentions are metadata, and disconnected seats report no delivery',async () => {
  const client_id = randomUUID();
  acceptanceMessage = await cmd({op:'message_post',content:PROMPT,client_id,seat:'pope',actor_id:users.pope.id});
  assert.equal(acceptanceMessage.seat,'adam'); assert.equal(acceptanceMessage.actor_id,users.adam.id);
  assert.equal(acceptanceMessage.content,PROMPT); assert.ok(acceptanceMessage.created_at);
  assert.equal((await cmd({op:'message_post',content:PROMPT,client_id})).id,acceptanceMessage.id);
  assert.equal((await call('/bullpen/commands',{op:'message_post',content:'Changed TEST message',client_id})).status,409);
  const snapshot = await query(); assert.equal(snapshot.messages.length,1);
  assert.equal(snapshot.seats.filter(s => s.status === 'unbound').length,3);
  const report = await query({op:'acceptance',message_id:acceptanceMessage.id});
  assert.ok(report.seats.every(s => !s.received_at && !s.reply_id));
  const mentions = await cmd({op:'message_post',content:'TEST @Tiffany @POPE @Codex @Codextra',client_id:randomUUID()});
  assert.deepEqual(mentions.mentions,['codex','pope','tiffany']);
  for (const name of ['tiffany','pope','codex']) await bind(name);
  assert.equal((await query({},'tiffany')).messages[0].content,PROMPT);
  assert.equal((await query({op:'acceptance',message_id:acceptanceMessage.id})).seats[0].received_at,null,'Manual viewing is not an API read receipt');
});

test('verified fixture API clients read and reply in one thread; polling never manufactures a response',async () => {
  for (const name of ['tiffany','pope','codex']) {
    assert.equal((await call('/bullpen/query',{op:'poll'},name)).status,403);
    await bind(name,'api');
    assert.equal((await query()).seats.find(s => s.id === name).status,'api_waiting');
    assert.equal((await call('/bullpen/commands',{op:'message_post',source:'api',content:'TEST unread context',reply_to:acceptanceMessage.id,client_id:randomUUID()},name)).data.error,'read_context_required');
    const before = (await query()).messages.length;
    const polled = await query({op:'poll',after:0},name);
    assert.ok(polled.messages.some(m => m.id === acceptanceMessage.id));
    assert.ok(Array.isArray(polled.tasks)); assert.ok(Array.isArray(polled.intelligence));
    assert.equal((await query()).messages.length,before,'Read never generates AI text');
    const reply = await cmd({op:'message_post',source:'api',reply_to:acceptanceMessage.id,content:`TEST ${name} transport fixture. No live project status asserted.`,client_id:randomUUID(),seat:'adam'},name);
    assert.equal(reply.seat,name); assert.equal(reply.source,'api');
    assert.equal((await query()).seats.find(s => s.id === name).status,'connected');
  }
  const report = await query({op:'acceptance',message_id:acceptanceMessage.id});
  assert.ok(report.seats.every(s => s.received_at && s.reply_id),'Transport evidence is distinct from a live AI demonstration');
  await app.db.db.query("update bullpen_private.seats set last_api_poll_at=now()-interval '2 minutes' where id='pope'");
  assert.equal((await query()).seats.find(s => s.id === 'pope').status,'stale');
  await bind('pope','api',false);
  assert.equal((await call('/bullpen/query',{},'pope')).status,403);
  assert.equal((await query({op:'acceptance',message_id:acceptanceMessage.id})).seats.find(s => s.seat === 'pope').received_at,null,'Rebinding resets connection evidence');
  await bind('pope','api');
});

test('tasks enforce unique active work, owner permissions, optimistic concurrency and completion evidence',async () => {
  const task = await cmd({op:'task_create',work_key:'engines/test-lane',title:'TEST engine assignment',owner:'codex',priority:'high',deadline:'2026-10-21T17:00:00Z'},'codex');
  assert.equal((await call('/bullpen/commands',{op:'task_create',work_key:task.work_key,title:'TEST duplicate',owner:'tiffany'},'tiffany')).status,409);
  assert.equal((await call('/bullpen/commands',{op:'task_update',id:task.id,version:task.version,status:'in_progress'},'pope')).status,403);
  assert.equal((await call('/bullpen/commands',{op:'task_update',id:task.id,version:task.version,owner:'pope'},'codex')).status,403);
  const updates = await Promise.all(['in_progress','awaiting_approval'].map(status => call('/bullpen/commands',{op:'task_update',id:task.id,version:task.version,status},'codex')));
  assert.deepEqual(updates.map(r => r.status).sort(),[200,409]);
  const current = (await query()).tasks.find(t => t.id === task.id);
  assert.equal((await call('/bullpen/commands',{op:'task_update',id:task.id,version:current.version,status:'done'},'codex')).status,400);
  assert.equal((await call('/bullpen/commands',{op:'task_update',id:task.id,version:current.version,status:'blocked'},'codex')).status,400);
  const done = await cmd({op:'task_update',id:task.id,version:current.version,status:'done',evidence:'TEST fixture verification only'},'codex');
  assert.equal(done.status,'done'); assert.ok(done.evidence);
  assert.equal((await call('/bullpen/commands',{op:'task_update',id:done.id,version:done.version,status:'todo'},'codex')).data.error,'task_closed');
});

test('only Adam can approve protected operations and scope changes invalidate prior approval',async () => {
  const task = await cmd({op:'task_create',work_key:'infra/test-migration',title:'TEST migration proposal',owner:'pope',approval_kind:'migration'},'pope');
  assert.equal(task.approval_state,'pending');
  assert.equal((await call('/bullpen/commands',{op:'task_decide',id:task.id,version:task.version,approved:true,reason:'TEST unauthorized'},'tiffany')).status,403);
  assert.equal((await call('/bullpen/commands',{op:'task_update',id:task.id,version:task.version,status:'done',approval_state:'approved',evidence:'TEST unauthorized'},'pope')).status,400);
  const approved = await cmd({op:'task_decide',id:task.id,version:task.version,approved:true,reason:'TEST record only; no operation executed'});
  const changed = await cmd({op:'task_update',id:approved.id,version:approved.version,title:'TEST revised migration'},'tiffany');
  assert.equal(changed.approval_state,'pending');
  assert.equal((await call('/bullpen/commands',{op:'task_update',id:changed.id,version:changed.version,approval_kind:'none'},'tiffany')).status,403);
  const again = await cmd({op:'task_decide',id:changed.id,version:changed.version,approved:true,reason:'TEST revised scope'});
  const finished = await cmd({op:'task_update',id:again.id,version:again.version,status:'done',evidence:'TEST audited completion evidence'},'pope');
  assert.equal(finished.approval_state,'approved');
  const audit = await app.db.db.query("select * from bullpen_private.audit where action='task_decide' and entity_id=$1",[task.id]);
  assert.equal(audit.rows.length,2); assert.ok(audit.rows.every(r => r.seat === 'adam' && r.detail.reason));
});

test('shared intelligence keeps one approved authority per topic with immutable evidence history',async () => {
  const first = await cmd({op:'intelligence_add',topic:'rules/test-topic',kind:'rule',content:'TEST proposed rule',evidence:'TEST source'},'tiffany');
  assert.equal(first.state,'proposed');
  assert.equal((await call('/bullpen/commands',{op:'intelligence_decide',id:first.id,approved:true,reason:'TEST'},'codex')).status,403);
  await cmd({op:'intelligence_decide',id:first.id,approved:true,reason:'TEST founder decision'});
  const second = await cmd({op:'intelligence_add',topic:first.topic,kind:'rule',content:'TEST revised rule',evidence:'TEST newer source'},'tiffany');
  await cmd({op:'intelligence_decide',id:second.id,approved:true,reason:'TEST superseding decision'});
  const records = (await query()).intelligence.filter(i => i.topic === first.topic);
  assert.equal(records.find(i => i.id === first.id).state,'superseded');
  assert.equal(records.filter(i => i.state === 'approved').length,1);
  assert.equal(records.find(i => i.id === first.id).content,'TEST proposed rule');
});

test('recognizable credentials are rejected before storage, including task and intelligence text',async () => {
  const secret = 'ghp_' + 'x'.repeat(32); // Deliberate fake scanner fixture.
  assert.equal((await call('/bullpen/commands',{op:'message_post',content:secret,client_id:randomUUID()})).data.error,'credential_content_forbidden');
  assert.equal((await call('/bullpen/commands',{op:'task_create',title:secret,work_key:'test/secret',owner:'adam'})).data.error,'credential_content_forbidden');
  assert.equal((await call('/bullpen/commands',{op:'intelligence_add',topic:'test/secret',kind:'finding',content:'TEST',evidence:secret})).data.error,'credential_content_forbidden');
  assert.equal((await app.db.db.query('select count(*) n from bullpen_private.messages where content=$1',[secret])).rows[0].n,0);
});

test('poll pagination provides all messages in order and idempotent read receipts',async () => {
  await app.db.db.query(`insert into bullpen_private.messages(seat,actor_id,source,content,client_id)
    select 'adam',$1,'manual','TEST pagination fixture '||g,gen_random_uuid() from generate_series(1,105) g`,[users.adam.id]);
  let cursor = 0; const received = [];
  do { const page = await query({op:'poll',after:cursor},'codex'); received.push(...page.messages); assert.ok(page.next_cursor>=cursor); cursor = page.next_cursor; if (!page.has_more) break; } while (true);
  const count = (await app.db.db.query('select count(*) n from bullpen_private.messages')).rows[0].n;
  assert.equal(received.length,count); assert.equal(new Set(received.map(m => m.id)).size,count);
  assert.equal((await query({op:'poll',after:cursor},'codex')).messages.length,0);
  const recent = await query(); const history = await query({op:'history',before:recent.messages[0].id});
  assert.equal(recent.messages.length+history.messages.length,count);
  await app.auth.logout(users.codex.token);
  assert.equal((await call('/bullpen/query',{op:'poll'},'codex')).status,401);
});

test('messages, tasks, intelligence and approvals survive a disk-backed PostgreSQL restart',async () => {
  const path = await mkdtemp(join(tmpdir(),'goat-bullpen-persistence-')); let database;
  try {
    database = await new LocalDatabase(path).init();
    const auth = new LocalAuth(database);
    const {user} = await auth.signup({email:'persist-bullpen@fixture.invalid',password:'TEST-Persistence-Password-1234'});
    await database.db.query("update bullpen_private.seats set user_id=$1,enabled=true where id='adam'",[user.id]);
    const message = await database.rpc('bullpen_command',{op:'message_post',client_id:randomUUID(),content:PROMPT},user.id);
    await database.rpc('bullpen_command',{op:'task_create',work_key:'test/persistent',title:'TEST durable task',owner:'adam',approval_kind:'major_change'},user.id);
    await database.rpc('bullpen_command',{op:'intelligence_add',topic:'test/durable',kind:'finding',content:'TEST durable finding',evidence:'TEST disk verification'},user.id);
    await database.close(); database = await new LocalDatabase(path).init();
    const snapshot = await database.rpc('bullpen_query',{},user.id);
    assert.equal(snapshot.messages[0].id,message.id); assert.equal(snapshot.messages[0].content,PROMPT);
    assert.equal(snapshot.tasks[0].approval_state,'pending'); assert.equal(snapshot.intelligence[0].content,'TEST durable finding');
    assert.equal((await database.db.query('select count(*) n from bullpen_private.audit')).rows[0].n,3);
  } finally { if (database) await database.close(); await rm(path,{recursive:true,force:true}); }
});

test('Bullpen RPCs fail closed for missing, mismatched, expired and revoked hosted-shape sessions',async () => {
  // PostgreSQL compatibility fixture, not evidence of a live Supabase login.
  await app.db.db.exec(`alter table auth.users add column email_confirmed_at timestamptz default now();
    alter table auth.users add column is_anonymous boolean default false;
    alter table auth.users add column banned_until timestamptz;
    create table auth.sessions(id uuid primary key,user_id uuid,not_after timestamptz);`);
  const sid = randomUUID();
  await app.db.db.query('insert into auth.sessions values($1,$2,now()+interval \'1 hour\')',[sid,users.adam.id]);
  async function rpc(sessionId) {
    return app.db.db.transaction(async tx => {
      await tx.exec('set local role authenticated');
      await tx.query("select set_config('request.jwt.claim.sub',$1,true)",[users.adam.id]);
      await tx.query("select set_config('request.jwt.claims',$1,true)",[JSON.stringify({session_id:sessionId})]);
      return tx.query("select public.bullpen_query('{}'::jsonb) as result");
    });
  }
  assert.equal((await rpc(sid)).rows[0].result.me,'adam');
  await assert.rejects(rpc(undefined),/authentication_required/);
  await assert.rejects(rpc(randomUUID()),/authentication_required/);
  await app.db.db.query('update auth.sessions set user_id=$1 where id=$2',[users.outsider.id,sid]);
  await assert.rejects(rpc(sid),/authentication_required/);
  await app.db.db.query("update auth.sessions set user_id=$1,not_after=now()-interval '1 second' where id=$2",[users.adam.id,sid]);
  await assert.rejects(rpc(sid),/authentication_required/);
  await app.db.db.query('delete from auth.sessions where id=$1',[sid]);
  await assert.rejects(rpc(sid),/authentication_required/);
});
