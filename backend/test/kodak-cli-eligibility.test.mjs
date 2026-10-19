// Standalone CLI privacy/review tests. Synthetic IDs and leagues only.
import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';

const command=fileURLToPath(new URL('../scripts/audit-five-games.mjs',import.meta.url));
const secret='SECRET+PRIVATE-ACCOUNT@fixture.invalid';
const source='DO-NOT-LOG-THIS-PRIVATE-SOURCE';
const league=(id)=>({
  league:{id,game_key:'first-and-baa',season:'2027',
    rules:{approved:true,source_reference:source,unresolved:[]}},
  entries:[{user_id:secret,status:'approved'}],
  rounds:[],games:[]
});
const snapshots=[league('SYNTHETIC-1'),league('SYNTHETIC-2')];

test('offline launch audit reviews commissioner league overlap without printing private identities or sourcing',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'goat-eligibility-cli-'));
 try{
  const filename=join(dir,'only-fixtures.json');
  const run=async body=>{
    await writeFile(filename,JSON.stringify(body));
    return spawnSync(process.execPath,[command,filename],{encoding:'utf8',timeout:15000});
  };
  const unresolved=await run({snapshots});
  assert.equal(unresolved.status,1,unresolved.stderr);
  const report=JSON.parse(unresolved.stdout);
  assert.equal(report.can_launch,false);
  assert.equal(report.eligibility_policy_mode,'not_decided');
  assert.equal(report.member_eligibility_audit.duplicate_game_season_entry_groups,1);
  assert.ok(report.games.find(g=>g.game_key==='first-and-baa').issues.includes('eligibility_policy_review_required'));
  assert.doesNotMatch(unresolved.stdout+unresolved.stderr,/SECRET\+PRIVATE|DO-NOT-LOG|SYNTHETIC-1|SYNTHETIC-2/);

  const allowed=await run({snapshots,eligibility_policy:{
    mode:'allow_multiple_leagues',approved:true,source_reference:source
  }});
  const allowedReport=JSON.parse(allowed.stdout);
  assert.equal(allowedReport.eligibility_policy_reviewed,true);
  assert.ok(!allowedReport.games.find(g=>g.game_key==='first-and-baa').issues.includes('eligibility_policy_review_required'));
  assert.ok(allowedReport.games.find(g=>g.game_key==='first-and-baa').issues.includes('duplicate_competition_snapshot'));
  assert.doesNotMatch(allowed.stdout, /SECRET\+PRIVATE|DO-NOT-LOG/);

  const exclusive=await run({snapshots,eligibility_policy:{
    mode:'one_league_per_game_season',approved:true,source_reference:source
  }});
  const exclusiveReport=JSON.parse(exclusive.stdout);
  assert.ok(exclusiveReport.games.find(g=>g.game_key==='first-and-baa').issues.includes('duplicate_approved_game_season_entry'));

  const unapproved=await run({snapshots,eligibility_policy:{
    mode:'one_league_per_game_season',approved:false,source_reference:source
  }});
  assert.equal(unapproved.status,1);
  assert.equal(unapproved.stdout,'');
  assert.match(unapproved.stderr,/five_game_audit_unavailable/);
  assert.doesNotMatch(unapproved.stderr, /SECRET\+PRIVATE|DO-NOT-LOG/);
 }finally{await rm(dir,{recursive:true,force:true});}
});
