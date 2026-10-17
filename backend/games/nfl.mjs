import {formatGST} from '../../experience/gst-time.js';
import {pickCommand} from '../portal/forms.mjs';

export async function renderNfl(data,standings,ctx){
 const {panel,account,node,form,field,select,datetime,details,table,button,command,required}=ctx;
 const l=data.league,me=account.profile.user_id,owner=l.owner_id===me,entered=data.entries.some(e=>e.user_id===me&&e.status==='approved');
 const now=Date.parse(data.server_time),rounds=data.rounds,games=data.games;
 panel.append(node('p','Super Bowl LXI architecture: 59 ranked ATS game points plus a separate 2-point MVP bonus. Push, missing-pick, ATS-record and exact-tie policies need reviewed approval.'));
 if(owner){
  panel.append(node('p','Invitation ID: '+l.id));
  if(l.status==='draft'){
   const r=await ctx.fetchPublic('/nfl61.json');if(!r.ok)throw new Error('NFL rules profile unavailable');const profile=await r.json();
   const schedule=details(panel,'Commissioner: official matchups and round deadlines');schedule.open=rounds.length===0;
   const available=profile.round_templates.filter(t=>!rounds.some(r=>r.name===t.name));
   if(available.length)form(schedule,'Add a verified NFL round',[select('template','Round',available.map((t,i)=>[String(i),t.name+' · weights '+t.weights.join(', ')])),datetime('lock_at','Round pick deadline')],'Add round',p=>command({op:'round_create',league_id:l.id,...available[Number(p.template)],lock_at:p.lock_at}));
   if(rounds.some(r=>r.status==='draft'))form(schedule,'Add an official matchup',[select('round_id','Round',rounds.filter(r=>r.status==='draft').map(r=>[r.id,r.name])),field('home','Home team','text','',required),field('away','Away team','text','',required),field('home_spread','Home spread: negative means home favorite','number','',{required:'',step:'any'}),datetime('starts_at','Official kickoff'),field('source_url','Official matchup and spread source','url','',{required:''})],'Add matchup',p=>command({op:'game_create',...p}));
   const review=details(panel,'Commissioner: review rules before opening entries');review.append(node('pre',JSON.stringify(l.rules,null,2)));
   form(review,'Rule review',[field('source_reference','Reviewed rules source','text',l.rules.source_reference||'',required),field('unresolved','Unresolved rules, separated by semicolons','textarea',(l.rules.unresolved||[]).join('; ')),field('approved','The rules, including tie and missing-pick policies, have been approved.','checkbox',false,{required:''})],'Save reviewed rules',p=>command({op:'league_rules',league_id:l.id,rules:{...l.rules,max_points:61,tiebreaker:'ats_record',...p,unresolved:p.unresolved.split(';').map(x=>x.trim()).filter(Boolean)}}));
   form(review,'Open entries only after full schedule and rule approval',[field('reason','Documented approval reason','text','',required)],'Open development entries',p=>command({op:'league_open',league_id:l.id,...p}));
  }
  const approvals=details(panel,'Commissioner: entry approvals');
  for(const e of data.entries.filter(e=>e.status==='pending'))form(approvals,e.display_name||e.user_id,[select('approved','Entry decision',[['true','Approve'],['false','Reject']])],'Save entry decision',p=>command({op:'entry_decide',league_id:l.id,user_id:e.user_id,approved:p.approved==='true'}));
  if(l.status==='open'&&!data.entries.some(e=>e.user_id===me))panel.append(button('Request a competitor entry',()=>command({op:'enroll',league_id:l.id})));
 }
 for(const round of rounds){
  const section=details(panel,round.name+' · '+round.status+' · Lock '+formatGST(round.lock_at));section.open=round.status==='open';
  const matchups=games.filter(g=>g.round_id===round.id);
  table(section,['Home','Away','Home spread','Kickoff','Result'],matchups.map(g=>[g.home,g.away,g.home_spread,formatGST(g.starts_at),g.home_score===null?'Awaiting official result':g.home_score+' – '+g.away_score]));
  section.append(node('p','Allowed confidence allocations: '+round.weight_options.map(a=>a.join(' / ')).join(' or ')+(round.mvp_bonus?' · MVP bonus: '+round.mvp_bonus:'')));
  if(entered&&l.status==='open'&&round.status==='open'&&Date.parse(round.lock_at)>now){
   const fields=matchups.flatMap((g,i)=>{const saved=data.picks.find(p=>p.user_id===me&&p.game_id===g.id);return [select('side_'+i,g.home+' vs '+g.away,[['','Choose ATS selection'],['home',g.home],['away',g.away]],saved?.side||''),field('weight_'+i,'Confidence for '+g.home+' vs '+g.away,'number',saved?.weight??'',{required:'',min:1,step:1})];});
   if(round.mvp_bonus)fields.push(field('mvp_pick','Super Bowl MVP prediction','text',data.submissions?.find(s=>s.user_id===me&&s.round_id===round.id)?.mvp_pick||'',required));
   form(section,'Your ranked ATS picks',fields,'Save '+round.name+' picks',p=>command(pickCommand(round,games,matchups.map((g,i)=>({game_id:g.id,side:p['side_'+i],weight:p['weight_'+i]})),p.mvp_pick)),{deadline:round.lock_at});
  }else if(Date.parse(round.lock_at)<=now)section.append(node('p','Selections are locked. Server deadlines are enforced on every submission.'));
  if(owner&&l.status==='open'){
   if(round.status==='draft')form(section,'Approve explicit round policies',[select('push_multiplier','Points on an ATS push',[['','Choose reviewed policy'],['0','No points'],['1','Full confidence points']]),select('missing_policy','Missing submission policy',[['','Choose reviewed policy'],['zero','Zero points'],['block','Block round finalization']]),field('approved','The round policies are approved.','checkbox',false,{required:''}),field('reason','Policy approval reference','text','',required)],'Open round for picks',p=>command({op:'round_open',round_id:round.id,...p,push_multiplier:Number(p.push_multiplier)}));
   if(['open','locked'].includes(round.status)&&Date.parse(round.lock_at)<=now){
    const results=details(section,'Commissioner: sourced results');
    for(const game of matchups.filter(g=>Date.parse(g.starts_at)<=now))form(results,game.home+' vs '+game.away,[field('home_score',game.home+' score','number',game.home_score??'',{required:'',min:0,step:1}),field('away_score',game.away+' score','number',game.away_score??'',{required:'',min:0,step:1}),field('source_url','Official result source','url','',{required:''})],'Save official result',p=>command({op:'result_set',game_id:game.id,...p}));
    if(round.mvp_bonus)form(results,'Official Super Bowl MVP',[field('mvp_result','Official MVP','text',round.mvp_result||'',required),field('source_url','Official MVP source','url','',{required:''})],'Save MVP result',p=>command({op:'mvp_result',round_id:round.id,...p}));
    results.append(button('Finalize scored round',()=>command({op:'round_finalize',round_id:round.id})));
   }
   if(round.status==='final')form(section,'Document a result correction',[field('reason','Correction reason','text','',required)],'Reopen round for correction',p=>command({op:'round_reopen',round_id:round.id,...p}));
  }
 }
 panel.append(node('h3',l.status==='final'?'Championship results':'Ranked ATS standings'));table(panel,['Rank','Competitor','Points','ATS wins','ATS losses'],standings.map(r=>[r.rank,r.display_name,r.points,r.wins,r.losses]));
 if(owner&&l.status==='open'&&rounds.length&&rounds.every(r=>r.status==='final'))panel.append(button('Finalize NFL championship',()=>command({op:'league_finalize',league_id:l.id})));
}
