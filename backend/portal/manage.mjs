import { client, pickCommand } from './forms.mjs';
import {renderBracket} from './bracket.mjs';
// The original /play participant portal is preserved. This workspace extends
// account, competition administration, research and commercial operations.
const api = client();
const $ = selector => document.querySelector(selector);
let account, activeLeague;
const signalNames = ['audience_fit','commercial_fit','decision_access','timing','engagement'];

// All remote strings become text nodes, never HTML, including names, evidence,
// outreach drafts, MVP selections, and commissioner-supplied team names.
function node(tag, text, attrs = {}) {
  const element = document.createElement(tag);
  if (text !== undefined) element.textContent = String(text);
  for (const [key,value] of Object.entries(attrs)) element.setAttribute(key,String(value));
  return element;
}
function append(parent, ...children) { parent.append(...children); return parent; }
function message(text) { $('#message').textContent = text; }
async function run(fn, button) {
  if (button) button.disabled = true;
  try { await fn(); } catch (error) { message(error.message.replaceAll('_',' ')); }
  finally { if (button) button.disabled = false; }
}
function button(text, fn) {
  const b = node('button',text,{type:'button'});
  b.addEventListener('click',() => run(fn,b)); return b;
}
function field(name, label, type = 'text', value = '', attrs = {}) { return {name,label,type,value,attrs}; }
function form(parent, title, fields, label, submit) {
  const f = node('form');
  if (title) f.append(node('h3',title));
  for (const spec of fields) {
    const l = node('label',spec.label), input = node(spec.type === 'textarea' ? 'textarea' : spec.type === 'select' ? 'select' : 'input',undefined,{name:spec.name,...(spec.type !== 'textarea' && spec.type !== 'select' ? {type:spec.type} : {}),...spec.attrs});
    if (spec.options) for (const [value,text] of spec.options) input.append(node('option',text,{value}));
    if (spec.type === 'checkbox') input.checked = !!spec.value;
    else input.value = spec.value;
    l.append(input); f.append(l);
  }
  const b = node('button',label,{type:'submit'}); f.append(b);
  f.addEventListener('submit',event => {
    event.preventDefault();
    run(async() => {
      const values = Object.fromEntries(new FormData(f));
      for (const spec of fields) {
        if(spec.type === 'checkbox') values[spec.name] = f.elements[spec.name].checked;
        if(spec.type === 'number') values[spec.name] = Number(values[spec.name]);
        if(spec.type === 'datetime-local') values[spec.name] = values[spec.name] ? new Date(values[spec.name]).toISOString() : null;
      }
      await submit(values);
    },b);
  });
  parent.append(f); return f;
}
function details(parent,title) { const d = node('details');d.append(node('summary',title));parent.append(d);return d; }
function table(parent,headers,rows) {
  const wrap=node('div',undefined,{class:'table-wrap'}),t=node('table'),head=node('tr');
  headers.forEach(x=>head.append(node('th',x,{scope:'col'})));t.append(append(node('thead'),head));
  const body=node('tbody'); for(const row of rows) body.append(append(node('tr'),...row.map(x=>node('td',x ?? '—'))));
  t.append(body);wrap.append(t);parent.append(wrap);
}
const required = {required:'',maxlength:120};
const datetime = (name,label) => field(name,label,'datetime-local','',{required:''});
const select = (name,label,options,value='') => ({...field(name,label,'select',value,{required:''}),options});
const command = async (p, refresh = true) => {
  const result = await api.command(p); message('Saved.');
  if(refresh) { if(activeLeague) await loadLeague(activeLeague); else await dashboard(); }
  return result;
};

$('#account').addEventListener('submit',event => {
  event.preventDefault();
  run(async() => {
    const values=Object.fromEntries(new FormData(event.currentTarget));
    if(!values.display_name) delete values.display_name;
    if(event.submitter.value==='signup') {
      const result=await api.signup(values);
      message(result.confirmation_required === false ? 'Development account created. Sign in to continue.' : 'Registration submitted. Check your email for confirmation before signing in.');
    } else { await api.login(values);await dashboard();message('Signed in.'); }
    $('#account').elements.password.value='';
  },event.submitter);
});
$('#logout').addEventListener('click',() => run(async() => {
  try { await api.logout(); } finally {
    account=undefined;activeLeague=undefined;$('#auth').hidden=false;$('#logout').hidden=true;
    for(const id of ['dashboard','league','commercial']) { $('#'+id).replaceChildren();$('#'+id).hidden=true; }
    message('Signed out.');
  }
}));

async function dashboard() {
  const data=await api.query({op:'dashboard'});account=data.account;
  $('#auth').hidden=true;$('#logout').hidden=false;
  const panel=$('#dashboard');panel.hidden=false;panel.replaceChildren(node('h1',`Welcome, ${account.profile.display_name}`));
  form(details(panel,'Your profile'),'',[field('display_name','Display name','text',account.profile.display_name,{required:'',maxlength:80})],'Update profile',p=>command({op:'profile_update',...p}));
  form(details(panel,'Newsletter preferences'),'',[field('opted_in','I want GOAT Universe email updates. I can withdraw this permission.','checkbox',data.newsletter?.opted_in || false)],'Save preference',p=>command({op:'newsletter_consent',...p,consent_version:'portal-newsletter-v1'}));
  panel.append(node('p',account.membership ? `Membership: ${account.membership.tier} · ${account.membership.status}. Billing is not enabled in this development portal.` : 'No paid membership. Billing is not enabled in this development portal.'));
  panel.append(node('h2','Your competitions'));
  for(const league of data.leagues) {
    const card=node('div',undefined,{class:'card'});card.append(node('h3',league.name),node('p',`${league.sport} · ${league.season} · ${league.status} · Entry: ${league.entry_status || 'commissioner'}`));
    if(league.owner_id===account.profile.user_id || league.entry_status==='approved') card.append(button('Open competition',()=>loadLeague(league.id)));
    else card.append(node('p','Awaiting commissioner approval. League selections stay private.'));
    panel.append(card);
  }
  form(details(panel,'Join a competition by invitation'),'',[field('league_id','League ID supplied by your commissioner','text','',required)],'Request entry',p=>command({op:'enroll',...p}));
  const setup=details(panel,'Commissioner: create an NFL LXI draft');
  setup.append(node('p','59 game points + 2 MVP points = 61. This creates draft rounds only. Add real games, verify sources, and obtain approval of all outstanding rules before opening entries. No fictional teams or default dates are generated.'));
  form(setup,'',[field('name','Competition name','text','',required),field('season','Season','text','2026–27',required),...['Wild Card','Divisional','Conference','Super Bowl'].map((x,i)=>datetime('deadline'+i,x+' selection deadline'))],'Create draft',async values => {
    const profile=await (await fetch('/nfl61.json')).json();
    const league=await api.command({op:'competition_setup',name:values.name,sport:profile.sport,season:values.season,rules:profile.rules,rounds:profile.round_templates.map((spec,i)=>({...spec,lock_at:values['deadline'+i]}))});
    await dashboard();await loadLeague(league.id);
    message('NFL LXI draft created. Rules remain unapproved.');
  });
  const catalog=await (await fetch('/goat-games')).json();
  const gamesPanel=details(panel,'All five GOAT Games');gamesPanel.open=true;
  for(const game of catalog.games){
    const card=node('div',undefined,{class:'card'});card.append(node('h3',game.name),node('p',game.subtitle),node('p',game.notes));gamesPanel.append(card);
    if(game.id==='first-and-baa')card.append(node('p','Use the NFL LXI form above when official round deadlines are available, or save an unscheduled draft here.'));
    const fields=[field('name','Competition name','text',game.name,required),field('season','Season','text','2027',required)];
    if(game.id==='horns-and-hoops')card.append(node('p','Save the draft now; add the official tournament schedule and first tip inside the competition.'));
    form(card,'Commissioner draft setup',fields,'Create '+game.name+' draft',async p=>{
      const created=await api.command({op:'game_draft_create',game_key:game.id,...p});await dashboard();await loadLeague(created.id);message(game.name+' draft created.');
    });
  }
  if(account.roles.some(x=>['researcher','approver','executive'].includes(x))) panel.append(button('Commercial workspace',commercial));
  if(account.roles.includes('executive')) panel.append(button('Executive report',async()=>{
    const report=await api.query({op:'executive_report'}),d=details(panel,'Executive report');d.open=true;
    table(d,['Metric','Verified database count'],[['Accounts',report.accounts],['Approved entries',report.approved_entries],['Newsletter opt-ins',report.newsletter_opt_ins],['Active memberships',report.active_memberships]]);
    renderReport(d,report.commercial);
  }));
}

async function loadLeague(id) {
  const data=await api.query({op:'league',league_id:id});activeLeague=id;
  const panel=$('#league');panel.hidden=false;panel.replaceChildren(node('h2',data.league.name),node('p',`League ID: ${id} · ${data.league.status}`));
  const owner=data.league.owner_id===account.profile.user_id;
  if(data.league.strategy==='ncaa_bracket_v1')return renderBracket(data,{panel,account,api,node,form,details,table,button,field,select,command,required,datetime,message});
  if(data.league.strategy!=='ranked_ats_v1'){
    panel.append(node('p','Competition draft saved. Entry and scoring are disabled while the approved rulebook and competition engine are integrated.'),node('pre',JSON.stringify(data.league.rules,null,2)));
    if(owner)form(panel,'Store competition source specifications',[field('rules','Rulebook JSON and source references','textarea',JSON.stringify(data.league.rules,null,2),{required:''})],'Save draft specifications',p=>command({op:'league_rules',league_id:id,rules:JSON.parse(p.rules)}));
    return;
  }
  if(owner) {
    const rules=details(panel,'Rules and launch approval');
    rules.append(node('p','Resolve the outstanding specifications with Adam before approval. The platform does not decide push, missed-pick, or unresolved-tie policy for you.'),node('pre',JSON.stringify(data.league.rules,null,2)));
    if(data.league.status==='draft') {
      form(rules,'Approved source record',[field('source_reference','Reference for Adam-approved rules','text','',required),field('unresolved','Outstanding issues, separated by semicolons','textarea',(data.league.rules.unresolved || []).join('; ')),field('approved','These rules have been explicitly approved.','checkbox',false)],'Save rule review',p=>command({op:'league_rules',league_id:id,rules:{...data.league.rules,...p,tiebreaker:'ats_record',unresolved:p.unresolved.split(';').map(x=>x.trim()).filter(Boolean)}}));
      form(rules,'Open entries',[field('reason','Approval reason','text','',required)],'Open league',p=>command({op:'league_open',league_id:id,...p}));
      form(details(panel,'Add a missing draft round'),'',[field('name','Round name','text','',required),datetime('lock_at','Deadline'),field('weights','Allowed rankings, comma-separated','text','',required),select('mvp_bonus','MVP bonus',[['0','None'],['2','2 points']],'0')],'Add round',p=>command({op:'round_create',league_id:id,...p,weights:p.weights.split(',').map(Number),mvp_bonus:Number(p.mvp_bonus)}));
    }
    const entries=details(panel,'Commissioner: entry approvals');
    for(const entry of data.entries) {
      entries.append(node('p',`${entry.display_name}: ${entry.status}`));
      if(data.league.status!=='final') entries.append(button('Approve '+entry.display_name,()=>command({op:'entry_decide',league_id:id,user_id:entry.user_id,approved:true})),button('Reject '+entry.display_name,()=>command({op:'entry_decide',league_id:id,user_id:entry.user_id,approved:false})));
    }
    if(!data.entries.some(e=>e.user_id===account.profile.user_id) && data.league.status==='open') panel.append(button('Request your own competitor entry',()=>command({op:'enroll',league_id:id})));
  }
  for(const round of data.rounds.sort((a,b)=>Date.parse(a.lock_at)-Date.parse(b.lock_at))) {
    const card=node('div',undefined,{class:'card'});panel.append(card);
    card.append(node('h3',round.name),node('p',`${round.status} · Deadline: ${new Date(round.lock_at).toLocaleString()} · Rankings: ${round.weight_options.map(x=>x.join(', ')).join(' OR ')}`));
    const games=data.games.filter(g=>g.round_id===round.id);
    table(card,['Away','Home','Home spread','Event starts','Result'],games.map(g=>[g.away,g.home,g.home_spread,new Date(g.starts_at).toLocaleString(),g.home_score===null?'Awaiting sourced result':`${g.away_score} – ${g.home_score}`]));
    const canPick=round.status==='open' && Date.parse(round.lock_at)>Date.parse(data.server_time) && data.entries.some(e=>e.user_id===account.profile.user_id && e.status==='approved');
    if(canPick) {
      const fields=[];
      for(const game of games) {
        const prior=data.picks.find(p=>p.game_id===game.id && p.user_id===account.profile.user_id);
        fields.push(select('side_'+game.id,`${game.away} at ${game.home}: your ATS selection`,[['','Choose a team'],['away',game.away],['home',game.home]],prior?.side || ''),field('weight_'+game.id,'Ranking points','number',prior?.weight || '',{required:'',min:1,step:1}));
      }
      if(round.mvp_bonus) fields.push(field('mvp','Super Bowl MVP selection (use commissioner-provided player identifier)','text',data.submissions.find(s=>s.round_id===round.id && s.user_id===account.profile.user_id)?.mvp_pick || '',required));
      form(card,'Your selections',fields,'Submit all selections',p=>command(pickCommand(round,data.games,games.map(g=>({game_id:g.id,side:p['side_'+g.id],weight:p['weight_'+g.id]})),p.mvp)));
      const prior=data.submissions.find(s=>s.round_id===round.id && s.user_id===account.profile.user_id);
      if(prior) card.append(node('p','Saved at '+new Date(prior.submitted_at).toLocaleString()+'. Changes require resubmitting every pick before the server deadline.'));
    } else card.append(node('p','Selections are unavailable until entry approval and round opening, or are now locked. The server enforces the deadline.'));
    if(owner && data.league.status!=='final') commissionerRound(card,round,games);
    if(Date.parse(round.lock_at)<=Date.parse(data.server_time)) {
      const visible=details(card,'Locked selections');
      table(visible,['Competitor','Game','Selection','Points'],data.picks.filter(p=>games.some(g=>g.id===p.game_id)).map(p=>{const g=games.find(g=>g.id===p.game_id);return [data.entries.find(e=>e.user_id===p.user_id)?.display_name,g.away+' at '+g.home,g[p.side],p.weight];}));
    }
  }
  const standings=await api.query({op:'standings',league_id:id});
  panel.append(node('h3',data.league.status==='final'?'Championship results':'Standings (finalized rounds only)'));
  table(panel,['Rank','Competitor','Points','ATS wins','ATS losses'],standings.map(x=>[x.rank,x.display_name,x.points,x.wins,x.losses]));
  const history=details(panel,'Historical snapshots');
  for(const snapshot of await api.query({op:'history',league_id:id})) {
    history.append(node('h3',`${snapshot.reason} · ${new Date(snapshot.recorded_at).toLocaleString()}`));
    table(history,['Rank','Competitor','Points'],snapshot.snapshot.map(x=>[x.rank,x.display_name,x.points]));
  }
  if(owner && data.league.status==='open') panel.append(button('Finalize championship after all rounds',()=>command({op:'league_finalize',league_id:id})));
}

function commissionerRound(parent,round,games) {
  const d=details(parent,'Commissioner controls');
  if(round.status==='draft') {
    form(d,'Add a real game',[field('home','Home team','text','',required),field('away','Away team','text','',required),datetime('starts_at','Event start'),field('home_spread','Home spread (negative = home favored)','number','',{required:'',step:'any'}),field('source_url','Schedule and line evidence URL','url','',{required:''})],'Add game',p=>command({op:'game_create',round_id:round.id,...p}));
    form(d,'Approve and open this round',[select('push_multiplier','Approved push policy',[['','Select approved policy'],['0','Push earns 0 ranking points'],['1','Push earns full ranking points']]),select('missing_policy','Approved missed-submission policy',[['','Select approved policy'],['zero','Missing submission earns 0'],['block','Block finalization if submissions are missing']]),field('reason','Approval reason / rule source','text','',required),field('approved','I approve these round policies.','checkbox',false)],'Open selections',p=>command({op:'round_open',round_id:round.id,...p,push_multiplier:Number(p.push_multiplier)}));
  }
  if(['open','locked'].includes(round.status)) {
    for(const game of games) form(d,`${game.away} at ${game.home}: sourced result`,[field('home_score','Home score','number',game.home_score ?? '',{required:'',min:0,step:1}),field('away_score','Away score','number',game.away_score ?? '',{required:'',min:0,step:1}),field('source_url','Official result evidence URL','url',game.result_source || '',{required:''})],'Save result',p=>command({op:'result_set',game_id:game.id,...p}));
    if(round.mvp_bonus) form(d,'Sourced MVP result',[field('mvp_result','Official MVP identifier','text',round.mvp_result || '',required),field('source_url','Official MVP source','url','',{required:''})],'Save MVP result',p=>command({op:'mvp_result',round_id:round.id,...p}));
    d.append(button('Finalize round and append snapshot',()=>command({op:'round_finalize',round_id:round.id})));
  }
  if(round.status==='final') form(d,'Correct a finalized round',[field('reason','Documented correction reason','text','',required)],'Reopen for correction',p=>command({op:'round_reopen',round_id:round.id,...p}));
}

function renderReport(parent,report) {
  table(parent,['Commercial metric','Count'],[['Prospects',report.prospects],['Documented interested prospects',report.interested],['Drafts awaiting approval',report.awaiting_approval]]);
  table(parent,['Currency','Contracted revenue (not cash collected)','Weighted pipeline (not revenue)'],report.pipeline_by_currency.map(x=>[x.currency,x.contracted_revenue || 0,x.weighted_pipeline || 0]));
  table(parent,['Follow-up','Due'],report.follow_ups.map(x=>[x.organization,new Date(x.due).toLocaleString()]));
}
async function commercial() {
  const records=await api.query({op:'crm_records'}),report=await api.query({op:'crm_report'});
  const panel=$('#commercial');panel.hidden=false;panel.replaceChildren(node('h2','Commercial workspace'),node('p','Internal research and drafts only. No email, social messages, or external outreach sender is implemented. Approval records do not send communications.'));
  renderReport(panel,report);
  const researcher=account.roles.some(x=>['researcher','executive'].includes(x)),approver=account.roles.some(x=>['approver','executive'].includes(x));
  const save=async p=>{await api.command(p);message('Commercial record saved. No message sent.');await commercial();};
  if(researcher) {
    form(details(panel,'Create researched prospect'),'',[field('organization','Organization','text','',required),field('website','Canonical business website (HTTPS, no path)','url','',{required:''}),select('category','Opportunity category',[['advertiser','Advertiser'],['partner','Partner'],['investor','Investor']],'advertiser'),field('source_url','Public research source','url','',{required:''}),field('evidence','Observed evidence (do not claim interest without a response)','textarea','',{required:''}),...signalNames.flatMap(name=>[field(name,name.replaceAll('_',' ')+' score (0–5)','number',0,{min:0,max:5,step:1,required:''}),field(name+'_evidence','Evidence for '+name.replaceAll('_',' '),'text','',{maxlength:500})])],'Create prospect',p=>save({op:'crm_prospect',organization:p.organization,website:p.website,category:p.category,source_url:p.source_url,evidence:p.evidence,signals:signalNames.map(name=>({name,value:p[name],evidence:p[name+'_evidence']}))}));
    form(details(panel,'Queue research'),'',[field('query','Research brief','textarea','',{required:'',maxlength:1000})],'Queue research',p=>save({op:'research_job',...p}));
    panel.append(button('Claim next research job',async()=>{
      const {job}=await api.command({op:'research_claim'});if(!job){message('No available research job.');return;}
      const d=details(panel,'Claimed: '+job.query);d.open=true;
      form(d,'Complete within the 15-minute lease',[select('status','Result',[['completed','Completed'],['failed','Failed']],'completed'),field('summary','Research summary','textarea','',{required:''}),field('sources','Source URLs, one per line','textarea','')],'Record result',p=>save({op:'research_finish',job_id:job.id,lease_token:job.lease_token,status:p.status,result:{summary:p.summary,sources:p.sources.split('\n').map(x=>x.trim()).filter(Boolean)}}));
    }));
  }
  table(panel,['Research brief','Status','Attempts'],records.research_jobs.map(x=>[x.query,x.status,x.attempts]));
  for(const prospect of records.prospects) {
    const d=details(panel,`${prospect.organization} · score ${prospect.score}/100 · ${prospect.interest}`);
    d.append(node('p',`${prospect.category} · ${prospect.permission}`),node('p',prospect.evidence),node('p',prospect.source_url));
    if(researcher) {
      d.append(button('Prepare introduction draft',async()=>{await api.request('/outreach/prepare',{prospect_id:prospect.id});await commercial();message('Draft prepared for approval. Nothing sent.');}));
      form(d,'Record inbound interest or suppression',[select('interest','Documented interest',[['unknown','Unknown'],['interested','Interested'],['declined','Declined']],prospect.interest),select('permission','Communications permission',[['unverified','Unverified'],['opted_in','Opted in'],['intro_requested','Introduction requested'],['do_not_contact','Do not contact']],prospect.permission),field('response_evidence','Response / consent / suppression evidence','textarea','',{required:''}),field('follow_up_at','Next internal follow-up (optional)','datetime-local')],'Save evidence',p=>save({op:'crm_interest',prospect_id:prospect.id,...p}));
      form(d,'Record revenue opportunity',[field('amount','Proposed or contracted amount','number','',{required:'',min:0,step:'.01'}),field('currency','Currency code','text','USD',{required:'',pattern:'[A-Z]{3}'}),field('probability','Pipeline probability (0–1)','number','',{required:'',min:0,max:1,step:'.01'}),select('stage','Stage',[['qualified','Qualified'],['conversation','Conversation'],['proposal','Proposal'],...(approver?[['won','Contracted / won']]:[]),['lost','Lost']],'qualified'),field('evidence_url','Proposal or contract source','url','',{required:''})],'Save opportunity',p=>save({op:'crm_opportunity',prospect_id:prospect.id,...p}));
    }
    for(const draft of records.drafts.filter(x=>x.prospect_id===prospect.id)) {
      d.append(node('h3',`${draft.status}: ${draft.subject}`),node('pre',draft.body));
      if(approver && draft.status==='pending') form(d,'Decision (does not send)',[select('approved','Decision',[['true','Approve draft only'],['false','Reject']],'false'),field('reason','Decision reason','text','',required)],'Record decision',p=>save({op:'crm_decide',draft_id:draft.id,approved:p.approved==='true',reason:p.reason}));
    }
    table(d,['Stage','Currency','Amount','Probability'],records.opportunities.filter(x=>x.prospect_id===prospect.id).map(x=>[x.stage,x.currency,x.amount,x.probability]));
  }
}
