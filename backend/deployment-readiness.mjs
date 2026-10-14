import {configuration} from './config.mjs';
import {SupabaseDatabase} from './database.mjs';
import {SupabaseAuth} from './auth.mjs';

/** Read-only staging verification. Never registers accounts, sends email,
 * updates settings, applies migrations, purchases a project, or starts billing. */
export async function deploymentReadiness(env=process.env,fetchImpl=fetch) {
 const report={status:'blocked',checks:[],pending:[]};
 const check=(name,status,detail)=>report.checks.push({name,status,...(detail?{detail}:{})});
 const missing=['SUPABASE_URL','SUPABASE_PUBLISHABLE_KEY','APP_ORIGIN'].filter(k=>!env[k]);
 if(missing.length){check('configuration','blocked','Missing '+missing.join(', '));return report;}
 let cfg;
 try{
  if(env.APP_ENV==='production'||env.NODE_ENV==='production')throw new Error('development_verification_only');
  if(env.PAYMENTS_ENABLED==='true')throw new Error('payments_must_remain_disabled');
  cfg=configuration({...env,BACKEND_MODE:'supabase',APP_ENV:env.APP_ENV||'staging'});
 }catch(error){check('configuration','blocked',error.message);return report;}
 check('configuration','passed');
 const db=new SupabaseDatabase(cfg,fetchImpl),auth=new SupabaseAuth(cfg,fetchImpl);
 async function deniedRPC(op,token){
  const r=await fetchImpl(cfg.url+'/rest/v1/rpc/goat_query',{method:'POST',headers:{apikey:cfg.publishableKey,'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`}:{})},body:JSON.stringify({p:{op}}),signal:AbortSignal.timeout(15000)});
  const body=await r.json().catch(()=>({}));
  return [401,403].includes(r.status)&&['42501','28000'].includes(body.code);
 }
 try{
  const health=await db.health();
  if(health.database_ok!==true||health.schema_version!==4)throw new Error('schema_version_4_required');
  check('application_schema','passed');
 }catch{check('application_schema','failed','Schema v4 health endpoint unavailable or incorrect');}
 try{check('anonymous_rpc_denied',await deniedRPC('me')?'passed':'failed');}
 catch{check('anonymous_rpc_denied','failed','Transport unavailable');}
 if(env.GOAT_ACCEPTANCE_ACCESS_TOKEN){
  try{
   const user=await auth.user(env.GOAT_ACCEPTANCE_ACCESS_TOKEN),me=await db.rpc('goat_query',{op:'me'},user.databaseIdentity);
   if(me.profile?.user_id!==user.id||!Array.isArray(me.roles)||me.roles.length)throw new Error('ordinary_acceptance_account_required');
   check('confirmed_member_rpc','passed');
   const r=await fetchImpl(cfg.url+'/rest/v1/goat_profiles?select=user_id&limit=2',{method:'GET',headers:{apikey:cfg.publishableKey,Authorization:`Bearer ${user.databaseIdentity}`},signal:AbortSignal.timeout(15000)});
   const rows=await r.json();
   if(!r.ok||!Array.isArray(rows)||rows.length!==1||rows[0].user_id!==user.id)throw new Error('profile_rls_failed');
   check('direct_profile_rls','passed');
   check('member_executive_rpc_denied',await deniedRPC('executive_report',user.databaseIdentity)?'passed':'failed');
  }catch{check('member_auth_and_rls','failed','Provide a confirmed ordinary member session on the dedicated development project');}
 }else report.pending.push('Confirmed ordinary-member acceptance access token for hosted Auth/RLS checks');
 report.pending.push('Hosted email signup/confirmation/recovery acceptance and revoked-session tests','Mobile/desktop visual browser acceptance','Backups, monitoring, HTTPS gateway and production launch review');
 report.status=report.checks.some(c=>c.status==='failed')?'failed':report.pending.length?'incomplete':'passed';
 return report;
}
