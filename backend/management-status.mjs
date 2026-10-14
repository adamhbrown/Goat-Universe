// A single GET against the protected existing project's management metadata.
// Never print tokens, request headers, response bodies or provider error text.
export async function managementStatus(env=process.env,fetchImpl=fetch) {
  const report={authentication:'not_checked',project_state:'unknown',diagnosis:'credentials_required'};
  const token=env.SUPABASE_ACCESS_TOKEN;
  if(typeof token!=='string'||!token.trim())return report;
  if(token!==token.trim()||/[\r\n]/.test(token))return {...report,diagnosis:'invalid_credential_format'};
  try {
    const response=await fetchImpl('https://api.supabase.com/v1/projects/opvoemihfyxidzbdyory',{
      method:'GET',headers:{Authorization:`Bearer ${token}`,Accept:'application/json'},signal:AbortSignal.timeout(15000)
    });
    if(response.status===401)return {...report,authentication:'rejected',diagnosis:'expired_revoked_or_invalid_token'};
    if(response.status===403)return {...report,authentication:'denied',diagnosis:'insufficient_project_access_or_scope'};
    if(!response.ok)return {...report,diagnosis:response.status===429?'rate_limited':'management_service_unavailable'};
    const project=await response.json();
    const state=typeof project.status==='string'&&/^[A-Z_]{2,50}$/.test(project.status)?project.status:'unknown';
    return {authentication:'accepted',project_state:state,diagnosis:state==='ACTIVE_HEALTHY'?'management_check_passed_services_not_verified':'project_provisioning_or_health_review_required'};
  } catch {
    return {...report,diagnosis:'management_transport_unavailable'};
  }
}
