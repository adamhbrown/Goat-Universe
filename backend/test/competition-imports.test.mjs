// All names, pairings and dates below are synthetic test inputs, never live data.
import test from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {csvRows,prepareImport,importTemplate,renderImportEditor} from '../games/imports.mjs';

const source='https://fixture.invalid/source',future='2099-01-01T00:00:00Z';
const fixture=(game_key='goat-crossover')=>({league:{id:'LEAGUE',game_key},series_events:[{id:'NBA',code:'SYNTHETIC-NBA'},{id:'NHL',code:'SYNTHETIC-NHL'}],bracket_nodes:[{id:'N1',code:'SYNTHETIC-N1'}],fantasy_teams:Array.from({length:12},(_,i)=>({id:'T'+i,external_team_id:String(i)})),fantasy_matchups:[{id:'M1',week:1,home_id:'T0',away_id:'T1'}]});
const seriesRow=()=>({code:'SYNTHETIC-NBA',winner:'SYNTHETIC HOME',source_url:source});
const prepare=(kind,rows,data=fixture())=>prepareImport(kind,JSON.stringify(rows),data);

test('CSV reader supports BOM, CRLF, escaped quotes and multiline quoted values without accepting malformed columns',()=>{
 assert.deepEqual(csvRows('\uFEFFcode,winner,source_url\r\nSYNTHETIC-NBA,"HOME, ""ONE""\nTEAM",https://fixture.invalid/source\r\n'),[{code:'SYNTHETIC-NBA',winner:'HOME, "ONE"\nTEAM',source_url:source}]);
 for(const text of ['a,a\n1,2','a,\n1,2','a,b\n1','a,b\n1,2,3','a\n"unfinished','a\n"ok"tail','a\nnot"quoted'])assert.throws(()=>csvRows(text));
 assert.match(importTemplate('fantasy_schedule'),/home_external_id/);
 assert.throws(()=>importTemplate('unknown'),/Unknown import/);
});

test('result imports resolve codes locally, reject foreign or conflicting IDs and cannot smuggle routing or approval fields',()=>{
 const result=prepare('series_results',[seriesRow()]);
 assert.deepEqual(result.payload,{op:'series_results_import',league_id:'LEAGUE',results:[{event_id:'NBA',winner:'SYNTHETIC HOME',source_url:source}],reviewed:true,import_format:'json'});
 for(const bad of [{code:'unknown'},{event_id:'NHL'},{op:'series_correct'},{league_id:'OTHER'},{owner_id:'OTHER'},{reviewed:true},{winner:''},{source_url:'javascript:alert(1)'},{source_url:'https://user:password@fixture.invalid/'}])assert.throws(()=>prepare('series_results',[{...seriesRow(),...bad}]));
 assert.throws(()=>prepare('series_results',[seriesRow(),seriesRow()]),/Duplicate/);
 assert.throws(()=>prepare('series_results',Array(257).fill(seriesRow())),/1–256/);
 assert.throws(()=>prepareImport('series_results',' '.repeat(262145),fixture()),/256 KB/);
 assert.throws(()=>prepare('bracket_results',[{code:'SYNTHETIC-N1',home_score:1,away_score:1,source_url:source}]),/decisive/);
 assert.throws(()=>prepare('bracket_results',[{code:'SYNTHETIC-N1',home_score:1.5,away_score:1,source_url:source}]),/range/);
});

test('series schedule review keeps unapproved formats configurable but rejects cross-sport feeders and impossible dates',()=>{
 const opening={code:'A',sport:'NBA',round:'SYNTHETIC ROUND',stage:1,lock_at:future,home_team:'SYNTHETIC HOME',away_team:'SYNTHETIC AWAY',source_url:source};
 const other={...opening,code:'B',home_team:'SYNTHETIC OTHER'};
 const final={code:'F',sport:'NBA',round:'SYNTHETIC FINAL',stage:2,lock_at:'2099-01-02T00:00:00Z',home_from_code:'A',away_from_code:'B',source_url:source};
 assert.equal(prepare('series_schedule',[final,other,opening]).rows.length,3,'Ordering belongs to the atomic server import');
 for(const bad of [{lock_at:'2099-02-30T00:00:00Z'},{lock_at:'2099-01-01'},{sport:'MLB'},{home_from_code:'B'},{stage:1.5}])assert.throws(()=>prepare('series_schedule',[{...opening,...bad}]));
 assert.throws(()=>prepare('series_schedule',[opening,{...other,sport:'NHL'},final]),/Invalid feeder/);
 assert.throws(()=>prepare('series_schedule',[opening,other,{...final,lock_at:future}]),/Invalid feeder/);
 assert.equal(prepare('series_schedule',[{...opening,sport:'MLB'}],fixture('goat-classic')).rows[0].sport,'MLB');
});

test('fantasy schedule imports resolve ESPN IDs and require all 84 verified pairings with no duplicate weekly franchises',()=>{
 const rows=[];for(let week=1;week<=14;week++)for(let i=0;i<6;i++)rows.push({week,home_external_id:String(i*2),away_external_id:String(i*2+1),starts_at:future,source_url:source});
 const result=prepare('fantasy_schedule',rows);assert.equal(result.rows.length,84);assert.equal(result.rows[0].home_id,'T0');assert.ok(!Object.hasOwn(result.rows[0],'home_external_id'));
 assert.throws(()=>prepare('fantasy_schedule',rows.slice(1)),/84 matchups/);
 assert.throws(()=>prepare('fantasy_schedule',rows.map((r,i)=>i===1?{...r,home_external_id:'0'}:r)),/Week 1/);
 assert.throws(()=>prepare('fantasy_schedule',rows.map((r,i)=>i===0?{...r,home_id:'T2'}:r)),/conflicting/);
 assert.throws(()=>prepare('fantasy_schedule',rows.map((r,i)=>i===0?{...r,home_external_id:'foreign'}:r)),/Unknown/);
});

test('fantasy score review preserves official totals and requires explicit bonus provenance and final verification',()=>{
 const row={week:1,home_external_id:'0',away_external_id:'1',home_score:100.25,away_score:101,source_includes_home_bonus:true,verified:true,source_url:source};
 const prepared=prepare('fantasy_results',[row]);assert.deepEqual(prepared.rows,[{matchup_id:'M1',home_score:100.25,away_score:101,source_includes_home_bonus:true,verified:true,source_url:source}]);
 for(const bad of [{verified:false},{verified:undefined},{source_includes_home_bonus:undefined},{source_includes_home_bonus:'yes'},{home_score:-1},{away_external_id:'2'},{matchup_id:'unknown'}])assert.throws(()=>prepare('fantasy_results',[{...row,...bad}]));
});

function editor(kind='series_results',data=fixture(),command=async()=>{}){
 const dom=new JSDOM('<main></main>');let live=true;const calls=[];
 const node=(tag,text,attrs={})=>{const e=dom.window.document.createElement(tag);if(text!==undefined)e.textContent=String(text);for(const [k,v]of Object.entries(attrs))e.setAttribute(k,v);return e;};
 const ctx={node,current:()=>live,details:(p,title)=>{const d=node('details');d.append(node('summary',title));p.append(d);return d;},table:(p,headers,rows)=>{const t=node('table');for(const row of [headers,...rows]){const tr=node('tr');for(const cell of row)tr.append(node('td',cell));t.append(tr);}p.append(t);},command:async p=>{calls.push(p);return command(p);}};
 const e=renderImportEditor(dom.window.document.querySelector('main'),{kind,title:'SYNTHETIC IMPORT',data},ctx);
 const change=(element,event='input')=>element.dispatchEvent(new dom.window.Event(event,{bubbles:true}));
 const text=JSON.stringify([seriesRow()]);
 return {dom,e,calls,text,change,leave:()=>{live=false;dom.window.document.querySelector('main').replaceChildren();}};
}
const tick=()=>new Promise(r=>setTimeout(r,0));

test('commissioner import requires current preview and explicit source review; duplicate Apply is single-flight',async()=>{
 let release;const p=editor('series_results',fixture(),()=>new Promise(r=>{release=r;}));try{
  const {e}=p;e.input.value=p.text;p.change(e.input);e.apply.click();assert.equal(p.calls.length,0);e.review.click();assert.equal(e.apply.disabled,true);assert.match(e.preview.textContent,/SYNTHETIC HOME/);
  e.verified.checked=true;p.change(e.verified,'change');assert.equal(e.apply.disabled,false);e.apply.click();e.apply.click();assert.equal(p.calls.length,1);assert.equal(e.input.disabled,true);release();await tick();
  e.input.value=p.text;p.change(e.input);assert.equal(e.apply.disabled,true);assert.equal(e.verified.checked,false);assert.equal(e.preview.childElementCount,0);
 }finally{p.dom.window.close();}
});

test('a failed import preserves input and requires a new source review before retrying',async()=>{
 const p=editor('series_results',fixture(),async()=>{throw new Error('commissioner_required');});try{const {e}=p;e.input.value=p.text;e.review.click();e.verified.checked=true;p.change(e.verified,'change');e.apply.click();await tick();assert.match(e.status.textContent,/Import not confirmed.*commissioner required/);assert.equal(e.input.value,p.text);assert.equal(e.apply.disabled,true);assert.equal(e.verified.checked,false);e.apply.click();assert.equal(p.calls.length,1);}finally{p.dom.window.close();}
});

test('delayed local file reads cannot overwrite a manual edit or resurrect a signed-out preview',async()=>{
 const p=editor();try{let finish;const file={name:'SYNTHETIC.csv',size:20,text:()=>new Promise(r=>{finish=r;})};Object.defineProperty(p.e.file,'files',{value:[file],configurable:true});p.change(p.e.file,'change');assert.equal(p.e.review.disabled,true);
  p.e.input.value=p.text;p.change(p.e.input);finish('stale file contents');await tick();assert.equal(p.e.input.value,p.text);assert.equal(p.e.review.disabled,false);
  p.change(p.e.file,'change');p.leave();finish(p.text);await tick();assert.equal(p.dom.window.document.querySelector('main').childElementCount,0);assert.equal(p.calls.length,0);
 }finally{p.dom.window.close();}
});

test('replacing a pending upload with an oversized file unlocks local review; stale pagination does not revive old rows',async()=>{
 const p=editor();try{let finish;Object.defineProperty(p.e.file,'files',{value:[{size:10,text:()=>new Promise(r=>{finish=r;})}],configurable:true});p.change(p.e.file,'change');
  Object.defineProperty(p.e.file,'files',{value:[{size:262145}],configurable:true});p.change(p.e.file,'change');assert.equal(p.e.review.disabled,false);finish(p.text);await tick();assert.equal(p.e.input.value,'');assert.match(p.e.status.textContent,/256 KB/);
  const rows=Array.from({length:21},(_,i)=>({...seriesRow(),code:'S'+i}));const q=editor('series_results',{...fixture(),series_events:rows.map((r,i)=>({id:'I'+i,code:r.code}))});try{q.e.input.value=JSON.stringify(rows);q.e.review.click();const oldNext=q.e.preview.querySelector('button');assert.ok(oldNext);q.change(q.e.input);oldNext.click();assert.equal(q.e.preview.childElementCount,0);}finally{q.dom.window.close();}
 }finally{p.dom.window.close();}
});
