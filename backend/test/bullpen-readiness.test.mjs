import test from 'node:test';
import assert from 'node:assert/strict';
import {bullpenReadiness} from '../bullpen/readiness.mjs';
const env={APP_ORIGIN:'https://bullpen-fixture.invalid',APP_ENV:'staging',BACKEND_MODE:'supabase',AUTH_EMAIL_ENABLED:'false',PAYMENTS_ENABLED:'false',BULLPEN_STAGING_PROJECT_REF:'abcdefghijklmnopqrst'};
const seats=()=>['tiffany','pope','codex'].map(seat=>({seat,bound:false,enabled:false,connection_kind:'manual',received_at:null,reply_id:null}));
const json=(value,status=200)=>new Response(JSON.stringify(value),{status,headers:{'Content-Type':'application/json'}});
function transport(changes={}) {
  const requests=[];
  const fetch=async(url,options)=>{
    requests.push({url,options});
    assert.equal(options.redirect,'error');assert.equal(options.cache,'no-store');assert.ok(options.signal);
    if (url.endsWith('/health')) return json(changes.health || {environment:'staging',database:'supabase',database_ok:true,schema_version:4,payments_enabled:false,auth_email_enabled:false});
    if (url.endsWith('/bullpen')) return new Response('GOAT Universe Bullpen',{headers:{'Content-Type':'text/html','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Content-Security-Policy':changes.csp || "default-src 'none'; script-src 'self'; frame-ancestors 'none'"}});
    assert.ok(url.endsWith('/bullpen/query'));
    const p=JSON.parse(options.body);assert.equal(p.op,'acceptance','Never poll or snapshot; they mutate presence/receipts');
    return options.headers.Authorization ? json(changes.acceptance || {message_id:7,seats:seats()}) : json({error:'authentication_required'},401);
  };
  return {requests,fetch};
}
test('Bullpen preflight blocks protected projects, production, invalid origins and active flags without network',async()=>{
  const never=()=>assert.fail('No network is allowed');
  for (const change of [{},{APP_ENV:'production'},{BACKEND_MODE:'local'},{AUTH_EMAIL_ENABLED:'true'},{PAYMENTS_ENABLED:'true'},
    {APP_ORIGIN:'http://bullpen.invalid'},{APP_ORIGIN:'https://bullpen.invalid/path'},{APP_ORIGIN:'https://u:p@bullpen.invalid'},
    {BULLPEN_STAGING_PROJECT_REF:'opvoemihfyxidzbdyory'},{BULLPEN_STAGING_PROJECT_REF:'xcvptuqqtcebxorqlnsv'},
    {BULLPEN_STAGING_PROJECT_REF:'lbzdmniuskyytwoaeyjn'},{BULLPEN_STAGING_PROJECT_REF:'tyuhnlmrczwekqjnjdcw'},
    {BULLPEN_ACCEPTANCE_ACCESS_TOKEN:'token\n'},
    {BULLPEN_ACCEPTANCE_ACCESS_TOKEN:'sb_secret_FIXTURE',BULLPEN_ACCEPTANCE_MESSAGE_ID:'7'},
    {BULLPEN_ACCEPTANCE_ACCESS_TOKEN:'eyJhbGciOiJIUzI1NiJ9.'+Buffer.from(JSON.stringify({role:'service_role'})).toString('base64url')+'.FIXTURE',BULLPEN_ACCEPTANCE_MESSAGE_ID:'7'},
    {BULLPEN_ACCEPTANCE_ACCESS_TOKEN:'token',BULLPEN_ACCEPTANCE_MESSAGE_ID:'999999999999999999999'}]) {
    const candidate=Object.keys(change).length?{...env,...change}:{};
    assert.equal((await bullpenReadiness(candidate,never)).status,'blocked');
  }
});
test('general app health and anonymous denial never certify Bullpen installation or workstream connections',async()=>{
  const t=transport(),report=await bullpenReadiness(env,t.fetch);
  assert.equal(report.status,'incomplete');assert.equal(t.requests.length,3);
  assert.ok(report.checks.every(c=>c.status==='passed'));
  assert.deepEqual(report.connection_evidence,[]);
  assert.ok(report.pending.some(p=>p.includes('schema/access')));
  assert.ok(t.requests.every(r=>!r.options.headers?.Authorization));
});
test('existing acceptance metadata stays disconnected and excludes private content and credentials',async()=>{
  const t=transport(),report=await bullpenReadiness({...env,BULLPEN_ACCEPTANCE_ACCESS_TOKEN:'SECRET_FIXTURE_SESSION',BULLPEN_ACCEPTANCE_MESSAGE_ID:'7'},t.fetch);
  assert.equal(report.status,'incomplete');assert.equal(t.requests.length,4);
  assert.ok(report.connection_evidence.every(s=>!s.receipt_recorded && !s.api_reply_recorded));
  assert.equal(t.requests.filter(r=>r.options.headers?.Authorization).length,1);
  assert.doesNotMatch(JSON.stringify(report),/SECRET_FIXTURE_SESSION|bullpen-fixture|abcdefghijklmnopqrst/);
  assert.ok(report.pending.some(p=>p.includes('historical receipts')));
});
test('partial, duplicated or mismatched acceptance metadata fails closed',async()=>{
  for (const acceptance of [{message_id:8,seats:seats()},{message_id:7,seats:[]},{message_id:7,seats:[seats()[0],seats()[0],seats()[1]]},
    {message_id:7,seats:seats().map(s=>({...s,bound:'true'}))},{message_id:7,seats:seats().map(s=>({...s,reply_id:-1}))}]) {
    const t=transport({acceptance});
    const report=await bullpenReadiness({...env,BULLPEN_ACCEPTANCE_ACCESS_TOKEN:'FIXTURE',BULLPEN_ACCEPTANCE_MESSAGE_ID:'7'},t.fetch);
    assert.equal(report.status,'failed');assert.deepEqual(report.connection_evidence,[]);
  }
});
test('unhealthy hosts, permissive CSP, transport failures and oversized responses fail without raw errors',async()=>{
  for (const fetch of [transport({health:{database_ok:false}}).fetch,transport({csp:"script-src 'self' 'unsafe-inline'; frame-ancestors 'none'"}).fetch,
    async()=>{throw new Error('SECRET_PROVIDER_DETAIL');},async()=>new Response('x'.repeat(131073))]) {
    const report=await bullpenReadiness(env,fetch);assert.equal(report.status,'failed');
    assert.doesNotMatch(JSON.stringify(report),/SECRET_PROVIDER_DETAIL/);
  }
});
test('receipt and reply metadata are historical evidence, never a live-agent success claim',async()=>{
  const t=transport({acceptance:{message_id:7,seats:seats().map(s=>({...s,bound:true,enabled:true,connection_kind:'api',received_at:'2026-10-14T17:00:00Z',reply_id:12}))}});
  const report=await bullpenReadiness({...env,BULLPEN_ACCEPTANCE_ACCESS_TOKEN:'FIXTURE',BULLPEN_ACCEPTANCE_MESSAGE_ID:'7'},t.fetch);
  assert.equal(report.status,'incomplete');assert.ok(report.connection_evidence.every(s=>s.receipt_recorded && s.api_reply_recorded));
  assert.ok(!JSON.stringify(report).includes('connected'));
});
test('failed prerequisite checks never forward a private session to the host',async()=>{
  const t=transport({health:{database_ok:false}});
  const report=await bullpenReadiness({...env,BULLPEN_ACCEPTANCE_ACCESS_TOKEN:'DO_NOT_FORWARD_FIXTURE',BULLPEN_ACCEPTANCE_MESSAGE_ID:'7'},t.fetch);
  assert.equal(report.status,'failed');assert.ok(t.requests.every(r=>!r.options.headers?.Authorization));
  assert.ok(report.pending.some(p=>p.includes('withheld')));
});
