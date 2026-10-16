// Read-only prerequisite for a dedicated Supabase development migration.
// This never creates/restores a project, changes credentials, or executes SQL.
const protectedRefs=new Set([
  'opvoemihfyxidzbdyory','xcvptuqqtcebxorqlnsv','lbzdmniuskyytwoaeyjn','tyuhnlmrczwekqjnjdcw'
]);
export const requiredStagingServices=Object.freeze(['db','rest','auth','storage','realtime']);
const rejectedResponse=status=>status===401?'expired_revoked_or_invalid_management_token':
  status===403?'development_project_access_denied':status===429?'management_rate_limited':'management_service_unavailable';

export async function stagingInfrastructure(env=process.env,fetchImpl=fetch) {
  const report={status:'blocked',project_state:'unknown',diagnosis:'development_target_required'};
  const ref=env.SUPABASE_DEV_PROJECT_REF;
  if(typeof ref!=='string'||!/^[a-z]{20}$/.test(ref))return report;
  if(protectedRefs.has(ref))return {...report,diagnosis:'protected_existing_project_forbidden'};
  if(typeof env.SUPABASE_DEV_ORGANIZATION_ID!=='string'||!env.SUPABASE_DEV_ORGANIZATION_ID.trim())return {...report,diagnosis:'development_organization_required'};
  const token=env.SUPABASE_ACCESS_TOKEN;
  if(typeof token!=='string'||!token.trim())return {...report,diagnosis:'management_credentials_required'};
  if(token!==token.trim()||/[\r\n]/.test(token))return {...report,diagnosis:'invalid_credential_format'};
  let current=report;
  try {
    // One deadline covers metadata, the service request, and response parsing.
    const options={method:'GET',redirect:'error',headers:{Authorization:'Bearer '+token,Accept:'application/json'},signal:AbortSignal.timeout(15000)};
    const base='https://api.supabase.com/v1/projects/'+ref;
    const response=await fetchImpl(base,options);
    if(!response.ok)return {...report,diagnosis:rejectedResponse(response.status)};
    const project=await response.json();
    if(project?.id!==ref)return {...report,diagnosis:'development_project_identity_mismatch'};
    if(project.organization_id!==env.SUPABASE_DEV_ORGANIZATION_ID)return {...report,diagnosis:'development_organization_mismatch'};
    const state=typeof project.status==='string'&&/^[A-Z_]{2,50}$/.test(project.status)?project.status:'unknown';
    current={...report,project_state:state};
    if(state!=='ACTIVE_HEALTHY')return {...current,diagnosis:'development_provisioning_not_healthy'};
    const health=await fetchImpl(base+'/health?services='+requiredStagingServices.join(',')+'&timeout_ms=5000',options);
    if(!health.ok)return {...current,diagnosis:rejectedResponse(health.status)};
    const entries=await health.json();
    if(!Array.isArray(entries))return {...current,diagnosis:'development_service_health_invalid'};
    const services={};
    for(const name of requiredStagingServices){
      const matching=entries.filter(entry=>entry?.name===name);
      if(matching.length!==1||!['ACTIVE_HEALTHY','COMING_UP','UNHEALTHY'].includes(matching[0].status))return {...current,diagnosis:'development_service_health_invalid'};
      services[name]=matching[0].status;
    }
    // The API deprecates `healthy`; `status` is the documented authority.
    const ready=Object.values(services).every(state=>state==='ACTIVE_HEALTHY');
    return {...current,services,status:ready?'ready_for_migration_review':'blocked',
      diagnosis:ready?'management_and_required_service_health_passed':'development_services_not_healthy'};
  }catch{return {...current,diagnosis:'management_transport_unavailable'};}
}
