import test,{before,after} from 'node:test';
import assert from 'node:assert/strict';
import {LocalDatabase} from '../database.mjs';

let db,owner,outsider,members,championship,leagues;
const source='https://fixture.invalid/official-test-results';
const future=new Date(Date.now()+86400000).toISOString();
const past=new Date(Date.now()-86400000).toISOString();
const keys=['first-and-baa','horns-and-hoops','goat-crossover','league-of-greatness','goat-classic'];
const command=(p,actor=owner)=>db.rpc('goat_command',p,actor);
const query=(p,actor=owner)=>db.rpc('goat_query',p,actor);
const policy=()=>({approved:true,season:2027,source_reference:'SYNTHETIC BAAS CONVERSIONS FOR TESTS ONLY',tie_policy:'shared_rank',
 conversions:Object.fromEntries(keys.map(k=>[k,Array.from({length:12},(_,i)=>120-i*10)]))});
before(async()=>{
 db=await new LocalDatabase().init();const users=[];
 for(let i=0;i<14;i++)users.push((await db.db.query('insert into auth.users(id,email,raw_user_meta_data) values(gen_random_uuid(),$1,$2) returning id',[`annual${i}@fixture.invalid`,JSON.stringify({display_name:'ANNUAL TEST '+i})])).rows[0].id);
 [owner,outsider,...members]=users;
});
after(async()=>db.close());
async function approveEntries(lid){
 for(const actor of [members[0],members[2]]){await command({op:'enroll',league_id:lid},actor);await command({op:'entry_decide',league_id:lid,user_id:actor,approved:true});}
}
async function finishNfl(){
 const l=await command({op:'game_draft_create',game_key:'first-and-baa',name:'ANNUAL NFL SYNTHETIC FIXTURE',season:'2027'});
 const r=await command({op:'round_create',league_id:l.id,name:'FIXTURE ONLY',weights:[1],lock_at:future});
 const g=await command({op:'game_create',round_id:r.id,home:'FIXTURE H',away:'FIXTURE A',starts_at:future,home_spread:0,source_url:source});
 await command({op:'league_rules',league_id:l.id,rules:{approved:true,max_points:1,tiebreaker:'ats_record',source_reference:'SYNTHETIC SMALL FIXTURE, NOT OFFICIAL NFL BUDGET',unresolved:[]}});
 await command({op:'league_open',league_id:l.id,reason:'TEST ONLY'});await approveEntries(l.id);
 await command({op:'round_open',round_id:r.id,approved:true,push_multiplier:0,missing_policy:'block',reason:'TEST ONLY'});
 for(const a of [members[0],members[2]])await command({op:'picks_submit',round_id:r.id,picks:[{game_id:g.id,side:'home',weight:1}]},a);
 await db.db.query('update public.goat_rounds set lock_at=$1 where id=$2',[past,r.id]);await db.db.query('update public.goat_games set starts_at=$1 where id=$2',[past,g.id]);
 await command({op:'result_set',game_id:g.id,home_score:21,away_score:14,source_url:source});await command({op:'round_finalize',round_id:r.id});await command({op:'league_finalize',league_id:l.id});return l;
}
async function finishBracket(){
 const l=await command({op:'game_draft_create',game_key:'horns-and-hoops',name:'ANNUAL NCAA SYNTHETIC FIXTURE',season:'2027',main_lock_at:future,schedule_source:source});
 const nodes=[];
 for(let stage=1;stage<=6;stage++){
  const prior=nodes.filter(n=>n.stage===stage-1);
  for(let i=0;i<2**(6-stage);i++){
   const game={op:'bracket_node_create',league_id:l.id,code:`S${stage}G${i}`,stage,starts_at:future,source_url:source};
   if(stage===1){game.home_team='FIXTURE HOME '+i;game.away_team='FIXTURE AWAY '+i;}
   else{game.home_from=prior[2*i].id;game.away_from=prior[2*i+1].id;}
   nodes.push({...await command(game),stage,team:stage===1?game.home_team:prior[2*i].team});
  }
 }
 await command({op:'league_rules',league_id:l.id,rules:{approved:true,points:[1,2,3,5,7,9,11],tiebreaker:'championship_total_closest',source_reference:'Founder scoring with SYNTHETIC TEST schedule',unresolved:[]}});
 await command({op:'league_open',league_id:l.id,reason:'TEST ONLY'});await approveEntries(l.id);
 for(const a of [members[0],members[2]])await command({op:'bracket_submit',league_id:l.id,picks:nodes.map(n=>({node_id:n.id,team:n.team})),championship_total:150},a);
 await db.db.query('update public.goat_bracket_config set main_lock_at=$1 where league_id=$2',[past,l.id]);await db.db.query('update public.goat_bracket_nodes set starts_at=$1 where league_id=$2',[past,l.id]);
 await command({op:'bracket_results_import',league_id:l.id,results:nodes.map(n=>({node_id:n.id,home_score:80,away_score:70,source_url:source}))});await command({op:'league_finalize',league_id:l.id});return l;
}
async function finishSeries(key){
 const l=await command({op:'game_draft_create',game_key:key,name:'ANNUAL SERIES SYNTHETIC FIXTURE',season:'2027'});
 const sports=key==='goat-crossover'?['NBA','NHL']:['MLB'];
 await command({op:'series_configure',league_id:l.id,policy:{approved:true,game_id:key,season:2027,source_reference:'SYNTHETIC TEST RULES ONLY',unresolved:[],missing_policy:'block',tie_policy:'shared_rank',points_by_sport:Object.fromEntries(sports.map(s=>[s,{Fixture:1}]))}});
 const events=[];for(const s of sports)events.push(await command({op:'series_event_create',league_id:l.id,code:s,sport:s,stage:1,round:'Fixture',lock_at:future,home_team:'FIXTURE H',away_team:'FIXTURE A',source_url:source}));
 await command({op:'series_open',league_id:l.id,reason:'TEST ONLY'});await approveEntries(l.id);
 for(const a of [members[0],members[2]])await command({op:'series_submit',league_id:l.id,picks:events.map(e=>({event_id:e.id,team:'FIXTURE H'}))},a);
 await db.db.query('update public.goat_series_events set lock_at=$1 where league_id=$2',[past,l.id]);
 await command({op:'series_results_import',league_id:l.id,results:events.map(e=>({event_id:e.id,winner:'FIXTURE H',source_url:source}))});await command({op:'series_finalize',league_id:l.id});return l;
}
async function finishFantasy(){
 const l=await command({op:'game_draft_create',game_key:'league-of-greatness',name:'ANNUAL FANTASY SYNTHETIC FIXTURE',season:'2027'});
 const t=[];for(let i=0;i<12;i++)t.push((await command({op:'fantasy_team_create',league_id:l.id,user_id:members[i],name:'FIXTURE TEAM '+i,franchise_key:'TEST-'+i,external_team_id:String(i),source_url:source})).id);
 const matchups=[];for(let w=1;w<=14;w++)for(let i=0;i<6;i++)matchups.push({week:w,home_id:t[2*i],away_id:t[2*i+1],starts_at:past,source_url:source});
 await command({op:'fantasy_schedule_import',league_id:l.id,matchups});await command({op:'fantasy_open',league_id:l.id,approved:true,source_reference:'SYNTHETIC VERIFIED EXPORT FOR TESTS ONLY'});
 const results=(await query({op:'league',league_id:l.id})).fantasy_matchups.map(m=>({matchup_id:m.id,home_score:100,away_score:90,source_includes_home_bonus:true,verified:true,source_url:source}));
 await command({op:'fantasy_results_import',league_id:l.id,results});await command({op:'fantasy_playoffs_seed',league_id:l.id,team_ids:t.slice(0,7),verified:true,source_url:source});
 for(const [week,pairs] of [[15,[[t[1],t[6]],[t[2],t[5]],[t[3],t[4]]]],[16,[[t[0],t[3]],[t[2],t[1]]]],[17,[[t[0],t[2]]]]]){
  await command({op:'fantasy_playoff_round',league_id:l.id,week,schedule:pairs.map(([home_id,away_id])=>({home_id,away_id,starts_at:past,source_url:source}))});
  for(const m of (await query({op:'league',league_id:l.id})).fantasy_matchups.filter(m=>m.week===week))await command({op:'fantasy_result',matchup_id:m.id,home_score:100,away_score:90,source_includes_home_bonus:true,verified:true,source_url:source});
 }
 await command({op:'fantasy_finalize',league_id:l.id});return l;
}

test('annual policy is empty by default and requires all five approved, sourced conversion tables',async()=>{
 championship=await command({op:'annual_create',name:'SYNTHETIC ANNUAL CHAMPIONSHIP',season:2027});
 const c=await query({op:'annual',championship_id:championship.id});assert.equal(c.policy,null);assert.equal(c.baas_awarded,false);
 await assert.rejects(query({op:'annual_standings',championship_id:c.id}),/baas_policy_approval_required/);
 await assert.rejects(query({op:'annual',championship_id:c.id},outsider),/championship_access_denied/);
 const p=policy();
 for(const bad of [{...p,approved:false},{...p,season:2028},{...p,tie_policy:'coin_flip'}, {...p,conversions:{...p.conversions,'goat-classic':[]}},
  {...p,conversions:{...p.conversions,'first-and-baa':[1,2]}},{...p,conversions:{...p.conversions,'goat-classic':[1.5]}}, {...p,conversions:{MLB:[1]}}])
  await assert.rejects(command({op:'annual_policy_set',championship_id:c.id,policy:bad}),/baas_policy_approval_required/);
 await command({op:'annual_policy_set',championship_id:c.id,policy:p});
 await assert.rejects(command({op:'annual_finalize',championship_id:c.id}),/annual_five_finished_games_required/);
});

test('five actual synthetic competition workflows finalize before certification and annual attachment',async()=>{
 leagues=[await finishNfl(),await finishBracket(),await finishSeries('goat-crossover'),await finishFantasy(),await finishSeries('goat-classic')];
 for(const [i,l] of leagues.entries()){
  assert.equal((await query({op:'league',league_id:l.id})).league.status,'final');
  await assert.rejects(command({op:'annual_competition_attach',championship_id:championship.id,league_id:l.id}),/certified_finishes_required/);
  const board=await query({op:'standings',league_id:l.id});
  const unranked=board.filter(r=>r.rank===null).map(r=>r.user_id).sort();
  const finishes=board.map(r=>({user_id:r.user_id,place:r.rank===null?unranked.indexOf(r.user_id)+3:Number(r.rank)}));
  if(i===0){
   await assert.rejects(command({op:'competition_finish_certify',league_id:l.id,finishes:finishes.map((f,j)=>j===0?{...f,place:2}:f),verified:true,source_url:source,source_reference:'TEST official order'}),/finish_conflicts_with_standings/);
   await assert.rejects(command({op:'competition_finish_certify',league_id:l.id,finishes,verified:true,source_url:source,source_reference:'TEST'},outsider),/commissioner_required/);
  }
  await command({op:'competition_finish_certify',league_id:l.id,finishes,verified:true,source_url:source,source_reference:'SYNTHETIC final places from fixture export, not seed order'});
  await command({op:'annual_competition_attach',championship_id:championship.id,league_id:l.id});
  await assert.rejects(command({op:'annual_competition_attach',championship_id:championship.id,league_id:l.id}),/annual_game_already_attached/);
 }
 const board=await query({op:'annual_standings',championship_id:championship.id},members[0]);
 assert.equal(board[0].user_id,members[0]);assert.equal(Number(board[0].baas),600);assert.equal(Number(board[0].competitions),5);
 assert.equal(board[1].user_id,members[2]);assert.equal(Number(board[1].baas),590);
 assert.deepEqual(board[0].breakdown.map(b=>b.game_key).sort(),keys.toSorted());
 await assert.rejects(command({op:'annual_policy_set',championship_id:championship.id,policy:policy()}),/annual_policy_frozen/);
 await command({op:'annual_finalize',championship_id:championship.id});
 const archived=await query({op:'annual',championship_id:championship.id},members[0]);assert.equal(archived.status,'final');assert.deepEqual(archived.final_snapshot,board);assert.equal(archived.baas_awarded,false);
 await assert.rejects(command({op:'annual_policy_set',championship_id:championship.id,policy:policy()}),/championship_final/);
});

// Separate commissioner leagues may legitimately have overlapping members.
// One annual championship, however, can attach only ONE certified finishing
// snapshot per official GOAT Game, preventing duplicated BAAS allocations.
// Two deliberately fabricated FINAL snapshots isolate that DB invariant.
test('two certified commissioner leagues of one GOAT Game cannot double award annual BAAS',async()=>{
 const c=await command({op:'annual_create',name:'SYNTHETIC DUPLICATE-GAME PROTECTION',season:2027});
 await command({op:'annual_policy_set',championship_id:c.id,policy:policy()});
 const member=members[0],fixtureFinishes=[{user_id:member,display_name:'ANNUAL TEST MEMBER',place:1,rank:1}];
 const leagueIds=[];
 for(let i=0;i<2;i++){
  const l=await command({op:'game_draft_create',game_key:'first-and-baa',name:'PRIVATE COMMISSIONER FIXTURE '+i,season:'2027'});
  await db.db.query("update public.goat_leagues set status='final' where id=$1",[l.id]);
  await db.db.query("insert into public.goat_entries(league_id,user_id,status) values($1,$2,'approved')",[l.id,member]);
  await db.db.query("insert into public.goat_finish_certifications(league_id,snapshot,source_url,source_reference,certified_by) values($1,$2::jsonb,$3,$4,$5)",[
    l.id,JSON.stringify(fixtureFinishes),source,'SYNTHETIC TEST CERTIFICATION ONLY',owner
  ]);
  leagueIds.push(l.id);
 }
 await command({op:'annual_competition_attach',championship_id:c.id,league_id:leagueIds[0]});
 const before=await query({op:'annual_standings',championship_id:c.id});
 assert.equal(before.length,1);
 assert.equal(Number(before[0].baas),120);
 assert.equal(Number(before[0].competitions),1);
 await assert.rejects(command({op:'annual_competition_attach',championship_id:c.id,league_id:leagueIds[1]}),
   /annual_game_already_attached/);
 const after=await query({op:'annual_standings',championship_id:c.id});
 assert.deepEqual(after,before,'failed second official attachment must roll back without changing BAAS');
 const recorded=await query({op:'annual',championship_id:c.id});
 assert.equal(recorded.competitions.length,1);
 assert.equal(recorded.competitions[0].league_id,leagueIds[0]);
 assert.equal(recorded.baas_awarded,false);
});

test('member dashboards represent five competitions; performance history and annual tables remain actor scoped',async()=>{
 const dashboard=await query({op:'competition_dashboard'},members[0]);assert.deepEqual(dashboard.competitions.map(g=>g.game_key).sort(),keys.toSorted());
 assert.ok(dashboard.competitions.every(g=>g.leagues.length===1&&g.leagues[0].finishes_certified));
 assert.ok((await query({op:'competition_dashboard'},outsider)).competitions.every(g=>g.leagues.length===0));
 const history=await query({op:'member_history',user_id:members[2]},members[0]);assert.equal(history.length,5);assert.ok(history.every(h=>h.finish.user_id===members[0]));
 await assert.rejects(command({op:'annual_competition_attach',championship_id:championship.id,league_id:leagues[0].id},outsider),/championship_owner_required/);
 const scoped=(fn)=>db.exclusive(()=>db.db.transaction(async tx=>{await tx.exec('set local role authenticated');await tx.query("select set_config('request.jwt.claim.sub',$1,true)",[outsider]);return fn(tx);}));
 assert.equal((await scoped(tx=>tx.query('select * from public.goat_championships'))).rows.length,0);
 assert.equal((await scoped(tx=>tx.query('select * from public.goat_championship_results'))).rows.length,0);
 await assert.rejects(scoped(tx=>tx.query('update public.goat_championships set policy=\'{}\'')),/permission denied/);
 await assert.rejects(scoped(tx=>tx.query('select public.goat_annual_standings($1)',[championship.id])),/permission denied/);
});
