import {leagueOfGreatnessSemifinalMatchups} from '../rules/goat-games.mjs';

export async function renderFantasy(data,standings,ctx){
 const {panel,account,node,form,field,select,datetime,details,table,button,command,required}=ctx;
 const l=data.league,owner=l.owner_id===account.profile.user_id,teams=data.fantasy_teams||[],matchups=data.fantasy_matchups||[],seeds=data.fantasy_seeds||[];
 const name=id=>teams.find(t=>t.id===id)?.name||id;
 panel.append(node('p','12 franchises. 14 regular-season weeks. Seven playoff qualifiers. Week 15: #2 vs #7, #3 vs #6, #4 vs #5; #1 has the bye. Week 16 reseeds; Week 17 crowns the champion.'));
 panel.append(node('p','From 2026, home advantage is two points. Official ESPN totals already include it; the import records whether the source includes that bonus. This workspace imports commissioner-reviewed records and does not fetch live ESPN data.',{class:'status'}));
 const roster=details(panel,'Franchises and source records');table(roster,['Franchise','ESPN team ID','GOAT member','Verified source'],teams.map(t=>[t.name,t.external_team_id,t.user_id,t.source_url]));
 if(owner&&l.status==='draft'){
  roster.open=true;
  if(teams.length<12)form(roster,'Add a sourced franchise',[field('name','Franchise name','text','',required),field('franchise_key','Stable franchise identifier','text','',required),field('external_team_id','ESPN team ID','text','',required),field('user_id','Owner GOAT account ID','text','',{required:'',pattern:'[a-fA-F0-9-]{36}'}),field('source_url','Verified roster source','url','',{required:''})],'Add franchise',p=>command({op:'fantasy_team_create',league_id:l.id,...p}));
  if(teams.length===12&&!matchups.length)form(roster,'Import the official 14-week schedule',[field('matchups','Schedule JSON: week, home_id, away_id, starts_at, source_url','textarea','',{required:''})],'Import 84 sourced matchups',p=>command({op:'fantasy_schedule_import',league_id:l.id,matchups:JSON.parse(p.matchups)}));
  if(teams.length===12&&matchups.length===84)form(roster,'Approve sourced season records',[field('source_reference','Verified roster and schedule reference','text','',required),field('approved','I reviewed this official roster and schedule.','checkbox',false,{required:''})],'Open fantasy season workspace',p=>command({op:'fantasy_open',league_id:l.id,...p}));
 }
 panel.append(node('h3','Regular-season records'));table(panel,['Seed','Franchise','Played','W','L','T','Points for','Points against'],standings.map(r=>[r.seed,r.name,r.played,r.wins,r.losses,r.ties,r.points_for,r.points_against]));
 panel.append(node('p','Seed order is imported from a verified source. Equal records are not silently separated by an invented tiebreaker.'));
 const playoffs=details(panel,'Wildcat playoffs and championship');playoffs.open=Boolean(seeds.length);
 const ordered=seeds.toSorted((a,b)=>a.seed-b.seed).map(s=>s.team_id);
 if(owner&&l.status==='open'&&!seeds.length&&matchups.length===84&&matchups.every(m=>m.home_score!==null))form(playoffs,'Import seven official playoff seeds',[...Array.from({length:7},(_,i)=>select('seed_'+i,'Seed #'+(i+1),[['','Choose franchise'],...teams.map(t=>[t.id,t.name])])),field('source_url','Official seed-order source','url','',{required:''}),field('verified','I verified this seven-seed order.','checkbox',false,{required:''})],'Save sourced seed order',p=>command({op:'fantasy_playoffs_seed',league_id:l.id,team_ids:Array.from({length:7},(_,i)=>p['seed_'+i]),source_url:p.source_url,verified:p.verified}));
 table(playoffs,['Seed','Franchise'],seeds.map(s=>[s.seed,name(s.team_id)]));
 if(ordered.length===7){
  const next=[15,16,17].find(w=>!matchups.some(m=>m.week===w));let pairs;
  if(next===15)pairs=[[ordered[1],ordered[6]],[ordered[2],ordered[5]],[ordered[3],ordered[4]]];
  else if(next===16){
   const prior=matchups.filter(m=>m.week===15),original=[[ordered[1],ordered[6]],[ordered[2],ordered[5]],[ordered[3],ordered[4]]];
   if(prior.length===3&&prior.every(m=>m.home_score!==null&&Number(m.home_score)!==Number(m.away_score))){const winners=original.map(pair=>{const m=prior.find(m=>pair.includes(m.home_id)&&pair.includes(m.away_id));return Number(m.home_score)>Number(m.away_score)?m.home_id:m.away_id;});pairs=leagueOfGreatnessSemifinalMatchups(ordered,winners).matchups;}
  }else if(next===17){const prior=matchups.filter(m=>m.week===16);if(prior.length===2&&prior.every(m=>m.home_score!==null&&Number(m.home_score)!==Number(m.away_score)))pairs=[prior.map(m=>Number(m.home_score)>Number(m.away_score)?m.home_id:m.away_id).sort((a,b)=>ordered.indexOf(a)-ordered.indexOf(b))];}
  if(pairs){
   table(playoffs,['Next week','Verified pairing'],pairs.map(pair=>[next,pair.map(name).join(' vs ')]));
   if(owner&&l.status==='open')form(playoffs,'Schedule Week '+next+' from the official source',pairs.flatMap((pair,i)=>[select('home_'+i,'Official home designation: '+pair.map(name).join(' vs '),[['','Choose official home team'],...pair.map(id=>[id,name(id)])]),datetime('starts_'+i,'Official Week '+next+' start'),field('source_'+i,'Official matchup source','url','',{required:''})]),'Add verified playoff matchups',p=>command({op:'fantasy_playoff_round',league_id:l.id,week:next,schedule:pairs.map((pair,i)=>({home_id:p['home_'+i],away_id:pair.find(id=>id!==p['home_'+i]),starts_at:p['starts_'+i],source_url:p['source_'+i]}))}));
  }else if(next)playoffs.append(node('p','Advancement awaits decisive, sourced results from the preceding round. Tied playoff games require an approved tie policy; no winner is guessed.'));
 }
 const final=matchups.find(m=>m.week===17);
 if(final&&final.home_score!==null&&Number(final.home_score)!==Number(final.away_score)){
  playoffs.append(node('h3',(l.status==='final'?'Champion: ':'Championship leader: ')+name(Number(final.home_score)>Number(final.away_score)?final.home_id:final.away_id)));
  playoffs.append(node('p','Final places 3–12 still require a sourced official finishing-position policy before annual BAAS certification.'));
  if(owner&&l.status==='open')playoffs.append(button('Finalize fantasy championship',()=>command({op:'fantasy_finalize',league_id:l.id})));
 }
 const schedule=details(panel,'Weekly matchups and commissioner result entry');
 if(owner&&l.status==='open')form(schedule,'Import a verified ESPN result batch',[field('results','Result JSON: matchup_id, home_score, away_score, source_includes_home_bonus, verified, source_url','textarea','',{required:''})],'Import sourced fantasy scores',p=>command({op:'fantasy_results_import',league_id:l.id,results:JSON.parse(p.results)}));
 for(const week of [...new Set(matchups.map(m=>m.week))].sort((a,b)=>a-b)){
  const section=details(schedule,'Week '+week+(week>14?' · Playoffs':''));const rows=matchups.filter(m=>m.week===week);
  table(section,['Home','Away','Official start','Home score','Away score'],rows.map(m=>[name(m.home_id),name(m.away_id),new Date(m.starts_at).toLocaleString(),m.home_score,m.away_score]));
  if(owner&&l.status==='open')for(const m of rows){
   const result=details(section,name(m.home_id)+' vs '+name(m.away_id));
   if(m.home_score===null&&Date.parse(m.starts_at)<=Date.parse(data.server_time))form(result,'Sourced ESPN score import',[field('home_score','Home source score','number','',{required:'',min:0,step:'any'}),field('away_score','Away source score','number','',{required:'',min:0,step:'any'}),field('source_includes_home_bonus','Home score already includes the official two-point advantage.','checkbox',true),field('source_url','Official score source','url','',{required:''}),field('verified','I verified these final scores against the source.','checkbox',false,{required:''})],'Save verified scores',p=>command({op:'fantasy_result',matchup_id:m.id,...p}));
   else if(m.home_score!==null){result.append(node('p','Home bonus added on import: '+m.home_bonus_applied+'. Source home score: '+m.home_raw_score+'.'));form(result,'Document a source correction',[field('reason','Verified correction reason','text','',required)],'Clear result and dependent playoff records',p=>command({op:'fantasy_correct',matchup_id:m.id,...p}));}
   else result.append(node('p','Official result entry is available after the scheduled start.'));
  }
 }
}
