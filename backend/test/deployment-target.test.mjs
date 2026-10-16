import test from 'node:test';
import assert from 'node:assert/strict';
import {developmentMigrationTarget} from '../deployment-target.mjs';
import {PROTECTED_PROJECT_REFS} from '../protected-projects.mjs';
import {assertMigrationExecutionAllowed} from '../migration-hold.mjs';
import {readFile} from 'node:fs/promises';
const allowed={GITHUB_REF:'refs/heads/codex/backend-foundations',APPLY_DEV_MIGRATIONS:'true',SUPABASE_DEV_PROJECT_REF:'abcdefghijklmnopqrst',CONFIRM_DEV_PROJECT_REF:'abcdefghijklmnopqrst',SUPABASE_ACCESS_TOKEN:'TOKEN_FIXTURE',SUPABASE_DB_PASSWORD:'PASSWORD_FIXTURE',SUPABASE_DEV_PUBLISHABLE_KEY:'KEY_FIXTURE'};
test('manual development apply requires an exact confirmed target and credentials and cannot run on main or production',()=>{
 assert.throws(()=>developmentMigrationTarget(allowed),/migration_execution_blocked_pending_review/);
 for(const [changes,error] of [[{GITHUB_REF:'refs/heads/main'},/development_branch_required/],[{APPLY_DEV_MIGRATIONS:'false'},/confirmation_required/],[{SUPABASE_DEV_PROJECT_REF:'opvoemihfyxidzbdyory',CONFIRM_DEV_PROJECT_REF:'opvoemihfyxidzbdyory'},/production_project_forbidden/],[{SUPABASE_DEV_PROJECT_REF:'not-a-project'},/invalid_development_project_ref/],[{CONFIRM_DEV_PROJECT_REF:'uvwxyzabcdefghijklmn'},/confirmation_mismatch/],[{SUPABASE_ACCESS_TOKEN:''},/development_credentials_required/],[{SUPABASE_DB_PASSWORD:''},/development_credentials_required/]])assert.throws(()=>developmentMigrationTarget({...allowed,...changes}),error);
});
test('every preserved project is rejected before the migration hold',()=>{
 for(const ref of PROTECTED_PROJECT_REFS) assert.throws(()=>developmentMigrationTarget({...allowed,SUPABASE_DEV_PROJECT_REF:ref,CONFIRM_DEV_PROJECT_REF:ref}),/production_project_forbidden/);
});
test('migration execution has no environment or workflow-input bypass',()=>{
 assert.throws(()=>assertMigrationExecutionAllowed(),/migration_execution_blocked_pending_review/);
 assert.throws(()=>developmentMigrationTarget({...allowed,MIGRATION_HOLD:'false',PRODUCTION_LAUNCH_APPROVED:'true'}),/migration_execution_blocked_pending_review/);
});
test('both remote migration workflows enforce the hold before CLI setup or connections',async()=>{
 for(const file of ['supabase-development-apply.yml','supabase-migrations-dry-run.yml']) {
  const source=await readFile(new URL('../../.github/workflows/'+file,import.meta.url),'utf8');
  const hold=source.indexOf('run: node backend/scripts/validate-migration-hold.mjs');
  assert.ok(hold>0);
  for(const operation of ['uses: supabase/setup-cli','run: supabase link','supabase db push']) assert.ok(source.indexOf(operation)>hold);
  assert.doesNotMatch(source.slice(source.lastIndexOf('- name:',hold),hold),/if:|continue-on-error/);
 }
});
