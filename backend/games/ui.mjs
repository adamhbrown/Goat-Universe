import {renderBracket} from '../portal/bracket.mjs';
import {renderNfl} from './nfl.mjs';
import {renderSeries} from './series.mjs';
import {renderFantasy} from './fantasy.mjs';
import {renderAnnual} from './annual.mjs';

const keys=['first-and-baa','horns-and-hoops','goat-crossover','league-of-greatness','goat-classic'];
const readiness={
 'first-and-baa':'Ranked ATS picks · 59 game points + 2 MVP points',
 'horns-and-hoops':'63-game main bracket · Qualifying picks · 209 main points',
 'goat-crossover':'One combined NBA/NHL competition · Scoring requires approved rules',
 'league-of-greatness':'12 franchises · 14 regular weeks · Seven playoff qualifiers',
 'goat-classic':'MLB series workspace · Scoring requires approved rules'
};
export async function mountGames({document,location,history,createClient,fetchPublic}){
 const $=id=>document.getElementById(id),win=document.defaultView;
 const catalogResponse=await fetchPublic('/goat-games');if(!catalogResponse.ok)throw new Error('catalog_unavailable');
 const catalog=(await catalogResponse.json()).games.filter(g=>keys.includes(g.id));
 let api=createClient(),account,dashboard,generation=0,view=0,activeLeague,activeAnnual;
 let selected=catalog.find(g=>location.pathname==='/games/'+g.id)?.id||'';
 const node=(tag,text,attrs={})=>{const e=document.createElement(tag);if(text!==undefined)e.textContent=String(text);for(const [k,v]of Object.entries(attrs))e.setAttribute(k,String(v));return e;};
 const notify=text=>{$('notice').textContent=text;};
 const field=(name,label,type='text',value='',attrs={})=>({name,label,type,value,attrs});
 const select=(name,label,options,value='',attrs={required:''})=>({...field(name,label,'select',value,attrs),options});
 const timezone=Intl.DateTimeFormat().resolvedOptions().timeZone;
 const datetime=(name,label)=>field(name,label+' · '+timezone,'datetime-local','',{required:''});
 const required={required:'',maxlength:150};
 const details=(parent,title)=>{const d=node('details');d.append(node('summary',title));parent.append(d);return d;};
 const table=(parent,headers,rows)=>{
  if(!rows.length){parent.append(node('p','No records yet.'));return;}
  const wrap=node('div',undefined,{class:'table-wrap'}),t=node('table'),head=node('tr'),body=node('tbody');
  headers.forEach(h=>head.append(node('th',h,{scope:'col'})));const thead=node('thead');thead.append(head);t.append(thead);
  for(const row of rows){const tr=node('tr');row.forEach(v=>tr.append(node('td',v??'—')));body.append(tr);}t.append(body);wrap.append(t);parent.append(wrap);
 };
 function context(panel,capturedApi,g,v,refresh){
  const current=()=>g===generation&&v===view;
  async function run(fn,b){if(b?.disabled||!current())return;if(b)b.disabled=true;try{await fn();}catch(e){if(current())notify(e.message.replaceAll('_',' '));}finally{if(b)b.disabled=false;}}
  function button(text,fn){const b=node('button',text,{type:'button'});b.addEventListener('click',()=>run(fn,b));return b;}
  function form(parent,title,fields,label,submit){
   const f=node('form');if(title)f.append(node('h3',title));
   for(const spec of fields){const l=node('label',spec.label),input=node(['textarea','select'].includes(spec.type)?spec.type:'input',undefined,{name:spec.name,...(!['textarea','select'].includes(spec.type)?{type:spec.type}:{}),...(spec.type==='textarea'?{maxlength:30000}:{}),...spec.attrs});
    for(const [value,text]of spec.options||[])input.append(node('option',text,{value}));
    if(spec.type==='checkbox')input.checked=Boolean(spec.value);else input.value=spec.value??'';l.append(input);f.append(l);
   }
   const b=node('button',label,{type:'submit'});f.append(b);
   f.addEventListener('submit',event=>{event.preventDefault();if(b.disabled||!current()||!f.checkValidity())return;run(async()=>{
    const p={};for(const spec of fields){const input=f.elements[spec.name];p[spec.name]=spec.type==='checkbox'?input.checked:spec.type==='number'?Number(input.value):spec.type==='datetime-local'?new Date(input.value).toISOString():input.value.trim();}
    await submit(p);
   },b);});parent.append(f);return f;
  }
  async function command(p){if(!current())throw new Error('view_changed');const result=await capturedApi.command(p);if(current()){await refresh(result);if(g===generation)notify('Saved.');}return result;}
  return {panel,account,api:capturedApi,node,form,details,table,button,field,select,command,required,datetime,message:text=>{if(current())notify(text);},fetchPublic,current};
 }
 function clearPrivate(){generation++;view++;account=undefined;dashboard=undefined;activeLeague=undefined;activeAnnual=undefined;api=createClient();
  for(const id of ['league-list','member-actions','league-panel','annual-panel'])$(id).replaceChildren();
  $('account-panel').hidden=false;for(const id of ['member-panel','league-panel','annual-panel'])$(id).hidden=true;
  $('account-form').elements.password.value='';
 }
 function chrome(){
  const game=catalog.find(g=>g.id===selected);
  $('game-title').textContent=game?.name||'The GOAT Games';$('game-subtitle').textContent=game?.subtitle||'Choose your competition. Bring your game.';
  $('game-status').textContent=game?readiness[game.id]+'. Development features; official schedules, rule approval and hosted acceptance remain required.':'Development preview. No live scores or example BAAS values are displayed.';
  document.title=(game?.name||'GOAT Games')+' — GOAT Universe';
  $('game-nav').replaceChildren();
  for(const [id,title]of [['','All games'],...catalog.map(g=>[g.id,g.name])]){
   const a=node('a',title,{href:id?'/games/'+id:'/games',...(id===selected?{'aria-current':'page'}:{})});
   a.addEventListener('click',e=>{if(e.button!==0||e.metaKey||e.ctrlKey||e.shiftKey)return;e.preventDefault();chooseGame(id);});$('game-nav').append(a);
  }
  $('catalog').replaceChildren();$('catalog').hidden=Boolean(game);
  for(const g of catalog){const card=node('article',undefined,{class:'card'});card.append(node('p','COMPETITION WORKSPACE',{class:'badge'}),node('h2',g.name),node('p',g.subtitle),node('p',readiness[g.id]));
   const link=node('a','Open '+g.name,{href:'/games/'+g.id,class:'button'});link.addEventListener('click',e=>{if(e.button!==0||e.metaKey||e.ctrlKey||e.shiftKey)return;e.preventDefault();chooseGame(g.id);});card.append(link);$('catalog').append(card);
  }
 }
 function chooseGame(id,push=true){selected=id;view++;activeLeague=undefined;activeAnnual=undefined;$('league-panel').replaceChildren();$('league-panel').hidden=true;$('annual-panel').replaceChildren();$('annual-panel').hidden=true;
  if(push)history.pushState({},'',id?'/games/'+id:'/games');chrome();if(account)renderDashboard();$('game-title').focus();
 }
 async function loadDashboard(){const g=generation,capturedApi=api;const [me,d]=await Promise.all([capturedApi.query({op:'me'}),capturedApi.query({op:'competition_dashboard'})]);
  if(g!==generation)return;account=me;dashboard=d;$('account-panel').hidden=true;$('member-panel').hidden=false;renderDashboard();
 }
 function renderDashboard(){
  if(!account||!dashboard)return;$('member-name').textContent=(selected?'My '+catalog.find(g=>g.id===selected).name+' entries':'My competitions')+' · '+account.profile.display_name;
  const g=generation,v=view,capturedApi=api;const ctx=context($('member-actions'),capturedApi,g,v,async result=>{await loadDashboard();if(result.id&&selected)await openLeague(result.id);});
  const {node,button,form,field}=ctx;$('league-list').replaceChildren();$('member-actions').replaceChildren();
  const groups=dashboard.competitions.filter(c=>!selected||c.game_key===selected);
  for(const group of groups)for(const l of group.leagues){const card=node('article',undefined,{class:'card'});card.append(node('h3',l.name),node('p',catalog.find(g=>g.id===group.game_key).name+' · '+l.season),node('p',l.status+' · Entry: '+(l.owner_id===account.profile.user_id?'Commissioner':l.entry_status||'none')));
   if(l.owner_id===account.profile.user_id||l.entry_status==='approved')card.append(button('Open competition',async()=>{selected=group.game_key;chrome();await openLeague(l.id);}));else card.append(node('p',l.entry_status==='pending'?'Awaiting commissioner approval.':'This entry has not been approved.'));$('league-list').append(card);
  }
  if(!$('league-list').childElementCount)$('league-list').append(node('p','No entries yet. Join with an invitation or create a competition draft.'));
  form($('member-actions'),'Join a private competition',[field('league_id','Invitation ID','text','',{required:'',pattern:'[a-fA-F0-9-]{36}',maxlength:36})],'Request entry',async p=>{await capturedApi.command({op:'enroll',...p});if(g===generation){await loadDashboard();notify('Entry requested. Your commissioner must approve it before picks are available.');}});
  if(selected)form($('member-actions'),'Start a commissioner draft',[field('name','Competition name','text','',{required:'',maxlength:120}),field('season','Season year','number','',{required:'',min:2019,max:2100,step:1})],'Create draft',p=>ctx.command({op:'game_draft_create',game_key:selected,...p,season:String(p.season)}));
  else $('member-actions').append(button('Annual GOAT Championship',openAnnual));
 }
 async function openLeague(id){
  const g=generation,v=++view,capturedApi=api;activeLeague=id;activeAnnual=undefined;
  $('annual-panel').hidden=true;$('league-panel').hidden=false;$('league-panel').replaceChildren(node('p','Loading your competition…'));
  try{
   const [data,standings,historyRows]=await Promise.all([capturedApi.query({op:'league',league_id:id}),capturedApi.query({op:'standings',league_id:id}),capturedApi.query({op:'history',league_id:id})]);
   if(g!==generation||v!==view)return;
   const panel=node('div'),ctx=context(panel,capturedApi,g,v,()=>openLeague(id));
   panel.append(ctx.button('Back to my competitions',async()=>{view++;activeLeague=undefined;$('league-panel').replaceChildren();$('league-panel').hidden=true;renderDashboard();}),ctx.button('Refresh competition',()=>openLeague(id)),node('h2',data.league.name),node('p',data.league.season+' · '+data.league.status));
   const key=data.league.game_key||(data.league.strategy==='ranked_ats_v1'?'first-and-baa':'horns-and-hoops');selected=key;chrome();
   if(key==='horns-and-hoops')await renderBracket(data,ctx);
   else if(key==='first-and-baa')await renderNfl(data,standings,ctx);
   else if(key==='league-of-greatness')await renderFantasy(data,standings,ctx);
   else await renderSeries(data,standings,ctx);
   if(key!=='horns-and-hoops'){const archive=ctx.details(panel,'Competition history');for(const h of historyRows){const snap=ctx.details(archive,h.reason+' · '+new Date(h.recorded_at).toLocaleString());ctx.table(snap,['Rank','Competitor','Points / points for'],h.snapshot.map(r=>[r.rank,r.display_name||r.name,r.points??r.points_for]));}}
   if(data.finish_certification)panel.append(node('p','Finishing positions certified from '+data.finish_certification.source_reference+'.'));
   if(data.league.status==='final'&&data.league.owner_id===account.profile.user_id&&!data.finish_certification){
    const cert=ctx.details(panel,'Certify official finishing positions for the annual championship');cert.append(node('p','Known engine places cannot be changed. Unresolved fantasy places require a sourced official order. No BAAS conversion is assumed.'));
    ctx.form(cert,'Official final places',[...standings.map((r,i)=>ctx.field('place_'+i,(r.display_name||r.name)+' — place','number',r.rank??'',{required:'',min:1,max:standings.length,step:1})),ctx.field('source_url','Official finishing-position source','url','',{required:''}),ctx.field('source_reference','Reviewed finishing-position policy / source','text','',ctx.required),ctx.field('verified','I verified these finishing positions against the source.','checkbox',false,{required:''})],'Certify finishing positions',p=>ctx.command({op:'competition_finish_certify',league_id:id,finishes:standings.map((r,i)=>({user_id:r.user_id,place:p['place_'+i]})),verified:p.verified,source_url:p.source_url,source_reference:p.source_reference}));
   }
   if(g===generation&&v===view){$('league-panel').replaceChildren(panel);renderDashboard();}
  }catch(e){if(g===generation&&v===view){$('league-panel').replaceChildren(node('p','Competition unavailable. Return to your entries and try again.'));notify(e.message.replaceAll('_',' '));}}
 }
 async function openAnnual(){
  const g=generation,v=++view,capturedApi=api;activeLeague=undefined;$('league-panel').hidden=true;$('annual-panel').hidden=false;
  const panel=node('div'),ctx=context(panel,capturedApi,g,v,async result=>{if(result.id)activeAnnual=result.id;await openAnnual();});
  try{await renderAnnual(activeAnnual,dashboard,ctx,id=>{activeAnnual=id;return openAnnual();});if(g===generation&&v===view)$('annual-panel').replaceChildren(panel);}catch(e){if(g===generation&&v===view)notify(e.message.replaceAll('_',' '));}
 }
 $('account-form').addEventListener('submit',async event=>{
  event.preventDefault();const f=event.currentTarget,controls=[...f.querySelectorAll('button')];if(controls.some(b=>b.disabled)||!f.checkValidity())return;
  controls.forEach(b=>b.disabled=true);const g=generation,capturedApi=api,action=event.submitter?.value||'login';
  const params={email:f.elements.email.value.trim(),password:f.elements.password.value,...(f.elements.display_name.value.trim()?{display_name:f.elements.display_name.value.trim()}:{})};
  try{if(action==='signup'){const result=await capturedApi.signup(params);if(g===generation)notify(result.confirmation_required?'Registration submitted. Confirm your email before signing in.':'Development account created. Sign in to continue.');}
   else{await capturedApi.login(params);if(g!==generation){await capturedApi.logout().catch(()=>{});return;}await loadDashboard();if(g===generation)notify('Signed in.');}
  }catch(e){if(g===generation)notify(e.message.replaceAll('_',' '));}finally{if(g===generation)f.elements.password.value='';controls.forEach(b=>b.disabled=false);}
 });
 $('sign-out').addEventListener('click',async()=>{const oldApi=api;clearPrivate();const g=generation;notify('Private competition views cleared.');try{await oldApi.logout();if(g===generation)notify('Signed out.');}catch{if(g===generation)notify('Private views cleared. Server sign-out was not confirmed; retry from your account workspace.');}});
 win?.addEventListener('pagehide',()=>{clearPrivate();notify('Sign in again to load private competitions.');});
 win?.addEventListener('popstate',()=>chooseGame(catalog.find(g=>location.pathname==='/games/'+g.id)?.id||'',false));
 chrome();
 return {openLeague,chooseGame,openAnnual,loadDashboard,clear:clearPrivate};
}
