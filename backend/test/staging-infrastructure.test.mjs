import test from 'node:test';
import assert from 'node:assert/strict';
import {stagingInfrastructure} from '../staging-infrastructure.mjs';
const ref='abcdefghijklmnopqrst',org='ORGANIZATION_FIXTURE';
const env={SUPABASE_DEV_PROJECT_REF:ref,SUPABASE_ACCESS_TOKEN:'SECRET_FIXTURE_TOKEN',SUPABASE_DEV_ORGANIZATION_ID:org};
const response=(status,body)=>({ok:status>=200&&status<300,status,json:async()=>body});

test('staging infrastructure refuses missing, malformed and protected targets before transport',async()=>{
 const never=()=>{throw new Error('Transport must not run');};
 for(const p of [{},{...env,SUPABASE_DEV_PROJECT_REF:'bad'}, {...env,SUPABASE_DEV_PROJECT_REF:'opvoemihfyxidzbdyory'}, {...env,SUPABASE_ACCESS_TOKEN:''}, {...env,SUPABASE_ACCESS_TOKEN:'SECRET\nFIXTURE'}])assert.equal((await stagingInfrastructure(p,never)).status,'blocked');
});

test('staging health performs only a bounded metadata GET and recognizes incomplete provisioning',async()=>{
 const calls=[];
 for(const state of ['ACTIVE_HEALTHY','COMING_UP','INACTIVE','RESTORING']){
  const report=await stagingInfrastructure(env,async(url,p)=>{calls.push({url,p});return response(200,{id:ref,organization_id:org,status:state,password:'SECRET_FIXTURE'});});
  assert.equal(report.status,state==='ACTIVE_HEALTHY'?'ready_for_migration_review':'blocked');
  assert.equal(report.project_state,state);assert.doesNotMatch(JSON.stringify(report),/SECRET|abcdefghijkl|ORGANIZATION_FIXTURE/);
 }
 for(const {url,p} of calls){assert.equal(url,'https://api.supabase.com/v1/projects/'+ref);assert.equal(p.method,'GET');assert.equal(p.body,undefined);assert.ok(p.signal);}
});

test('staging health rejects credential/scope failures, wrong identities and untrusted responses',async()=>{
 for(const [status,expected] of [[401,'expired_revoked_or_invalid_management_token'],[403,'development_project_access_denied'],[429,'management_rate_limited'],[503,'management_service_unavailable']]){
  const report=await stagingInfrastructure(env,async()=>response(status,{error:'SECRET_FIXTURE'}));assert.equal(report.diagnosis,expected);assert.equal(report.status,'blocked');
 }
 for(const body of [{id:'wrong',organization_id:org,status:'ACTIVE_HEALTHY'},{id:ref,organization_id:'wrong',status:'ACTIVE_HEALTHY'},{id:ref,organization_id:org,status:'SECRET_FIXTURE<script>'}])assert.equal((await stagingInfrastructure(env,async()=>response(200,body))).status,'blocked');
 const offline=await stagingInfrastructure(env,async()=>{throw new Error('SECRET_FIXTURE_TRANSPORT');});assert.equal(offline.diagnosis,'management_transport_unavailable');assert.doesNotMatch(JSON.stringify(offline),/SECRET/);
});
