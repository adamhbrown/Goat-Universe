export async function renderMemberHistory(ctx,openLeague){
 const {panel,node,details,table,button,gameName,current}=ctx;
 panel.append(node('h2','My competition history'),node('p','Your completed competitions and certified finishing positions. An uncertified result does not create annual BAAS.'));
 const records=await ctx.api.query({op:'member_history'});if(!current())return;
 if(!records.length){panel.append(node('p','No completed competition entries yet. Finalized competitions will appear here.'));return;}
 const label=node('label','Filter history by game'),filter=node('select',undefined,{'aria-label':'Filter history by game'}),list=node('div');
 filter.append(node('option','All five games',{value:''}));for(const key of [...new Set(records.map(r=>r.game_key))])filter.append(node('option',gameName(key),{value:key}));label.append(filter);panel.append(label,list);
 function draw(){if(!current())return;list.replaceChildren();
  const selected=records.filter(r=>!filter.value||r.game_key===filter.value);
  table(list,['Season','Official game','Competition','Certified place'],selected.map(r=>[r.season,gameName(r.game_key),r.name,r.certified&&r.finish?r.finish.place:'Awaiting certification']));
  for(const record of selected){const box=details(list,record.name+' · '+record.season);box.append(node('p',record.certified&&record.finish?'Certified finishing place: '+record.finish.place+'.':'The commissioner has not certified your official finishing position.'));box.append(button('Open '+record.name,()=>openLeague(record.league_id)));}
 }
 filter.addEventListener('change',draw);draw();
}
