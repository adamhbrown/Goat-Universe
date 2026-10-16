import test from 'node:test';
import assert from 'node:assert/strict';
import {managementStatus} from '../management-status.mjs';
const ENV={SUPABASE_ACCESS_TOKEN:'TOKEN_SECRET_FIXTURE_NOT_FOR_LOGS'};
const reply=(status,body={})=>({ok:status>=200&&status<300,status,json:async()=>body});
test('management diagnostic distinguishes credential rejection, permission denial and provisioning without claiming token expiry is proven',async()=>{
 for(const [status,diagnosis] of [[401,'expired_revoked_or_invalid_token'],[403,'insufficient_project_access_or_scope'],[429,'rate_limited'],[503,'management_service_unavailable']]){
  const report=await managementStatus(ENV,async(url,p)=>{
   assert.equal(url,'https://api.supabase.com/v1/projects/opvoemihfyxidzbdyory');assert.equal(p.method,'GET');assert.equal(p.body,undefined);assert.equal(p.headers.Authorization,'Bearer '+ENV.SUPABASE_ACCESS_TOKEN);
   return reply(status,{message:ENV.SUPABASE_ACCESS_TOKEN});
  });
  assert.equal(report.diagnosis,diagnosis);assert.doesNotMatch(JSON.stringify(report),/TOKEN_SECRET_FIXTURE|Authorization/);
 }
 const report=await managementStatus(ENV,async()=>reply(200,{status:'COMING_UP',credentials:'DO_NOT_REPORT'}));
 assert.equal(report.authentication,'accepted');assert.equal(report.project_state,'COMING_UP');assert.equal(report.diagnosis,'project_provisioning_or_health_review_required');assert.doesNotMatch(JSON.stringify(report),/DO_NOT_REPORT/);
 const healthy=await managementStatus(ENV,async()=>reply(200,{status:'ACTIVE_HEALTHY'}));assert.equal(healthy.diagnosis,'management_check_passed_services_not_verified');
});
test('management diagnostic fails closed with missing/unsafe credentials and redacts malformed bodies or network errors',async()=>{
 const never=()=>{throw new Error('transport must not run');};
 assert.equal((await managementStatus({},never)).diagnosis,'credentials_required');
 for(const token of [' padded-token','token\r\nInjected: true'])assert.equal((await managementStatus({SUPABASE_ACCESS_TOKEN:token},never)).diagnosis,'invalid_credential_format');
 assert.equal((await managementStatus(ENV,async()=>{throw new Error(ENV.SUPABASE_ACCESS_TOKEN);})).diagnosis,'management_transport_unavailable');
 const report=await managementStatus(ENV,async()=>reply(200,{status:'MALICIOUS <script>'+ENV.SUPABASE_ACCESS_TOKEN}));assert.equal(report.project_state,'unknown');assert.doesNotMatch(JSON.stringify(report),/script|TOKEN_SECRET_FIXTURE/);
});
