import test from 'node:test';
import assert from 'node:assert/strict';
import {deploymentReadiness} from '../deployment-readiness.mjs';
const ENV={SUPABASE_URL:'https://developmentfixture.supabase.co',SUPABASE_PUBLISHABLE_KEY:'sb_publishable_FIXTURE'};
const USER='aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const fake=async(url,params)=>{
 assert.notEqual(params.method,'PUT');assert.notEqual(params.method,'DELETE');assert.ok(!url.includes('/signup')&&!url.includes('/recover')&&!url.includes('/goat_command'));
 if(url.endsWith('/goat_health'))return {ok:true,json:async()=>({database_ok:true,schema_version:4})};
 if(url.endsWith('/auth/v1/user'))return {ok:true,json:async()=>({id:USER,email_confirmed_at:'confirmed'})};
 if(url.includes('/goat_profiles'))return {ok:true,json:async()=>[{user_id:USER}]};
 const op=JSON.parse(params.body).p.op;
 if(op==='me'&&params.headers.Authorization)return {ok:true,json:async()=>({profile:{user_id:USER},roles:[]})};
 return {ok:false,status:403,json:async()=>({code:'42501'})};
};
test('deployment preflight fails closed without configuration, for production target, or live payments',async()=>{
 const never=()=>{throw new Error('No transport allowed');};
 assert.equal((await deploymentReadiness({},never)).status,'blocked');
 for(const changes of [{APP_ENV:'production'},{NODE_ENV:'production'},{PAYMENTS_ENABLED:'true'},{SUPABASE_URL:'https://opvoemihfyxidzbdyory.supabase.co'}])assert.equal((await deploymentReadiness({...ENV,...changes},never)).status,'blocked');
});
test('read-only hosted preflight checks health, anonymous denial and member RLS without claiming full launch readiness',async()=>{
 const incomplete=await deploymentReadiness(ENV,fake);assert.equal(incomplete.status,'incomplete');assert.ok(incomplete.pending.some(p=>p.includes('access token')));
 const report=await deploymentReadiness({...ENV,GOAT_ACCEPTANCE_ACCESS_TOKEN:'USER_FIXTURE_TOKEN'},fake);assert.equal(report.status,'incomplete');assert.deepEqual(report.checks.map(c=>c.name),['configuration','application_schema','anonymous_rpc_denied','confirmed_member_rpc','direct_profile_rls','member_executive_rpc_denied']);assert.ok(report.checks.every(c=>c.status==='passed'));
 assert.doesNotMatch(JSON.stringify(report),/USER_FIXTURE_TOKEN|aaaaaaaa|sb_publishable_FIXTURE/);
});
test('preflight detects missing migrations, unexpected anonymous success, staff accounts and cross-user profile data',async()=>{
 for(const variant of ['wrong_schema','anonymous_allowed','wrong_profile']){
  const changed=async(url,p)=>{
   if(variant==='wrong_schema'&&url.endsWith('/goat_health'))return {ok:true,json:async()=>({database_ok:true,schema_version:2})};
   if(variant==='anonymous_allowed'&&url.endsWith('/goat_query')&&!p.headers.Authorization)return {ok:true,status:200,json:async()=>({profile:{}})};
   if(variant==='wrong_profile'&&url.includes('/goat_profiles'))return {ok:true,json:async()=>[{user_id:'ANOTHER_USER'}]};
   return fake(url,p);
  };
  assert.equal((await deploymentReadiness({...ENV,GOAT_ACCEPTANCE_ACCESS_TOKEN:'USER_FIXTURE_TOKEN'},changed)).status,'failed');
 }
});
