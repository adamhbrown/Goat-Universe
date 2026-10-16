import {candidates} from '../portal/bracket.mjs';

export async function renderSeries(data,standings,ctx){
 const {panel,account,node,form,field,select,datetime,details,table,button,command,required}=ctx;
 const l=data.league,owner=l.owner_id===account.profile.user_id,entered=data.entries.some(e=>e.user_id===account.profile.user_id&&e.status==='approved');
 const events=data.series_events||[],policy=data.series_config?.policy,sports=l.game_key==='goat-crossover'?['NBA','NHL']:['MLB'];const now=Date.parse(data.server_time);
 panel.append(node('p',sports.length===2?'NBA and NHL series contribute to one combined competition and one leaderboard. There is no separate NBA playoff league.':'MLB postseason series are administered here. No postseason format or scoring weights are assumed.'));
 panel.append(node('p',policy?'Scoring uses the commissioner-reviewed policy below.':'Scoring disabled. Store official series while the competition rules are awaiting approval.',{class:'status'}));
 if(policy)table(panel,['Sport','Round','Reviewed points'],sports.flatMap(s=>Object.entries(policy.points_by_sport[s]).map(([round,points])=>[s,round,points])));
 if(owner){
  panel.append(node('p','Invitation ID: '+l.id));
  if(l.status==='draft'){
   if(!events.length)ctx.importer(panel,{kind:'series_schedule',title:'Review sourced series schedule import',data});
   const schedule=details(panel,'Commissioner: add sourced series');schedule.open=true;
   const prior=[['','No feeder — use the team name'],...events.map(e=>[e.id,e.sport+' · '+e.code])];
   form(schedule,'Series / bracket administration',[field('code','Series code','text','',required),select('sport','Sport',sports.map(s=>[s,s])),field('round','Official round name','text','',required),field('stage','Advancement stage','number','',{required:'',min:1,max:32,step:1}),datetime('lock_at','Pick deadline'),field('source_url','Official schedule source','url','',{required:''}),field('home_team','First entrant, if known'),select('home_from','Or first entrant comes from series',prior,'',{}),field('away_team','Second entrant, if known'),select('away_from','Or second entrant comes from series',prior,'',{})],'Add sourced series',p=>{const {home_team,away_team,home_from,away_from,...rest}=p;return command({op:'series_event_create',league_id:l.id,...rest,...(home_from?{home_from}:{home_team}),...(away_from?{away_from}:{away_team})});});
   const review=details(panel,'Commissioner: approved scoring configuration');review.append(node('p','Enter only formally reviewed NBA/NHL or MLB round weights. No default weights or tie rules are invented. This configurable foundation supports shared-rank ties and explicit missing-pick policies.'));
   form(review,'Reviewed competition policy',[field('source_reference','Approved rulebook / decision reference','text',policy?.source_reference||'',required),field('points_by_sport','Reviewed round-point matrix JSON for '+sports.join(' and '),'textarea',policy?JSON.stringify(policy.points_by_sport,null,2):'',{required:''}),select('missing_policy','Reviewed missing-pick policy',[['','Choose policy'],['block','Block championship if any series pick is missing'],['zero','Missing picks earn zero points']]),field('approved','The format, shared-rank ties and scoring matrix have formal approval.','checkbox',false,{required:''})],'Save approved scoring policy',p=>command({op:'series_configure',league_id:l.id,policy:{game_id:l.game_key,season:Number(l.season),approved:p.approved,source_reference:p.source_reference,unresolved:[],missing_policy:p.missing_policy,tie_policy:'shared_rank',points_by_sport:JSON.parse(p.points_by_sport)}}));
   if(policy)form(review,'Open the sourced competition',[field('reason','Approval reason','text','',required)],'Open development entries',p=>command({op:'series_open',league_id:l.id,...p}));
  }
  if(l.status==='open'){
   ctx.importer(panel,{kind:'series_results',title:'Review sourced series result import',data});
   const approvals=details(panel,'Commissioner: entry approvals');
   for(const e of data.entries.filter(e=>e.status==='pending'))form(approvals,e.display_name||e.user_id,[select('approved','Decision',[['true','Approve'],['false','Reject']])],'Save decision',p=>command({op:'entry_decide',league_id:l.id,user_id:e.user_id,approved:p.approved==='true'}));
   if(!data.entries.some(e=>e.user_id===account.profile.user_id))panel.append(button('Request a competitor entry',()=>command({op:'enroll',league_id:l.id})));
  }
 }
 for(const sport of sports){
  const group=details(panel,sport+' series');group.open=true;const rows=events.filter(e=>e.sport===sport);
  table(group,['Series','Round','Entrants / feeders','Pick lock','Winner'],rows.map(e=>[e.code,e.round,(e.home_team||events.find(n=>n.id===e.home_from)?.code||'Feeder')+' vs '+(e.away_team||events.find(n=>n.id===e.away_from)?.code||'Feeder'),new Date(e.lock_at).toLocaleString(),e.winner||'Awaiting sourced result']));
  if(entered&&l.status==='open'){
   const unlocked=rows.filter(e=>Date.parse(e.lock_at)>now);
   if(unlocked.length)form(group,'Your '+sport+' selections',unlocked.map(e=>select('team_'+e.id,e.code+' · '+e.round,[['','Keep unchanged / no selection'],...candidates(events,e.id).map(t=>[t,t])],data.series_picks?.find(k=>k.user_id===account.profile.user_id&&k.event_id===e.id)?.team||'',{})),'Save '+sport+' picks',p=>{const picks=unlocked.flatMap(e=>p['team_'+e.id]&&Date.parse(e.lock_at)>ctx.serverNow()?[{event_id:e.id,team:p['team_'+e.id]}]:[]);if(!picks.length)throw new Error('Choose at least one series winner before its deadline.');return command({op:'series_submit',league_id:l.id,picks});},{deadlines:Object.fromEntries(unlocked.map(e=>['team_'+e.id,e.lock_at]))});
   for(const e of rows.filter(e=>Date.parse(e.lock_at)<=now)){const pick=data.series_picks?.find(p=>p.event_id===e.id&&p.user_id===account.profile.user_id);group.append(node('p',e.code+' locked · Your pick: '+(pick?.team||'No pick submitted')));}
  }
  if(owner&&l.status==='open')for(const e of rows){
   const entry=details(group,'Commissioner: '+e.code);
   if(e.winner)form(entry,'Sourced correction',[field('reason','Documented correction reason','text','',required)],'Clear result and dependent series',p=>command({op:'series_correct',event_id:e.id,...p}));
   else if(Date.parse(e.lock_at)<=now){const home=e.home_team||events.find(x=>x.id===e.home_from)?.winner,away=e.away_team||events.find(x=>x.id===e.away_from)?.winner;
    if(home&&away)form(entry,'Official final winner',[select('winner','Series winner',[[home,home],[away,away]]),field('source_url','Official result source','url','',{required:''})],'Save sourced winner',p=>command({op:'series_result',event_id:e.id,...p}));
    else entry.append(node('p','Feeder results are required before this result can be entered.'));
   }else entry.append(node('p','Official result entry is available after this series locks.'));
  }
 }
 panel.append(node('h3',l.status==='final'?'Championship results':sports.length===2?'Combined NBA + NHL standings':'MLB standings'));
 table(panel,['Rank','Competitor','Total points',...sports.map(s=>s+' points')],standings.map(r=>[r.rank,r.display_name,r.points,...sports.map(s=>r.sports.find(x=>x.sport===s)?.points??0)]));
 if(owner&&l.status==='open'&&events.length&&events.every(e=>e.winner))panel.append(button('Finalize competition championship',()=>command({op:'series_finalize',league_id:l.id})));
}
