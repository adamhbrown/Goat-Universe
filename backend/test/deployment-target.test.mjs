import test from 'node:test';
import assert from 'node:assert/strict';
import {developmentMigrationTarget} from '../deployment-target.mjs';
const allowed={GITHUB_REF:'refs/heads/codex/backend-foundations',APPLY_DEV_MIGRATIONS:'true',SUPABASE_DEV_PROJECT_REF:'abcdefghijklmnopqrst',CONFIRM_DEV_PROJECT_REF:'abcdefghijklmnopqrst',SUPABASE_ACCESS_TOKEN:'TOKEN_FIXTURE',SUPABASE_DB_PASSWORD:'PASSWORD_FIXTURE',SUPABASE_DEV_PUBLISHABLE_KEY:'KEY_FIXTURE'};
test('manual development apply requires an exact confirmed target and credentials and cannot run on main or production',()=>{
 assert.equal(developmentMigrationTarget(allowed),'abcdefghijklmnopqrst');
 for(const [changes,error] of [[{GITHUB_REF:'refs/heads/main'},/development_branch_required/],[{APPLY_DEV_MIGRATIONS:'false'},/confirmation_required/],[{SUPABASE_DEV_PROJECT_REF:'opvoemihfyxidzbdyory',CONFIRM_DEV_PROJECT_REF:'opvoemihfyxidzbdyory'},/production_project_forbidden/],[{SUPABASE_DEV_PROJECT_REF:'not-a-project'},/invalid_development_project_ref/],[{CONFIRM_DEV_PROJECT_REF:'uvwxyzabcdefghijklmn'},/confirmation_mismatch/],[{SUPABASE_ACCESS_TOKEN:''},/development_credentials_required/],[{SUPABASE_DB_PASSWORD:''},/development_credentials_required/]])assert.throws(()=>developmentMigrationTarget({...allowed,...changes}),error);
});
