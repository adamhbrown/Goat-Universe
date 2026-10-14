import test from 'node:test';
import assert from 'node:assert/strict';
import {deploymentReadiness} from '../deployment-readiness.mjs';
const ENV={APP_ORIGIN:'https://dev.fixture.invalid',SUPABASE_URL:'https://developmentfixture.supabase.co',SUPABASE_PUBLISHABLE_KEY:'sb_publishable_FIXTURE'};
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

test('the documented optimized staging runtime supports read-only acceptance',async()=>{
 const report=await deploymentReadiness({...ENV,APP_ENV:'staging',NODE_ENV:'production'},fake);
 assert.equal(report.status,'incomplete');assert.equal(report.checks[0].status,'passed');
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

test('two-member preflight checks both directions and never prints identities or credentials',async()=>{
 const second='bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',calls=[];
 const transport=async(url,p)=>{
  calls.push({url,p});const id=p.headers.Authorization==='Bearer SECOND_FIXTURE_TOKEN'?second:USER;
  if(url.endsWith('/auth/v1/user'))return {ok:true,json:async()=>({id,email_confirmed_at:'confirmed'})};
  if(url.includes('/goat_profiles')&&url.includes('user_id=eq.'))return {ok:true,json:async()=>[]};
  if(url.endsWith('/goat_query')&&p.headers.Authorization&&JSON.parse(p.body).p.op==='me')return {ok:true,json:async()=>({profile:{user_id:id},roles:[]})};
  return fake(url,p);
 };
 const report=await deploymentReadiness({...ENV,GOAT_ACCEPTANCE_ACCESS_TOKEN:'USER_FIXTURE_TOKEN',GOAT_SECOND_ACCEPTANCE_ACCESS_TOKEN:'SECOND_FIXTURE_TOKEN'},transport);
 assert.equal(report.checks.at(-1).name,'two_member_account_isolation');assert.equal(report.checks.at(-1).status,'passed');
 const direct=calls.filter(c=>c.url.includes('user_id=eq.'));assert.equal(direct.length,2);
 assert.ok(direct.some(c=>c.url.includes(USER)&&c.p.headers.Authorization==='Bearer SECOND_FIXTURE_TOKEN'));
 assert.ok(direct.some(c=>c.url.includes(second)&&c.p.headers.Authorization==='Bearer USER_FIXTURE_TOKEN'));
 assert.doesNotMatch(JSON.stringify(report),/FIXTURE_TOKEN|aaaaaaaa|bbbbbbbb/);
});

test('cross-account preflight rejects same users, staff, profile leaks, caller spoofing and transport errors',async()=>{
 const second='bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
 for(const variant of ['same_user','staff','profile_leak','caller_spoof','transport_error']){
  const transport=async(url,p)=>{
   const id=p.headers.Authorization==='Bearer SECOND_FIXTURE_TOKEN'&&variant!=='same_user'?second:USER;
   if(url.endsWith('/auth/v1/user'))return {ok:true,json:async()=>({id,email_confirmed_at:'confirmed'})};
   if(url.includes('user_id=eq.')){
    if(variant==='transport_error')throw new Error('SECRET_FIXTURE_TOKEN');
    return {ok:true,json:async()=>variant==='profile_leak'?[{user_id:second}]:[]};
   }
   if(url.endsWith('/goat_query')&&p.headers.Authorization&&JSON.parse(p.body).p.op==='me'){
    const body=JSON.parse(p.body).p;
    return {ok:true,json:async()=>({profile:{user_id:variant==='caller_spoof'&&body.user_id?body.user_id:id},roles:variant==='staff'&&id===second?['executive']:[]})};
   }
   return fake(url,p);
  };
  const report=await deploymentReadiness({...ENV,GOAT_ACCEPTANCE_ACCESS_TOKEN:'USER_FIXTURE_TOKEN',GOAT_SECOND_ACCEPTANCE_ACCESS_TOKEN:'SECOND_FIXTURE_TOKEN'},transport);
  assert.equal(report.status,'failed',variant);assert.equal(report.checks.at(-1).status,'failed',variant);
  assert.doesNotMatch(JSON.stringify(report),/SECRET_FIXTURE_TOKEN|bbbbbbbb/);
 }
});
