export async function renderAnnual(id,dashboard,ctx,choose){
 const {panel,account,node,form,field,select,details,table,button,command,required}=ctx;
 panel.append(node('h2','Annual GOAT Championship'),node('p','Five competitions connect through approved BAAS conversions. Final finishing positions require certification. No live BAAS awards or transactions are issued by this workspace.'));
 const championships=await ctx.api.query({op:'annuals'});
 if(championships.length)for(const c of championships)panel.append(button(c.name+' · '+c.season+' · '+c.status,()=>choose(c.id)));
 if(!id){form(panel,'Create an annual championship draft',[field('name','Championship name','text','',required),field('season','Season year','number','',{required:'',min:2026,max:2100,step:1})],'Create championship draft',p=>command({op:'annual_create',...p}));return;}
 const c=await ctx.api.query({op:'annual',championship_id:id}),owner=c.owner_id===account.profile.user_id;
 panel.append(node('h3',c.name+' · '+c.season+' · '+c.status));
 if(!c.policy)panel.append(node('p','Rankings disabled until all five official BAAS conversion tables and the shared-rank tie policy have approval.',{class:'status'}));
 if(owner&&c.status!=='final'){
  if(!c.competitions.length){const review=details(panel,'Reviewed annual conversion policy');form(review,'Official BAAS policy',[field('source_reference','Founder-approved conversion and tie-policy reference','text',c.policy?.source_reference||'',required),field('conversions','All five official conversion tables as JSON','textarea',c.policy?JSON.stringify(c.policy.conversions,null,2):'',{required:''}),field('approved','All conversion tables and shared-rank ties are formally approved.','checkbox',false,{required:''})],'Save reviewed conversion policy',p=>command({op:'annual_policy_set',championship_id:id,policy:{season:c.season,tie_policy:'shared_rank',approved:p.approved,source_reference:p.source_reference,conversions:JSON.parse(p.conversions)}}));}
  const eligible=dashboard.competitions.flatMap(g=>g.leagues).filter(l=>l.owner_id===account.profile.user_id&&l.status==='final'&&l.finishes_certified&&String(l.season)===String(c.season)&&!c.competitions.some(r=>r.league_id===l.id));
  if(c.policy&&eligible.length)form(panel,'Attach a certified competition',[select('league_id','Final, certified competition',eligible.map(l=>[l.id,l.name]))],'Attach certified finishing positions',p=>command({op:'annual_competition_attach',championship_id:id,...p}));
  if(c.policy&&c.competitions.length===5)panel.append(button('Finalize annual championship archive',()=>command({op:'annual_finalize',championship_id:id})));
 }
 table(panel,['Official game','Certified result source'],c.competitions.map(r=>[r.game_key,r.source_url]));
 const status=details(panel,'Five-game championship progress');status.open=true;
 table(status,['Official game','Certified competition attached'],['first-and-baa','horns-and-hoops','goat-crossover','league-of-greatness','goat-classic'].map(key=>[ctx.gameName(key),c.competitions.some(r=>r.game_key===key)?'Attached':'Awaiting certified final results']));
 if(c.policy){
  const board=await ctx.api.query({op:'annual_standings',championship_id:id});table(panel,['Rank','Member','BAAS under approved policy','Competitions'],board.map(r=>[r.rank,r.display_name,r.baas,r.competitions]));
  const mine=board.find(r=>r.user_id===account.profile.user_id),breakdown=mine?.breakdown||[];
  const personal=details(panel,'My annual performance by game');personal.open=true;personal.append(node('p','These values are calculated only from the attached certified finishes and approved conversion policy. This workspace issues no live BAAS awards.'));
  table(personal,['Official game','Certified place','BAAS under approved policy','Certified source'],breakdown.map(r=>[ctx.gameName(r.game_key),r.place,r.baas,r.source_url]));
 }
}
