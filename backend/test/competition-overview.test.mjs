import test from 'node:test';
import assert from 'node:assert/strict';
import {setupProgress} from '../games/overview.mjs';
import {readFile} from 'node:fs/promises';

const fixture=game_key=>({league:{game_key,rules:{approved:false,unresolved:['Official approval pending']}}});
test('setup observations keep all five games distinct and never turn an empty draft into approval',()=>{
 for(const key of ['first-and-baa','horns-and-hoops','goat-crossover','league-of-greatness','goat-classic']){const checks=setupProgress(fixture(key));assert.ok(checks.length>=3);assert.ok(checks.every(c=>!c.complete));assert.match(checks.at(-1).detail,/approval pending/);}
 const cross=fixture('goat-crossover');cross.series_events=[{sport:'NBA'}];assert.equal(setupProgress(cross)[0].complete,false);cross.series_events.push({sport:'NHL'});assert.equal(setupProgress(cross)[0].complete,true);assert.equal(setupProgress(cross)[1].complete,false);
});
test('NFL saved setup counts use the documented 13-game, 61-point architecture',async()=>{
 const profile=JSON.parse(await readFile(new URL('../rules/nfl-playoffs-61.json',import.meta.url),'utf8')),data=fixture('first-and-baa');
 data.rounds=profile.round_templates.map((r,i)=>({...r,id:'R'+i}));data.games=data.rounds.flatMap(r=>r.weights.map((_,i)=>({id:r.id+'G'+i,round_id:r.id})));
 assert.ok(setupProgress(data).slice(0,3).every(c=>c.complete));assert.equal(setupProgress(data).at(-1).complete,false);data.games.pop();assert.equal(setupProgress(data)[1].complete,false);
});
test('a bracket with 63 rows in the wrong stages and an 84-row fantasy schedule with duplicate franchises stay incomplete',()=>{
 const bracket=fixture('horns-and-hoops');bracket.bracket_nodes=Array(63).fill({stage:1});assert.equal(setupProgress(bracket)[1].complete,false);
 const fantasy=fixture('league-of-greatness');fantasy.fantasy_teams=Array.from({length:12},(_,i)=>({id:'T'+i}));fantasy.fantasy_matchups=Array.from({length:84},(_,i)=>({week:Math.floor(i/6)+1,home_id:'T0',away_id:'T1'}));assert.equal(setupProgress(fantasy)[1].complete,false);
});
