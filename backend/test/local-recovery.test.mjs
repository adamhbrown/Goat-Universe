import test from 'node:test';
import assert from 'node:assert/strict';
import {PGlite} from '@electric-sql/pglite';
import {LocalDatabase} from '../database.mjs';
import {LocalAuth} from '../auth.mjs';

test('isolated local backup restores competition snapshots, audit history and access controls', async t => {
  const source=await new LocalDatabase().init();
  t.after(() => source.close());
  const auth=new LocalAuth(source);
  const {user}=await auth.signup({email:'recovery-fixture@invalid.test',password:'Recovery-TEST-Fixture-1234',display_name:'RECOVERY TEST FIXTURE'});
  const command=p => source.rpc('goat_command',p,user.id);
  const {id:league_id}=await command({op:'league_create',name:'RECOVERY TEST FIXTURE',sport:'NFL',season:'fixture',
    rules:{approved:false,max_points:1,tiebreaker:'ats_record',source_reference:'Synthetic recovery fixture',unresolved:[]}});
  const {id:round_id}=await command({op:'round_create',league_id,name:'RECOVERY TEST',lock_at:new Date(Date.now()+86400000).toISOString(),weights:[1]});
  const {id:game_id}=await command({op:'game_create',round_id,home:'HOME TEST',away:'AWAY TEST',starts_at:new Date(Date.now()+172800000).toISOString(),home_spread:-1.5,source_url:'https://fixtures.invalid/test'});
  await command({op:'league_rules',league_id,rules:{approved:true,max_points:1,tiebreaker:'ats_record',source_reference:'Synthetic recovery fixture',unresolved:[]}});
  await command({op:'league_open',league_id,reason:'Synthetic local recovery test only'});
  await command({op:'enroll',league_id});
  await command({op:'entry_decide',league_id,user_id:user.id,approved:true});
  await command({op:'round_open',round_id,approved:true,push_multiplier:0,missing_policy:'block',reason:'Synthetic policy'});
  await command({op:'picks_submit',round_id,picks:[{game_id,side:'home',weight:1}]});
  await source.db.query("update public.goat_rounds set lock_at=now()-interval '1 minute' where id=$1",[round_id]);
  await source.db.query("update public.goat_games set starts_at=now()-interval '30 seconds' where id=$1",[game_id]);
  await command({op:'result_set',game_id,home_score:20,away_score:10,source_url:'https://fixtures.invalid/result'});
  await command({op:'round_finalize',round_id});
  await command({op:'league_finalize',league_id});
  const history=await source.rpc('goat_query',{op:'history',league_id},user.id);
  const tables=['goat_leagues','goat_rounds','goat_games','goat_picks','goat_submissions','goat_entries','goat_history','goat_audit'];
  const before={};
  for (const table of tables) before[table]=(await source.db.query(`select * from public.${table} order by 1`)).rows;
  // WASM development database only. This does not connect to Supabase or create
  // a production backup. No archive is written to disk or committed.
  const dump=await source.db.dumpDataDir();
  assert.ok(dump.size>0);
  const restored=await PGlite.create({loadDataDir:dump});
  t.after(() => restored.close());
  for (const table of tables) assert.deepEqual((await restored.query(`select * from public.${table} order by 1`)).rows,before[table],table);
  const health=(await restored.query('select public.goat_health() as health')).rows[0].health;
  assert.equal(health.schema_version,4);
  const restoredHistory=await restored.transaction(async tx => {
    await tx.exec('set local role authenticated');
    await tx.query("select set_config('request.jwt.claim.sub',$1,true)",[user.id]);
    return (await tx.query('select public.goat_query($1::jsonb) as result',[JSON.stringify({op:'history',league_id})])).rows[0].result;
  });
  assert.deepEqual(restoredHistory,history);
  await assert.rejects(restored.transaction(async tx => {
    await tx.exec('set local role anon'); await tx.query('select public.goat_query($1::jsonb)',[JSON.stringify({op:'history',league_id})]);
  }),/permission denied/);
  await assert.rejects(restored.transaction(async tx => {
    await tx.exec('set local role authenticated'); await tx.exec("insert into public.goat_roles values(gen_random_uuid(),'executive')");
  }),/permission denied/);
});
