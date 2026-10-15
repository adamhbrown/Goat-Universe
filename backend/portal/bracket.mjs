export const STAGES=['Qualifying','Round of 64','Round of 32','Sweet 16','Elite Eight','Final Four','National Championship'];
export const POINTS=[1,2,3,5,7,9,11];
export function candidates(nodes,id) {
 const n=nodes.find(x=>x.id===id);if(!n)return [];
 if(n.winner)return [n.winner];
 const teams=[...(n.home_team?[n.home_team]:candidates(nodes,n.home_from)),...(n.away_team?[n.away_team]:candidates(nodes,n.away_from))];
 return [...new Set(teams)];
}
export function bracketCommand(leagueId,nodes,values) {
 const main=nodes.filter(n=>n.stage>0).sort((a,b)=>a.stage-b.stage);
 if(main.length!==63)throw new Error('The commissioner must publish the complete 63-game main bracket.');
 const picks=main.map(n=>({node_id:n.id,team:values['pick_'+n.id]}));
 const lookup=new Map(picks.map(p=>[p.node_id,p.team]));
 for(const n of main){
  const team=lookup.get(n.id), allowed=n.stage===1?candidates(nodes,n.id):[lookup.get(n.home_from),lookup.get(n.away_from)].filter(Boolean);
  if(!team || !allowed.includes(team))throw new Error('Select a valid winner for every game, advancing your chosen teams.');
 }
 const total=values.championship_total;
 if(!Number.isSafeInteger(total)||total<0||total>10000)throw new Error('Enter a whole-number combined championship score prediction.');
 return {op:'bracket_submit',league_id:leagueId,picks,championship_total:total};
}

export async function renderBracket(data,context) {
 const {panel,account,api,node,form,details,table,button,field,select,command,required,datetime,message}=context;
 const id=data.league.id,owner=data.league.owner_id===account.profile.user_id,now=Date.parse(data.server_time),cfg=data.bracket_config;
 const nodes=data.bracket_nodes,me=account.profile.user_id,entered=data.entries.some(e=>e.user_id===me&&e.status==='approved');
 panel.append(node('p','One main bracket per GOAT account. Qualifying games lock individually. The entire main bracket and championship-total prediction lock at the first Round of 64 tip and stay locked.'));
 if(!cfg){
  panel.append(node('p','Draft saved. Add the official tournament schedule and first Round of 64 tip before importing games or opening entries.'));
  if(owner)form(panel,'Configure official bracket schedule',[datetime('main_lock_at','First Round of 64 tip'),field('schedule_source','Official schedule URL','url','',{required:''})],'Configure bracket schedule',p=>command({op:'bracket_configure',league_id:id,...p}));
  return;
 }
 panel.append(node('p','Main lock: '+new Date(cfg.main_lock_at).toLocaleString()));
 table(panel,['Stage','Correct winner points'],STAGES.map((name,i)=>[name,POINTS[i]]));
 if(owner){
  panel.append(node('p','Invitation ID: '+id));
  const review=details(panel,'Rules and launch approval');review.append(node('pre',JSON.stringify(data.league.rules,null,2)));
  if(data.league.status==='draft'){
   form(review,'Review founder rules',[field('source_reference','Approval source reference','text',data.league.rules.source_reference,required),field('unresolved','Outstanding issues, separated by semicolons','textarea',(data.league.rules.unresolved||[]).join('; ')),field('approved','Adam has approved opening this sourced competition.','checkbox',false)],'Save bracket rule review',p=>command({op:'league_rules',league_id:id,rules:{...data.league.rules,...p,unresolved:p.unresolved.split(';').map(x=>x.trim()).filter(Boolean)}}));
   form(review,'Open entries after schedule validation',[field('reason','Approval reason','text','',required)],'Open bracket league',p=>command({op:'league_open',league_id:id,...p}));
   const schedule=details(panel,'Import official tournament schedule');
   schedule.append(node('p','Import a JSON array of games in source order. Use code, stage (0–6), source_url, starts_at, and either home_team/away_team or home_from_code/away_from_code. Main stages must contain 32, 16, 8, 4, 2, 1 games. No tournament field or qualifying-game count is assumed. Schedule imports are atomic and require an empty draft.'));
   if(context.importer)context.importer(schedule,{kind:'bracket_schedule',title:'Review sourced bracket schedule import',data});
   else form(schedule,'',[field('nodes','Sourced schedule JSON','textarea','',{required:''})],'Import bracket schedule',p=>command({op:'bracket_schedule_import',league_id:id,nodes:JSON.parse(p.nodes)}));
  }
  const entries=details(panel,'Commissioner: entry approvals');
  for(const e of data.entries){entries.append(node('p',`${e.display_name}: ${e.status}`));if(data.league.status==='open'&&Date.parse(cfg.main_lock_at)>now)entries.append(button('Approve '+e.display_name,()=>command({op:'entry_decide',league_id:id,user_id:e.user_id,approved:true})),button('Reject '+e.display_name,()=>command({op:'entry_decide',league_id:id,user_id:e.user_id,approved:false})));}
  if(!data.entries.some(e=>e.user_id===me)&&data.league.status==='open')panel.append(button('Request your own competitor entry',()=>command({op:'enroll',league_id:id})));
 }
 const qualifying=details(panel,'Qualifying selections');qualifying.open=true;
 for(const n of nodes.filter(n=>n.stage===0)){
  const prior=data.bracket_picks.find(p=>p.user_id===me&&p.node_id===n.id);
  qualifying.append(node('p',`${n.code}: ${n.home_team} vs ${n.away_team} · ${new Date(n.starts_at).toLocaleString()} · ${n.winner?'Winner: '+n.winner:'Awaiting sourced result'}`));
  if(entered&&data.league.status==='open'&&Date.parse(n.starts_at)>now){const qualifyingForm=form(qualifying,'',[select('team','Choose qualifying winner',[['','Choose'],[n.home_team,n.home_team],[n.away_team,n.away_team]],prior?.team||'')],'Save qualifying pick',p=>command({op:'bracket_qualifying_pick',node_id:n.id,...p}));context.trackDeadline?.(qualifyingForm,n.starts_at);}
  else qualifying.append(node('p',prior?'Your saved pick: '+prior.team:'No saved qualifying pick.'));
 }
 if(!nodes.some(n=>n.stage===0))qualifying.append(node('p','No qualifying games imported. The commissioner supplies the official schedule.'));
 if(entered&&data.league.status==='open'&&Date.parse(cfg.main_lock_at)>now){
  const main=nodes.filter(n=>n.stage>0).sort((a,b)=>a.stage-b.stage||a.code.localeCompare(b.code)), fields=[], choices=new Map();
  for(const n of main){
   const allowed=n.stage===1?candidates(nodes,n.id):[choices.get(n.home_from),choices.get(n.away_from)].filter(Boolean);
   const prior=data.bracket_picks.find(p=>p.user_id===me&&p.node_id===n.id)?.team||'';
   choices.set(n.id,allowed.includes(prior)?prior:'');
   fields.push(select('pick_'+n.id,`${STAGES[n.stage]} · ${n.code}`,[['','Choose a winner'],...allowed.map(team=>[team,team])],choices.get(n.id)));
  }
  fields.push(field('championship_total','Predicted combined points in the National Championship','number',data.bracket_submissions.find(s=>s.user_id===me)?.championship_total??'',{required:'',min:0,max:10000,step:1}));
  const f=form(panel,'Your complete main bracket',fields,'Save complete bracket',p=>command(bracketCommand(id,nodes,p)));
  context.trackDeadline?.(f,cfg.main_lock_at);
  // The entire 63-game submission is still atomic. Group its controls by
  // round so a phone user does not face an unbroken wall of 63 selectors.
  // Moving labels (rather than cloning inputs) preserves their form ownership.
  const progress=node('p','',{role:'status','aria-live':'polite'});
  f.querySelector('h3').after(progress);
  const labels=[...f.querySelectorAll('label')], groups=new Map();
  for(let stage=1;stage<=6;stage++){
    const group=node('details',undefined,{'class':'bracket-round'});
    group.open=stage===1;
    const summary=node('summary');
    group.append(summary);
    f.insertBefore(group,labels.at(-1));
    groups.set(stage,{group,summary});
  }
  main.forEach((game,index)=>groups.get(game.stage).group.append(labels[index]));
  function updateProgress(){
    let complete=0;
    for(let stage=1;stage<=6;stage++){
      const stageGames=main.filter(game=>game.stage===stage);
      const done=stageGames.filter(game=>Boolean(f.elements['pick_'+game.id].value)).length;
      complete+=done;
      groups.get(stage).summary.textContent=STAGES[stage]+' — '+done+' of '+stageGames.length+' selected';
    }
    progress.textContent=complete+' of 63 winners selected. '+(complete===63
      ? 'Enter your championship-total prediction and save before the first tip.'
      : 'Complete each round; advancing teams update as you make selections.');
  }
  // Browsers cannot focus a required select inside a closed details panel.
  // Expand its round on invalidity, without weakening native form validation.
  f.addEventListener('invalid',event=>{
    const group=event.target.closest('details');
    if(group)group.open=true;
  },true);
  // Changing an upstream winner removes impossible downstream selections. The
  // server independently validates the full graph and atomic replacement.
  f.addEventListener('change',()=>{
   for(const n of main.filter(n=>n.stage>1)){
    const input=f.elements['pick_'+n.id],prior=input.value,allowed=[f.elements['pick_'+n.home_from]?.value,f.elements['pick_'+n.away_from]?.value].filter(Boolean);
    input.replaceChildren(node('option','Choose a winner',{value:''}),...allowed.map(team=>node('option',team,{value:team})));input.value=allowed.includes(prior)?prior:'';
   }
   updateProgress();
  });
  updateProgress();
 }
 const submission=data.bracket_submissions.find(s=>s.user_id===me);
 if(submission)panel.append(node('p','Your main bracket was saved at '+new Date(submission.submitted_at).toLocaleString()+'. Championship total: '+submission.championship_total+'.'));
 if(Date.parse(cfg.main_lock_at)<=now){
  panel.append(node('p','The full main bracket and tiebreaker are locked.'));
  const locked=details(panel,'Locked bracket selections');table(locked,['Member','Game','Winner prediction'],data.bracket_picks.map(p=>[data.entries.find(e=>e.user_id===p.user_id)?.display_name,nodes.find(n=>n.id===p.node_id)?.code,p.team]));
 }
 if(owner&&data.league.status==='open'){
  const results=details(panel,'Commissioner: official results and corrections');
  results.append(node('p','A changed earlier result invalidates every dependent result, retaining historical snapshots and evidence. Re-enter affected results after review.'));
  if(context.importer)context.importer(results,{kind:'bracket_results',title:'Review sourced bracket result import',data});
  else form(results,'Atomic sourced result import',[field('results','Result JSON array: node_id, home_score, away_score, source_url','textarea','',{required:''})],'Import sourced results',p=>command({op:'bracket_results_import',league_id:id,results:JSON.parse(p.results)}));
  for(const n of nodes){
   const d=details(results,STAGES[n.stage]+' · '+n.code+(n.winner?' · Winner: '+n.winner:''));
   if(n.winner)form(d,'',[field('reason','Documented correction reason','text','',required)],'Reopen game and dependent results',p=>command({op:'bracket_correct',node_id:n.id,...p}));
   else form(d,'',[field('home_score','Home / first listed entrant score','number','',{required:'',min:0,step:1}),field('away_score','Away / second listed entrant score','number','',{required:'',min:0,step:1}),field('source_url','Official result source URL','url','',{required:''})],'Save official result',p=>command({op:'bracket_result',node_id:n.id,...p}));
  }
  panel.append(button('Finalize bracket championship',()=>command({op:'league_finalize',league_id:id})));
 }
 const standings=await api.query({op:'standings',league_id:id});panel.append(node('h3',data.league.status==='final'?'Championship results':'Standings'));
 table(panel,['Rank','Competitor','Points','Correct','Championship total','Distance from actual total'],standings.map(r=>[r.rank,r.display_name,r.points,r.correct,r.championship_total,r.tiebreak_error]));
 const history=details(panel,'Historical snapshots');
 for(const snap of await api.query({op:'history',league_id:id})){
  const d=details(history,snap.reason+' · '+new Date(snap.recorded_at).toLocaleString());table(d,['Rank','Competitor','Points','Tiebreak distance'],snap.snapshot.map(r=>[r.rank,r.display_name,r.points,r.tiebreak_error]));
 }
}
