// Read-only prerequisite for a dedicated Supabase development migration.
// This never creates/restores a project, changes credentials, or executes SQL.
export async function stagingInfrastructure(env=process.env,fetchImpl=fetch) {
  const report={status:'blocked',project_state:'unknown',diagnosis:'development_target_required'};
  const ref=env.SUPABASE_DEV_PROJECT_REF;
  if(typeof ref!=='string'||!/^[a-z]{20}$/.test(ref))return report;
  if(ref==='opvoemihfyxidzbdyory')return {...report,diagnosis:'protected_existing_project_forbidden'};
  const token=env.SUPABASE_ACCESS_TOKEN;
  if(typeof token!=='string'||!token.trim())return {...report,diagnosis:'management_credentials_required'};
  if(token!==token.trim()||/[\r\n]/.test(token))return {...report,diagnosis:'invalid_credential_format'};
  try {
    const response=await fetchImpl('https://api.supabase.com/v1/projects/'+ref,{
      method:'GET',headers:{Authorization:'Bearer '+token,Accept:'application/json'},signal:AbortSignal.timeout(15000)
    });
    if(response.status===401)return {...report,diagnosis:'expired_revoked_or_invalid_management_token'};
    if(response.status===403)return {...report,diagnosis:'development_project_access_denied'};
    if(!response.ok)return {...report,diagnosis:response.status===429?'management_rate_limited':'management_service_unavailable'};
    const project=await response.json();
    if(project.id!==ref)return {...report,diagnosis:'development_project_identity_mismatch'};
    if(env.SUPABASE_DEV_ORGANIZATION_ID&&project.organization_id!==env.SUPABASE_DEV_ORGANIZATION_ID)return {...report,diagnosis:'development_organization_mismatch'};
    const state=typeof project.status==='string'&&/^[A-Z_]{2,50}$/.test(project.status)?project.status:'unknown';
    return {status:state==='ACTIVE_HEALTHY'?'ready_for_migration_review':'blocked',project_state:state,
      diagnosis:state==='ACTIVE_HEALTHY'?'management_health_passed_services_still_require_verification':'development_provisioning_not_healthy'};
  }catch{return {...report,diagnosis:'management_transport_unavailable'};}
}
