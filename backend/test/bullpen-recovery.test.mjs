import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {PGlite} from '@electric-sql/pglite';
import {LocalDatabase} from '../database.mjs';
import {LocalAuth} from '../auth.mjs';

test('Bullpen local backup restores all private records, seat bindings and denial boundaries',async t=>{
  const db=await new LocalDatabase().init();t.after(()=>db.close());
  const auth=new LocalAuth(db),users={};
  for (const name of ['adam','pope','outsider']) {
    users[name]=(await auth.signup({email:`recovery-${name}@fixture.invalid`,password:'Local-Recovery-TEST-1234',display_name:'TEST RECOVERY '+name})).user.id;
  }
  await db.db.query("update bullpen_private.seats set user_id=$1,enabled=true where id='adam'",[users.adam]);
  const cmd=(p,who='adam')=>db.rpc('bullpen_command',p,users[who]);
  const query=(p,who='adam')=>db.rpc('bullpen_query',p,users[who]);
  const before=(await query({op:'snapshot'})).seats.find(s=>s.id==='pope');
  await cmd({op:'seat_bind',seat:'pope',user_id:users.pope,enabled:true,connection_kind:'api',version:before.version});
  const message=await cmd({op:'message_post',content:'Team, give me the status of our five GOAT Games and the October 21 engineering deadline.',client_id:randomUUID()});
  await query({op:'poll',after:0},'pope');
  await cmd({op:'message_post',source:'api',reply_to:message.id,content:'TEST recovery fixture only. No real workstream or live status.',client_id:randomUUID()},'pope');
  await cmd({op:'task_create',work_key:'recovery-test',title:'TEST recovery task',owner:'pope',priority:'high'});
  await cmd({op:'intelligence_add',topic:'recovery-test',kind:'finding',content:'TEST recovery fixture. No hosted recovery claim.',evidence:'https://fixtures.invalid/recovery'});
  const tables=['seats','messages','receipts','tasks','intelligence','audit'],records={};
  const beforeAcceptance={};
  for (const table of tables) beforeAcceptance[table]=(await db.db.query(`select to_jsonb(t)::text as row from bullpen_private.${table} t order by to_jsonb(t)::text`)).rows;
  const acceptance=await query({op:'acceptance',message_id:message.id});
  for (const table of tables) records[table]=(await db.db.query(`select to_jsonb(t)::text as row from bullpen_private.${table} t order by to_jsonb(t)::text`)).rows;
  assert.deepEqual(records,beforeAcceptance,'Acceptance inspection must not update presence, receipts, content or audit');
  assert.ok(records.receipts.length>0);assert.ok(records.audit.length>0);
  const restored=await PGlite.create({loadDataDir:await db.db.dumpDataDir()});t.after(()=>restored.close());
  for (const table of tables) {
    assert.deepEqual((await restored.query(`select to_jsonb(t)::text as row from bullpen_private.${table} t order by to_jsonb(t)::text`)).rows,records[table],table);
  }
  async function rpc(p,user,role='authenticated') {
    return restored.transaction(async tx=>{
      await tx.exec(`set local role ${role}`);
      await tx.query("select set_config('request.jwt.claim.sub',$1,true)",[user || '']);
      return (await tx.query('select public.bullpen_query($1::jsonb) as result',[JSON.stringify(p)])).rows[0].result;
    });
  }
  assert.deepEqual(await rpc({op:'acceptance',message_id:message.id},users.adam),acceptance);
  await assert.rejects(rpc({op:'snapshot'},null,'anon'),/permission denied/);
  await assert.rejects(rpc({op:'snapshot'},users.outsider),/bullpen_membership_required/);
  for (const role of ['anon','authenticated','service_role']) {
    await assert.rejects(restored.transaction(async tx=>{await tx.exec(`set local role ${role}`);await tx.query('select * from bullpen_private.messages');}),/permission denied/);
  }
  await restored.query("update bullpen_private.seats set enabled=false where id='pope'");
  await assert.rejects(rpc({op:'snapshot'},users.pope),/bullpen_membership_required/);
  // All writes above are synthetic local fixtures; no hosted target or account is touched.
});
