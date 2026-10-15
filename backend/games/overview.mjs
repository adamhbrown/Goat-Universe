// Setup observations are not approvals or launch-readiness decisions.
export function setupProgress(data){
 const l=data.league,rules=l.rules||{},checks=[],add=(label,complete,detail)=>checks.push({label,complete:Boolean(complete),detail});
 if(l.game_key==='first-and-baa'){
  const rounds=data.rounds||[],games=data.games||[],expected=[['Wild Card',6],['Divisional',4],['Conference',2],['Super Bowl',1]];
  add('Four NFL rounds',expected.every(([name])=>rounds.filter(r=>r.name===name).length===1)&&rounds.length===4,rounds.length+' recorded');
  add('Thirteen sourced matchups',expected.every(([name,count])=>games.filter(g=>rounds.find(r=>r.id===g.round_id)?.name===name).length===count)&&games.length===13,games.length+' recorded');
  add('61-point profile',rounds.reduce((n,r)=>n+r.weights.reduce((a,b)=>a+Number(b),0)+Number(r.mvp_bonus),0)===61,'59 game-selection points plus 2 MVP points');
 }else if(l.game_key==='horns-and-hoops'){
  const nodes=data.bracket_nodes||[];
  add('Main bracket lock',Number.isFinite(Date.parse(data.bracket_config?.main_lock_at)),data.bracket_config?.main_lock_at||'Supply the official first Round of 64 tip');
  add('63-game main bracket',[32,16,8,4,2,1].every((n,i)=>nodes.filter(g=>g.stage===i+1).length===n),nodes.filter(g=>g.stage>0).length+' main games; '+nodes.filter(g=>g.stage===0).length+' sourced qualifiers');
 }else if(l.game_key==='league-of-greatness'){
  const teams=data.fantasy_teams||[],matches=(data.fantasy_matchups||[]).filter(m=>m.week<=14);
  add('Twelve sourced franchises',teams.length===12,teams.length+' recorded');
  add('Fourteen-week regular schedule',teams.length===12&&matches.length===84&&Array.from({length:14},(_,i)=>i+1).every(w=>{const games=matches.filter(m=>m.week===w);return games.length===6&&new Set(games.flatMap(g=>[g.home_id,g.away_id])).size===12;}),matches.length+' of 84 regular matchups recorded');
 }else{
  const events=data.series_events||[],sports=l.game_key==='goat-crossover'?['NBA','NHL']:['MLB'];
  add('Sourced '+sports.join(' + ')+' series',sports.every(s=>events.some(e=>e.sport===s)),sports.map(s=>s+': '+events.filter(e=>e.sport===s).length).join(' · '));
  add('Approved scoring configuration',data.series_config?.policy?.approved===true,data.series_config?.policy?.source_reference||'No scoring matrix is assumed');
 }
 add('Rules approval with source',rules.approved===true&&Array.isArray(rules.unresolved)&&rules.unresolved.length===0&&typeof rules.source_reference==='string'&&rules.source_reference.trim().length>=4,rules.unresolved?.length?rules.unresolved.join('; '):rules.source_reference||'Awaiting a reviewed source reference');
 return checks;
}

export function renderOverview(data,ctx){
 const {panel,account,node,details,table}=ctx,l=data.league,me=account.profile.user_id;
 if(l.owner_id===me){
  const box=details(panel,'Commissioner setup progress');box.open=l.status==='draft';
  box.append(node('p','These observations describe saved records. They do not validate source truth, approve rules or establish launch readiness. The server checks every command.'));
  table(box,['Requirement','Saved state','Detail'],setupProgress(data).map(c=>[c.label,c.complete?'Recorded':'Needs review',c.detail]));
  box.append(node('p','Entries: '+data.entries.filter(e=>e.status==='approved').length+' approved · '+data.entries.filter(e=>e.status==='pending').length+' awaiting review.'));
 }
 const receipts=details(panel,'My saved selections and records');
 receipts.append(node('p','Read from the server snapshot at '+new Date(data.server_time).toLocaleString()+'. Unsaved edits in this tab do not change these records. Refresh to confirm the latest saved state.'));
 if(l.game_key==='first-and-baa'){
  table(receipts,['Round','Matchup','ATS selection','Confidence'],(data.picks||[]).filter(p=>p.user_id===me).map(p=>{const g=data.games.find(g=>g.id===p.game_id),r=data.rounds.find(r=>r.id===g?.round_id);return [r?.name,g?g.home+' vs '+g.away:p.game_id,g?.[p.side]||p.side,p.weight];}));
  table(receipts,['Saved round','MVP prediction','Saved at'],(data.submissions||[]).filter(s=>s.user_id===me).map(s=>[data.rounds.find(r=>r.id===s.round_id)?.name,s.mvp_pick||'Not applicable',new Date(s.submitted_at).toLocaleString()]));
 }else if(l.game_key==='horns-and-hoops'){
  const nodes=data.bracket_nodes||[];
  table(receipts,['Game','Winner prediction'],(data.bracket_picks||[]).filter(p=>p.user_id===me).map(p=>[nodes.find(n=>n.id===p.node_id)?.code||p.node_id,p.team]));
  for(const s of (data.bracket_submissions||[]).filter(s=>s.user_id===me))receipts.append(node('p','Championship-total prediction: '+s.championship_total+' · Saved '+new Date(s.submitted_at).toLocaleString()));
 }else if(l.game_key==='league-of-greatness'){
  const teams=data.fantasy_teams||[],mine=teams.filter(t=>t.user_id===me).map(t=>t.id),name=id=>teams.find(t=>t.id===id)?.name||id;
  table(receipts,['Week','Home','Away','Home final','Away final','Home bonus added'],(data.fantasy_matchups||[]).filter(m=>mine.includes(m.home_id)||mine.includes(m.away_id)).map(m=>[m.week,name(m.home_id),name(m.away_id),m.home_score,m.away_score,m.home_bonus_applied]));
 }else{
  const events=data.series_events||[];
  table(receipts,['Sport','Series','Winner prediction','Saved at'],(data.series_picks||[]).filter(p=>p.user_id===me).map(p=>{const e=events.find(e=>e.id===p.event_id);return [e?.sport,e?.code||p.event_id,p.team,new Date(p.submitted_at).toLocaleString()];}));
 }
}
