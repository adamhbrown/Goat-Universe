export function developmentMigrationTarget(env) {
 if(env.GITHUB_REF!=='refs/heads/codex/backend-foundations')throw new Error('development_branch_required');
 if(env.APPLY_DEV_MIGRATIONS!=='true')throw new Error('explicit_development_apply_confirmation_required');
 const ref=env.SUPABASE_DEV_PROJECT_REF;
 if(typeof ref!=='string'||!/^[a-z]{20}$/.test(ref))throw new Error('invalid_development_project_ref');
 if(ref==='opvoemihfyxidzbdyory')throw new Error('production_project_forbidden');
 if(env.CONFIRM_DEV_PROJECT_REF!==ref)throw new Error('development_project_confirmation_mismatch');
 if(!env.SUPABASE_ACCESS_TOKEN||!env.SUPABASE_DB_PASSWORD||!env.SUPABASE_DEV_PUBLISHABLE_KEY)throw new Error('development_credentials_required');
 return ref;
}
