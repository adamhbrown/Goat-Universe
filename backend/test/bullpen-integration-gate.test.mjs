import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {auditBullpenCandidate} from '../bullpen/integration-gate.mjs';

const required={
  bullpen:[
    'backend/bullpen/index.html',
    'backend/bullpen/ui.mjs',
    'backend/bullpen/client.mjs',
    'backend/bullpen/routes.mjs',
    'backend/bullpen/readiness.mjs',
    'backend/scripts/check-bullpen-readiness.mjs',
    'backend/test/bullpen-readiness.test.mjs',
    'supabase/migrations/20261014221554_bullpen_private_boardroom.sql'
  ],
  staging:[
    'backend/staging-infrastructure.mjs',
    'backend/scripts/check-staging-infrastructure.mjs',
    'backend/test/staging-infrastructure.test.mjs',
    '.github/workflows/supabase-development-apply.yml',
    'docs/HOSTED_DEVELOPMENT.md'
  ],
  host:['Dockerfile','backend/deployment-target.mjs','backend/scripts/container-health.mjs']
};
const migrationPaths=[
 '20261014000100_foundations.sql',
 '20261014000200_workflows.sql',
 '20261014092016_portal_and_security.sql',
 '20261014095916_march_madness_and_five_game_drafts.sql',
 '20261014221554_bullpen_private_boardroom.sql'
].map(name=>'supabase/migrations/'+name);
const sum=bytes=>createHash('sha256').update(bytes).digest('hex');
function fixture() {
 const files=new Map([...Object.values(required).flat(),...migrationPaths]
   .map(name=>[name,Buffer.from('fixture:'+name)]));
 for(const path of migrationPaths)files.set(path,readFileSync(new URL('../../'+path,import.meta.url)));
 files.set('package.json',Buffer.from(JSON.stringify({scripts:{'check:bullpen':'check bull','check:staging-infrastructure':'check stage',test:'node --test'}})));
 const manifest={
  source_prototype_commit:'c8b120dfc0f81bcc480408d6eee914893bd6ad84',
  combined_commit:'a'.repeat(40),
  prototype_migrations:migrationPaths.map(file=>({file,sha256:sum(files.get(file))}))
 };
 function refresh(){files.set('docs/BULLPEN_DEPLOYMENT_REVIEW_20261015.json',Buffer.from(JSON.stringify(manifest)));}
 refresh();
 const attempts=[];
 const readSource=async file=>{
  attempts.push(file);
  if(!files.has(file))throw new Error('ENOENT');
  return files.get(file);
 };
 const listMigrationFiles=async()=>migrationPaths.map(p=>p.split('/').pop());
 return {files,manifest,refresh,attempts,readSource,listMigrationFiles};
}
const find=(r,name)=>r.checks.find(x=>x.name===name);

test('complete source fixture remains blocked until explicit hosted acceptance and CEO approval',async()=>{
 const f=fixture();
 const report=await auditBullpenCandidate(f);
 assert.equal(find(report,'bullpen_required_artifacts').state,'present');
 assert.equal(find(report,'staging_required_artifacts').state,'present');
 assert.equal(find(report,'host_required_artifacts').state,'present');
 assert.equal(find(report,'prototype_migration_hashes').state,'match');
 assert.equal(find(report,'extra_migrations').state,'none');
 assert.equal(find(report,'combined_package_scripts').state,'present');
 assert.equal(find(report,'reviewed_combined_commit').state,'declared_unverified');
 assert.equal(report.status,'blocked_pending_approval_and_hosted_acceptance');
 assert.equal(report.connections_verified,0);
 assert.equal(report.mutations_performed,0);
});

test('prototype-only Bullpen branch exposes missing staging prerequisites without inventing readiness',async()=>{
 const f=fixture();
 for(const path of required.staging)f.files.delete(path);
 const report=await auditBullpenCandidate(f);
 assert.equal(find(report,'staging_required_artifacts').state,'missing');
 assert.match(find(report,'staging_required_artifacts').detail,/backend\/staging-infrastructure\.mjs/);
 assert.equal(find(report,'bullpen_required_artifacts').state,'present');
 assert.equal(report.status,'blocked_pending_approval_and_hosted_acceptance');
});

test('migration content change and unreviewed new SQL both require explicit review',async()=>{
 const f=fixture();
 f.files.set(migrationPaths[1],Buffer.from('mutated SQL; fixture only'));
 const report=await auditBullpenCandidate({...f,listMigrationFiles:async()=>[...migrationPaths.map(x=>x.split('/').pop()),'20261015150000_unreviewed.sql']});
 assert.equal(find(report,'prototype_migration_hashes').state,'changed_review_required');
 assert.equal(find(report,'extra_migrations').state,'review_required');
 assert.match(find(report,'extra_migrations').detail,/unreviewed/);
});

test('replacing both candidate SQL and its adjacent manifest hash cannot impersonate reviewed SQL',async()=>{
 const f=fixture(),path=migrationPaths[1];
 f.files.set(path,Buffer.from('altered candidate SQL; no execution'));
 f.manifest.prototype_migrations.find(item=>item.file===path).sha256=sum(f.files.get(path));
 f.refresh();
 const report=await auditBullpenCandidate(f);
 assert.equal(find(report,'prototype_migration_hashes').state,'changed_review_required');
 assert.equal(report.status,'blocked_pending_approval_and_hosted_acceptance');
});

test('candidate manifest cannot substitute a different five-file SQL set',async()=>{
 const f=fixture();
 f.manifest.prototype_migrations[0].file='supabase/migrations/20261015150000_substitute.sql';
 f.refresh();
 const report=await auditBullpenCandidate(f);
 assert.equal(find(report,'prototype_migration_hashes').state,'invalid');
 assert.ok(!f.attempts.includes(f.manifest.prototype_migrations[0].file));
});

test('malformed manifest cannot select arbitrary filesystem paths or pass a digest check',async()=>{
 const f=fixture();
 f.manifest.prototype_migrations[0].file='../../.env';
 f.refresh();
 const report=await auditBullpenCandidate(f);
 assert.equal(find(report,'prototype_migration_hashes').state,'invalid');
 assert.ok(!f.attempts.includes('../../.env'));
 assert.equal(report.connections_verified,0);
});

test('missing package scripts, absent frozen candidate and unreadable migrations fail closed',async()=>{
 const f=fixture();
 f.files.set('package.json',Buffer.from(JSON.stringify({scripts:{test:'node --test'}})));
 f.manifest.combined_commit=null;
 f.files.delete(migrationPaths[3]);
 f.refresh();
 const report=await auditBullpenCandidate(f);
 assert.equal(find(report,'combined_package_scripts').state,'missing');
 assert.equal(find(report,'reviewed_combined_commit').state,'not_frozen');
 assert.equal(find(report,'prototype_migration_hashes').state,'missing');
 assert.equal(report.status,'blocked_pending_approval_and_hosted_acceptance');
});

test('unexpected I/O failures are recorded as nonpasses without exposing raw errors',async()=>{
 const f=fixture();
 const report=await auditBullpenCandidate({
  readSource:async()=>{throw new Error('SECRET_AAA unexpected private path');},
  listMigrationFiles:async()=>{throw new Error('SECRET_BBB');}
 });
 const serialized=JSON.stringify(report);
 assert.equal(find(report,'bullpen_required_artifacts').state,'missing');
 assert.equal(find(report,'prototype_manifest').state,'missing_or_invalid');
 assert.doesNotMatch(serialized,/SECRET_AAA|SECRET_BBB/);
 assert.equal(report.mutations_performed,0);
});

test('current working tree source inspection never certifies connections or deployment',async()=>{
 const report=await auditBullpenCandidate();
 assert.equal(report.status,'blocked_pending_approval_and_hosted_acceptance');
 assert.equal(report.connections_verified,0);
 assert.equal(report.mutations_performed,0);
 assert.ok(report.checks.length>=5);
});
