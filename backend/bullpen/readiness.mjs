// Non-destructive hosted evidence checks. No registration, polling, snapshot,
// messages, founder binding, commands, credentials changes or provider writes.
const protectedProjects=new Set(['opvoemihfyxidzbdyory','xcvptuqqtcebxorqlnsv','lbzdmniuskyytwoaeyjn','tyuhnlmrczwekqjnjdcw']);
const agentSeats=['codex','pope','tiffany'];
async function body(response,maxBytes=131072) {
  const chunks=[];let size=0;
  for await (const chunk of response.body || []) {
    size+=chunk.length;
    if (size>maxBytes) throw new Error('response_too_large');
    chunks.push(chunk);
  }
  return new TextDecoder().decode(Buffer.concat(chunks));
}
export async function bullpenReadiness(env=process.env,fetchImpl=fetch) {
  const report={status:'blocked',checks:[],pending:[],connection_evidence:[]};
  const check=(name,passed)=>report.checks.push({name,status:passed?'passed':'failed'});
  let origin;
  try {
    const parsed=new URL(env.APP_ORIGIN);
    if (parsed.protocol!=='https:' || parsed.origin!==env.APP_ORIGIN || parsed.username || parsed.password ||
        ['localhost','127.0.0.1','[::1]'].includes(parsed.hostname)) throw new Error();
    if (env.APP_ENV!=='staging' || env.BACKEND_MODE!=='supabase' || env.AUTH_EMAIL_ENABLED!=='false' || env.PAYMENTS_ENABLED!=='false') throw new Error();
    if (!/^[a-z]{20}$/.test(env.BULLPEN_STAGING_PROJECT_REF || '') || protectedProjects.has(env.BULLPEN_STAGING_PROJECT_REF)) throw new Error();
    const token=env.BULLPEN_ACCEPTANCE_ACCESS_TOKEN;
    if (token!==undefined && (typeof token!=='string' || !token || /\s/.test(token) || /^(?:sb_secret_|sb_publishable_|sbp_|sk-|ghp_|github_pat_)/.test(token))) throw new Error();
    if (token?.startsWith('eyJ')) {
      // Decode only to reject privileged/nonmember token types. The server,
      // not these unverified claims, authenticates the actual user session.
      const claims=JSON.parse(Buffer.from(token.split('.')[1],'base64url').toString());
      if (claims.role!=='authenticated') throw new Error();
    }
    if (token && (!/^[1-9][0-9]*$/.test(env.BULLPEN_ACCEPTANCE_MESSAGE_ID || '') || !Number.isSafeInteger(Number(env.BULLPEN_ACCEPTANCE_MESSAGE_ID)))) throw new Error();
    origin=parsed.origin;
  } catch { report.pending.push('Exact isolated staging project, HTTPS origin and disabled email/payment configuration required');return report; }
  check('isolated_staging_configuration',true);
  const signal=AbortSignal.timeout(15000);
  const request=(path,options={})=>fetchImpl(origin+path,{method:'GET',redirect:'error',cache:'no-store',signal,...options});
  try {
    const response=await request('/health');
    const health=JSON.parse(await body(response,16384));
    check('hosted_application_health',response.ok && health.environment==='staging' && health.database==='supabase' &&
      health.database_ok===true && Number.isSafeInteger(health.schema_version) && health.schema_version>=4 &&
      health.payments_enabled===false && health.auth_email_enabled===false);
  } catch { check('hosted_application_health',false); }
  try {
    const response=await request('/bullpen');
    const html=await body(response);
    const csp=response.headers.get('content-security-policy') || '';
    check('private_shell_headers',response.ok && /text\/html/i.test(response.headers.get('content-type') || '') &&
      /no-store/i.test(response.headers.get('cache-control') || '') &&
      response.headers.get('x-content-type-options')==='nosniff' &&
      /frame-ancestors 'none'/.test(csp) && /script-src 'self'/.test(csp) &&
      !/unsafe-inline|unsafe-eval/.test(csp) && /GOAT Universe Bullpen/.test(html));
  } catch { check('private_shell_headers',false); }
  try {
    const response=await request('/bullpen/query',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({op:'acceptance',message_id:1})});
    const result=JSON.parse(await body(response,16384));
    check('anonymous_room_access_denied',response.status===401 && result.error==='authentication_required');
  } catch { check('anonymous_room_access_denied',false); }
  if (env.BULLPEN_ACCEPTANCE_ACCESS_TOKEN && report.checks.every(c=>c.status==='passed')) {
    try {
      // Unlike snapshot/history/poll, acceptance returns before last_seen_at or
      // receipt updates in the reviewed Bullpen SQL. It records no new evidence.
      const response=await request('/bullpen/query',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+env.BULLPEN_ACCEPTANCE_ACCESS_TOKEN},
        body:JSON.stringify({op:'acceptance',message_id:Number(env.BULLPEN_ACCEPTANCE_MESSAGE_ID)})});
      const result=JSON.parse(await body(response,32768));
      const valid=response.ok && result.message_id===Number(env.BULLPEN_ACCEPTANCE_MESSAGE_ID) &&
        Array.isArray(result.seats) && result.seats.length===3 &&
        agentSeats.every(id=>result.seats.filter(s=>s.seat===id).length===1) &&
        result.seats.every(s=>typeof s.bound==='boolean' && typeof s.enabled==='boolean' && ['manual','api'].includes(s.connection_kind) &&
          (s.received_at===null || (typeof s.received_at==='string' && Number.isFinite(Date.parse(s.received_at)))) &&
          (s.reply_id===null || (Number.isSafeInteger(s.reply_id) && s.reply_id>0)));
      check('existing_bullpen_acceptance_rpc',valid);
      if (valid) report.connection_evidence=agentSeats.map(id=>{
        const seat=result.seats.find(s=>s.seat===id);
        return {seat:id,bound:seat.bound,enabled:seat.enabled,mode:seat.connection_kind,
          receipt_recorded:seat.received_at!==null,api_reply_recorded:seat.reply_id!==null};
      });
    } catch { check('existing_bullpen_acceptance_rpc',false); }
  } else report.pending.push(env.BULLPEN_ACCEPTANCE_ACCESS_TOKEN ?
    'Authenticated check withheld because prerequisite host/security checks failed' :
    'Authorized member session and existing saved acceptance message for Bullpen-specific schema/access evidence');
  report.pending.push('Verify the host actually targets the approved isolated project; health does not expose project identity',
    'Four real account bindings, founder bootstrap review, nonmember/disabled/revoked-session denial',
    'Hosted backup/restore, monitoring, gateway limits and secure logging acceptance',
    'Desktop and real iPhone Safari acceptance of the reviewed combined build',
    'Demonstrate each supported workstream and review its actual sourced response; historical receipts do not prove a current AI connection');
  report.status=report.checks.some(c=>c.status==='failed')?'failed':'incomplete';
  return report;
}
