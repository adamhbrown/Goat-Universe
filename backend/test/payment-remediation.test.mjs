// Executes only against a disposable PostgreSQL-WASM database, never Supabase.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {LocalDatabase} from '../database.mjs';

test('review candidate replaces subscriptions, rejects stale/retired events, preserves replay and access controls',async()=>{
 const db=await new LocalDatabase().init();
 try {
  await db.db.exec(await readFile(new URL('../remediation/payment-subscription-replacement.sql',import.meta.url),'utf8'));
  const id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  await db.db.query('insert into auth.users(id,email) values($1,$2)',[id,'billing@fixture.invalid']);
  const event=(event_id,subscription_id,event_time,status='active')=>({event_id,event_type:'customer.subscription.updated',user_id:id,tier:'member',status,subscription_id,event_time,expires_at:'2030-01-01T00:00:00Z'});
  const deliver=p=>db.systemRpc('goat_payment_event',p);
  const current=async()=>(await db.db.query('select * from public.goat_memberships where user_id=$1',[id])).rows[0];
  await deliver(event('evt_initial','sub_first',100));
  await deliver(event('evt_cancel','sub_first',110,'canceled'));
  const replacement=event('evt_replacement','sub_second',120);
  assert.deepEqual(await deliver(replacement),{recorded:true});
  assert.equal((await current()).subscription_id,'sub_second');
  assert.equal((await current()).status,'active');
  assert.deepEqual((await current()).retired_subscription_ids,['sub_first']);
  assert.deepEqual(await deliver(replacement),{duplicate:true});
  await deliver(event('evt_stale','sub_third',115));
  await deliver(event('evt_equal','sub_third',120));
  await deliver(event('evt_retired_late_cancel','sub_first',130,'canceled'));
  await deliver(event('evt_retired_late_active','sub_first',140));
  assert.equal((await current()).subscription_id,'sub_second');
  assert.equal((await current()).status,'active');
  await deliver(event('evt_current_cancel','sub_second',150,'canceled'));
  await deliver(event('evt_third','sub_third',160,'trialing'));
  assert.deepEqual((await current()).retired_subscription_ids,['sub_first','sub_second']);
  await deliver(event('evt_retired_second','sub_second',170));
  assert.equal((await current()).subscription_id,'sub_third');
  assert.equal((await current()).status,'trialing');
  for(const role of ['anon','authenticated']) await assert.rejects(db.rpc('goat_payment_event',event('evt_denied_'+role,'sub_denied',200),id,role),/permission denied/);
  await assert.rejects(deliver({...event('evt_retry','sub_retry',180),status:'invalid'}),/check constraint/);
  assert.equal((await db.db.query("select count(*) n from public.goat_payment_events where event_id='evt_retry'")).rows[0].n,0,'Failed transactions must remain retryable');
  await deliver(event('evt_retry','sub_retry',180));
  assert.equal((await current()).subscription_id,'sub_retry');
  const flags=(await db.db.query("select prosecdef,proconfig from pg_proc where oid='public.goat_payment_event(jsonb)'::regprocedure")).rows[0];
  assert.equal(flags.prosecdef,true);assert.ok(flags.proconfig.some(x=>x==='search_path=""'));
 } finally {await db.close();}
});
