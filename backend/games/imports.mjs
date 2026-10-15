// Import preparation is local and read-only. Applying reviewed rows still uses
// the normal actor-bound, atomic competition command and its server validation.
const kinds={
 series_schedule:{op:'series_schedule_import',property:'events',headers:['code','sport','round','stage','lock_at','source_url','home_team','away_team','home_from_code','away_from_code'],max:256},
 series_results:{op:'series_results_import',property:'results',headers:['code','event_id','winner','source_url'],max:256},
 bracket_schedule:{op:'bracket_schedule_import',property:'nodes',headers:['code','stage','starts_at','source_url','home_team','away_team','home_from_code','away_from_code'],max:95},
 bracket_results:{op:'bracket_results_import',property:'results',headers:['code','node_id','home_score','away_score','source_url'],max:95},
 fantasy_schedule:{op:'fantasy_schedule_import',property:'matchups',headers:['week','home_external_id','away_external_id','home_id','away_id','starts_at','source_url'],max:84},
 fantasy_results:{op:'fantasy_results_import',property:'results',headers:['matchup_id','week','home_external_id','away_external_id','home_score','away_score','source_includes_home_bonus','verified','source_url'],max:90}
};
const error=(row,message)=>{throw new Error((row?'Row '+row+': ':'')+message);};
export function csvRows(text){
 const records=[];let cells=[],cell='',quoted=false,afterQuote=false,started=false;
 text=text.replace(/^\uFEFF/,'');
 const endCell=()=>{cells.push(cell);cell='';started=false;afterQuote=false;};
 const endRow=()=>{endCell();if(cells.some(v=>v.trim()!==''))records.push(cells);cells=[];};
 for(let i=0;i<text.length;i++){
  const c=text[i];
  if(quoted){if(c==='"'){if(text[i+1]==='"'){cell+='"';i++;}else{quoted=false;afterQuote=true;}}else cell+=c;continue;}
  if(afterQuote&&![',','\r','\n'].includes(c))error(records.length+1,'Unexpected text after a quoted CSV value.');
  if(c==='"'){if(started)error(records.length+1,'Quote a complete CSV value, escaping inner quotes twice.');quoted=true;started=true;}
  else if(c===',')endCell();else if(c==='\n'||c==='\r'){if(c==='\r'&&text[i+1]==='\n')i++;endRow();}else{cell+=c;started=true;}
 }
 if(quoted)error(records.length+1,'A quoted CSV value was not closed.');
 if(cell||cells.length||started||afterQuote)endRow();
 if(records.length<2)error(null,'Include column names and at least one data row.');
 const headers=records.shift().map(h=>h.trim());
 if(headers.some(h=>!h)||new Set(headers).size!==headers.length)error(null,'CSV column names must be nonempty and unique.');
 return records.map((values,i)=>{if(values.length!==headers.length)error(i+2,'CSV column count does not match the header.');return Object.fromEntries(headers.map((h,j)=>[h,values[j].trim()]));});
}
function string(value,row,label,max=150){if(typeof value!=='string'||!value.trim()||value.trim().length>max)error(row,label+' is required (maximum '+max+' characters).');return value.trim();}
function number(value,row,label,{integer=false,min=0,max=Number.MAX_SAFE_INTEGER}={}){
 if(typeof value!=='number'&&(typeof value!=='string'||!/^\d+(?:\.\d+)?$/.test(value)))error(row,label+' must be a number.');
 const n=Number(value);if(!Number.isFinite(n)||n<min||n>max||(integer&&!Number.isSafeInteger(n)))error(row,label+' is outside the accepted range.');return n;
}
function boolean(value,row,label){if(value===true||value==='true'||value==='TRUE')return true;if(value===false||value==='false'||value==='FALSE')return false;error(row,label+' must explicitly be true or false.');}
function https(value,row){const s=string(value,row,'source_url',2000);let u;try{u=new URL(s);}catch{error(row,'source_url must be a valid HTTPS URL.');}if(u.protocol!=='https:'||!u.hostname||u.username||u.password||/\s/.test(s))error(row,'source_url must be HTTPS without credentials or whitespace.');return s;}
function timestamp(value,row,label){
 const s=string(value,row,label,80),parts=/^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.exec(s);
 const day=parts&&Date.parse(parts[1]+'T00:00:00Z');
 if(!parts||!Number.isFinite(day)||new Date(day).toISOString().slice(0,10)!==parts[1]||Number(parts[2])>23||Number(parts[3])>59||Number(parts[4])>59||!Number.isFinite(Date.parse(s)))error(row,label+' must be a real ISO date/time with an explicit time zone.');return s;
}
const present=v=>v!==undefined&&v!==null&&v!=='';
function identify(row,index,collection,idName){
 const byId=present(row[idName])?collection.find(e=>e.id===row[idName]):null,byCode=present(row.code)?collection.find(e=>e.code===row.code):null;
 if(present(row[idName])&&!byId||present(row.code)&&!byCode||byId&&byCode&&byId.id!==byCode.id)error(index,'The supplied code and ID must identify the same game in this competition.');
 const found=byId||byCode;if(!found)error(index,'Supply a known game code or '+idName+'.');return found;
}
function fantasyTeam(row,index,side,teams){
 const id=row[side+'_id'],external=row[side+'_external_id'];
 const byId=present(id)?teams.find(t=>t.id===id):null,byExternal=present(external)?teams.find(t=>t.external_team_id===String(external)):null;
 if(present(id)&&!byId||present(external)&&!byExternal||byId&&byExternal&&byId.id!==byExternal.id)error(index,'Unknown or conflicting '+side+' franchise identifiers.');
 const t=byId||byExternal;if(!t)error(index,'Supply '+side+'_external_id or '+side+'_id from this roster.');return t.id;
}
export function importTemplate(kind){if(!kinds[kind])error(null,'Unknown import type.');return kinds[kind].headers.join(',')+'\r\n';}
export function prepareImport(kind,text,data){
 const spec=kinds[kind];if(!spec)error(null,'Unknown import type.');
 if(typeof text!=='string'||new TextEncoder().encode(text).length>262144)error(null,'Choose an import file smaller than 256 KB.');
 const content=text.replace(/^\uFEFF/,'').trim();let rows,format;
 if(content.startsWith('[')){format='json';try{rows=JSON.parse(content);}catch{error(null,'The JSON must be a valid array of records.');}}else{format='csv';rows=csvRows(content);}
 if(!Array.isArray(rows)||!rows.length||rows.length>spec.max)error(null,'Supply 1–'+spec.max+' records for this import.');
 const events=data.series_events||[],nodes=data.bracket_nodes||[],teams=data.fantasy_teams||[],matches=data.fantasy_matchups||[];
 const prepared=rows.map((r,i)=>{
  const line=i+(format==='csv'?2:1);if(!r||typeof r!=='object'||Array.isArray(r))error(line,'Each record must be an object.');
  for(const key of Object.keys(r))if(!spec.headers.includes(key))error(line,'Unexpected column '+key+'. Use the template column names.');
  const out={source_url:https(r.source_url,line)};
  if(kind.endsWith('_schedule')&&kind!=='fantasy_schedule'){
   out.code=string(r.code,line,'code',80);out.stage=number(r.stage,line,'stage',{integer:true,min:kind==='bracket_schedule'?0:1,max:kind==='bracket_schedule'?6:32});
   const timeKey=kind==='series_schedule'?'lock_at':'starts_at';if(kind==='series_schedule'||out.stage<=1||present(r.starts_at))out[timeKey]=timestamp(r[timeKey],line,timeKey);
   if(kind==='series_schedule'){out.sport=string(r.sport,line,'sport',3);const allowed=data.league.game_key==='goat-crossover'?['NBA','NHL']:['MLB'];if(!allowed.includes(out.sport))error(line,'Sport must be '+allowed.join(' or ')+'.');out.round=string(r.round,line,'round',80);}
   for(const side of ['home','away']){const name=r[side+'_team'],from=r[side+'_from_code'];if(present(name)===present(from))error(line,'Supply exactly one '+side+'_team or '+side+'_from_code.');out[side+(present(name)?'_team':'_from_code')]=string(present(name)?name:from,line,side+' entrant');}
   if(out.home_team&&out.home_team===out.away_team||out.home_from_code&&out.home_from_code===out.away_from_code)error(line,'Entrants must be different.');
  }else if(kind==='fantasy_schedule'){
   out.week=number(r.week,line,'week',{integer:true,min:1,max:14});out.home_id=fantasyTeam(r,line,'home',teams);out.away_id=fantasyTeam(r,line,'away',teams);if(out.home_id===out.away_id)error(line,'A franchise cannot play itself.');out.starts_at=timestamp(r.starts_at,line,'starts_at');
  }else if(kind==='fantasy_results'){
   let m=present(r.matchup_id)?matches.find(m=>m.id===r.matchup_id):null;
   const external=present(r.week)||present(r.home_external_id)||present(r.away_external_id);
   if(external){const week=number(r.week,line,'week',{integer:true,min:1,max:17}),home=fantasyTeam(r,line,'home',teams),away=fantasyTeam(r,line,'away',teams);const byTeams=matches.find(m=>m.week===week&&m.home_id===home&&m.away_id===away);if(!byTeams||m&&m.id!==byTeams.id)error(line,'Week and franchise IDs do not match an official scheduled matchup.');m=byTeams;}
   if(!m||present(r.matchup_id)&&m.id!==r.matchup_id)error(line,'Supply a known matchup_id or its week and official home/away ESPN IDs.');out.matchup_id=m.id;
   out.home_score=number(r.home_score,line,'home_score');out.away_score=number(r.away_score,line,'away_score');out.source_includes_home_bonus=boolean(r.source_includes_home_bonus,line,'source_includes_home_bonus');out.verified=boolean(r.verified,line,'verified');if(!out.verified)error(line,'Only verified final scores may be imported.');
  }else if(kind==='series_results'){out.event_id=identify(r,line,events,'event_id').id;out.winner=string(r.winner,line,'winner');}
  else{out.node_id=identify(r,line,nodes,'node_id').id;out.home_score=number(r.home_score,line,'home_score',{integer:true});out.away_score=number(r.away_score,line,'away_score',{integer:true});if(out.home_score===out.away_score)error(line,'Bracket results must be decisive.');}
  return out;
 });
 const idKey=kind.endsWith('_schedule')?(kind==='fantasy_schedule'?null:'code'):kind==='series_results'?'event_id':kind==='fantasy_results'?'matchup_id':'node_id';
 if(idKey&&new Set(prepared.map(r=>r[idKey])).size!==prepared.length)error(null,'Duplicate game codes or result IDs are not allowed.');
 if(kind==='fantasy_schedule'){
  if(teams.length!==12||prepared.length!==84)error(null,'A complete schedule needs 12 rostered franchises and 84 matchups.');
  for(let week=1;week<=14;week++){const games=prepared.filter(r=>r.week===week),used=games.flatMap(r=>[r.home_id,r.away_id]);if(games.length!==6||new Set(used).size!==12)error(null,'Week '+week+' must include six matchups with each franchise exactly once.');}
 }
 if(kind==='bracket_schedule'&&prepared.length<63)error(null,'Import the complete 63-game main bracket and any sourced qualifiers together.');
 if(kind.endsWith('_schedule')&&kind!=='fantasy_schedule')for(const row of prepared)for(const side of ['home','away'])if(row[side+'_from_code']){
  const parent=prepared.find(p=>p.code===row[side+'_from_code']);
  if(!parent||parent.stage>=row.stage||kind==='bracket_schedule'&&parent.stage!==row.stage-1||kind==='series_schedule'&&(parent.sport!==row.sport||Date.parse(parent.lock_at)>=Date.parse(row.lock_at)))error(null,'Invalid feeder for '+row.code+': use an earlier stage in the same sport with an earlier lock.');
 }
 const payload={op:spec.op,league_id:data.league.id,[spec.property]:prepared,reviewed:true,import_format:format};
 if(new TextEncoder().encode(JSON.stringify(payload)).length>32768)error(null,'This import exceeds the 32 KB request limit. Result imports can be split into smaller batches; schedules require a compact complete file.');
 return {payload,rows:prepared,format};
}

export function renderImportEditor(parent,{kind,title,data},ctx){
 const spec=kinds[kind],{node,details,table,current}=ctx,box=details(parent,title);
 box.append(node('p','Upload CSV/JSON or paste records. Review the normalized rows against your official source before applying. No source file is sent until you apply the reviewed import.'));
 box.append(node('p','CSV columns:'),node('pre',importTemplate(kind)));
 const file=node('input',undefined,{type:'file',accept:'.csv,.json,text/csv,application/json'}),fileLabel=node('label','Source file');fileLabel.append(file);box.append(fileLabel);
 const input=node('textarea',undefined,{rows:8,'aria-label':title+' records',maxlength:262144}),review=node('button','Review import',{type:'button'}),verified=node('input',undefined,{type:'checkbox'}),verification=node('label','I compared these records with the official source.');verification.prepend(verified);
 const apply=node('button','Apply reviewed import',{type:'button',disabled:''}),status=node('p','',{role:'status','aria-live':'polite'}),preview=node('div');box.append(input,review,status,preview,verification,apply);
 let version=0,reviewed,loading=false,applying=false;
 function invalidate(){version++;reviewed=undefined;apply.disabled=true;verified.checked=false;preview.replaceChildren();status.textContent='Review the current records before applying.';}
 function reviewNow(){if(!current()||loading||applying)return;try{reviewed={...prepareImport(kind,input.value,data),version};const snapshot=reviewed;let page=0;
   const draw=()=>{if(!current()||reviewed!==snapshot||snapshot.version!==version)return;preview.replaceChildren();const rows=snapshot.rows.slice(page*20,(page+1)*20),headers=Object.keys(snapshot.rows[0]);preview.append(node('p','Rows '+(page*20+1)+'–'+(page*20+rows.length)+' of '+snapshot.rows.length));table(preview,headers,rows.map(r=>headers.map(h=>r[h])));
    if(page){const previous=node('button','Previous rows',{type:'button'});previous.addEventListener('click',()=>{page--;draw();});preview.append(previous);}
    if((page+1)*20<reviewed.rows.length){const next=node('button','Next rows',{type:'button'});next.addEventListener('click',()=>{page++;draw();});preview.append(next);}
   };draw();status.textContent=reviewed.rows.length+' records checked. Verify their source before applying.';apply.disabled=!verified.checked;
  }catch(e){reviewed=undefined;apply.disabled=true;preview.replaceChildren();status.textContent=e.message;}}
 input.addEventListener('input',()=>{loading=false;review.disabled=false;invalidate();});review.addEventListener('click',reviewNow);
 verified.addEventListener('change',()=>{apply.disabled=applying||!verified.checked||!reviewed||reviewed.version!==version;});
 file.addEventListener('change',async()=>{if(!current()||applying)return;invalidate();loading=false;review.disabled=false;const selected=file.files?.[0],requested=version;if(!selected)return;if(selected.size>262144){status.textContent='Choose a file smaller than 256 KB.';return;}loading=true;review.disabled=true;
  try{const text=typeof selected.text==='function'?await selected.text():await new Promise((resolve,reject)=>{const reader=new file.ownerDocument.defaultView.FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(new Error('Cannot read this file.'));reader.readAsText(selected);});
   if(current()&&requested===version){input.value=text;loading=false;review.disabled=false;status.textContent=selected.name+' loaded locally. Review it before applying.';}
  }catch(e){if(current()&&requested===version){loading=false;review.disabled=false;status.textContent=e.message;}}
 });
 apply.addEventListener('click',async()=>{if(!current()||applying||!reviewed||reviewed.version!==version||!verified.checked)return;applying=true;apply.disabled=true;review.disabled=true;input.disabled=true;file.disabled=true;
  try{await ctx.command(reviewed.payload);if(current()){invalidate();status.textContent='Import saved. Refresh the competition to review its latest records.';}}catch(e){if(current()){invalidate();status.textContent='Import not confirmed: '+e.message.replaceAll('_',' ')+'. Refresh and review before retrying.';}}
  finally{applying=false;review.disabled=false;input.disabled=false;file.disabled=false;}
 });
 return {box,input,file,review,verified,apply,status,preview};
}
