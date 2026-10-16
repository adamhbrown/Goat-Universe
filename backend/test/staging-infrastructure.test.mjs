import test from 'node:test';
import assert from 'node:assert/strict';
import {stagingInfrastructure,requiredStagingServices} from '../staging-infrastructure.mjs';
const ref='abcdefghijklmnopqrst',org='ORGANIZATION_FIXTURE';
const env={SUPABASE_DEV_PROJECT_REF:ref,SUPABASE_ACCESS_TOKEN:'SECRET_FIXTURE_TOKEN',SUPABASE_DEV_ORGANIZATION_ID:org};
const response=(status,body)=>({ok:status>=200&&status<300,status,json:async()=>body});
const project={id:ref,organization_id:org,status:'ACTIVE_HEALTHY',password:'SECRET_FIXTURE'};
const healthy=()=>requiredStagingServices.map(name=>({name,status:'ACTIVE_HEALTHY',healthy:true,error:'SECRET_FIXTURE'}));
const transport=(health,status=200)=>async url=>response(url.includes('/health?')?status:200,url.includes('/health?')?health:project);

test('staging refuses all existing projects, absent org and invalid credentials before transport',async()=>{
 let called=false;const never=()=>{called=true;throw new Error('Transport must not run');};
 for(const p of [{},{...env,SUPABASE_DEV_PROJECT_REF:'bad'},...['opvoemihfyxidzbdyory','xcvptuqqtcebxorqlnsv','lbzdmniuskyytwoaeyjn','tyuhnlmrczwekqjnjdcw'].map(ref=>({...env,SUPABASE_DEV_PROJECT_REF:ref})),{...env,SUPABASE_DEV_ORGANIZATION_ID:''},{...env,SUPABASE_ACCESS_TOKEN:''},{...env,SUPABASE_ACCESS_TOKEN:'SECRET\nFIXTURE'}])assert.equal((await stagingInfrastructure(p,never)).status,'blocked');
 assert.equal(called,false);
});

test('overall healthy project is blocked when Storage or Realtime is still starting',async()=>{
 for(const name of ['storage','realtime']){
  const services=healthy();services.find(s=>s.name===name).status='COMING_UP';
  const report=await stagingInfrastructure(env,transport(services));
  assert.equal(report.project_state,'ACTIVE_HEALTHY');assert.equal(report.status,'blocked');assert.equal(report.diagnosis,'development_services_not_healthy');assert.equal(report.services[name],'COMING_UP');
 }
});

test('only all required services healthy passes using two bounded GETs without redirects or secrets in reports',async()=>{
 const calls=[];const report=await stagingInfrastructure(env,async(url,p)=>{calls.push({url,p});return transport(healthy())(url);});
 assert.equal(report.status,'ready_for_migration_review');assert.equal(report.diagnosis,'management_and_required_service_health_passed');
 assert.equal(calls.length,2);assert.equal(calls[0].url,'https://api.supabase.com/v1/projects/'+ref);
 assert.equal(calls[1].url,'https://api.supabase.com/v1/projects/'+ref+'/health?services=db,rest,auth,storage,realtime&timeout_ms=5000');
 for(const {p} of calls){assert.equal(p.method,'GET');assert.equal(p.body,undefined);assert.equal(p.redirect,'error');assert.ok(p.signal);}
 assert.equal(calls[0].p.signal,calls[1].p.signal);assert.doesNotMatch(JSON.stringify(report),/SECRET|abcdefghijkl|ORGANIZATION_FIXTURE/);
});

test('unhealthy project does not call the service endpoint',async()=>{
 for(const state of ['COMING_UP','INACTIVE','RESTORING']){
  let calls=0;const report=await stagingInfrastructure(env,async()=>{calls++;return response(200,{...project,status:state});});
  assert.equal(report.status,'blocked');assert.equal(report.project_state,state);assert.equal(calls,1);
 }
});

test('missing, duplicate, malformed and unexpected health states fail closed',async()=>{
 for(const body of [null,{},[],healthy().slice(1),[...healthy(),healthy()[0]],healthy().map(s=>({...s,status:'SECRET_FIXTURE'})),healthy().map(s=>({...s,status:undefined,healthy:true}))]){
  const report=await stagingInfrastructure(env,transport(body));assert.equal(report.status,'blocked');assert.equal(report.diagnosis,'development_service_health_invalid');assert.doesNotMatch(JSON.stringify(report),/SECRET/);
 }
});

test('deprecated healthy boolean cannot override current service status',async()=>{
 assert.equal((await stagingInfrastructure(env,transport(healthy().map(s=>({...s,healthy:false}))))).status,'ready_for_migration_review');
 for(const name of requiredStagingServices){const body=healthy();body.find(s=>s.name===name).status='UNHEALTHY';assert.equal((await stagingInfrastructure(env,transport(body))).status,'blocked');}
});

test('both endpoints classify denied and unavailable access and preserve redaction',async()=>{
 for(const [status,diagnosis] of [[401,'expired_revoked_or_invalid_management_token'],[403,'development_project_access_denied'],[429,'management_rate_limited'],[503,'management_service_unavailable']]){
  for(const fetchImpl of [async()=>response(status,{error:'SECRET_FIXTURE'}),transport({error:'SECRET_FIXTURE'},status)]){
   const report=await stagingInfrastructure(env,fetchImpl);assert.equal(report.diagnosis,diagnosis);assert.equal(report.status,'blocked');assert.doesNotMatch(JSON.stringify(report),/SECRET/);
  }
 }
});

test('identity mismatch, malformed JSON and transport errors remain blocked',async()=>{
 for(const body of [null,{...project,id:'wrong'},{...project,organization_id:'wrong'},{...project,status:'SECRET_FIXTURE<script>'}])assert.equal((await stagingInfrastructure(env,async()=>response(200,body))).status,'blocked');
 for(const failHealth of [false,true]){
  const report=await stagingInfrastructure(env,async url=>{if(failHealth&&!url.includes('/health?'))return response(200,project);throw new Error('SECRET_FIXTURE_TRANSPORT');});
  assert.equal(report.diagnosis,'management_transport_unavailable');assert.doesNotMatch(JSON.stringify(report),/SECRET/);
 }
 const report=await stagingInfrastructure(env,async url=>url.includes('/health?')?{ok:true,json:async()=>{throw new SyntaxError('SECRET_FIXTURE');}}:response(200,project));assert.equal(report.status,'blocked');assert.doesNotMatch(JSON.stringify(report),/SECRET/);
});
