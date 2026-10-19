// BAAS lookup fixtures use founder-confirmed finish awards only. No live
// competition is created or any annual currency issued by this test.
import test from 'node:test';
import assert from 'node:assert/strict';
import {FIRST_AND_BAA_BAAS,FIRST_AND_BAA_FIELD_LIMIT,firstAndBaaBaasAtPlace}
  from '../rules/nfl-baas.mjs';
import {publicCatalog} from '../rules/goat-games.mjs';

test('1st & BAA preserves all twenty founder-specified finishing BAAS amounts',()=>{
 const exact=[100,90,80,70,65,60,55,50,45,40,35,30,25,20,15,10,5,0,0,0];
 assert.deepEqual(FIRST_AND_BAA_BAAS,exact);
 assert.equal(FIRST_AND_BAA_FIELD_LIMIT,20);
 assert.equal(Object.isFrozen(FIRST_AND_BAA_BAAS),true);
 exact.forEach((baas,i)=>assert.equal(firstAndBaaBaasAtPlace(i+1,20),baas));
 assert.equal(firstAndBaaBaasAtPlace(3,5),80);
 assert.equal(firstAndBaaBaasAtPlace(18,20),0);
 assert.equal(firstAndBaaBaasAtPlace(20,20),0);
 assert.equal(publicCatalog().official_annual_conversion_approved,false,
   'an NFL-only award curve does not approve the other four games or activate BAAS');
});

test('NFL BAAS finish awards enforce 20-entrant cap and verified placement bounds',()=>{
 for(const size of [0,-1,1.5,21,Infinity,NaN,null,'20',undefined]){
  assert.throws(()=>firstAndBaaBaasAtPlace(1,size),/nfl_baas_field_size_invalid/);
 }
 for(const place of [0,-2,2,2.5,21,Infinity,NaN,null,'1',undefined]){
  assert.throws(()=>firstAndBaaBaasAtPlace(place,1),/nfl_baas_finish_place_invalid/);
 }
 assert.equal(firstAndBaaBaasAtPlace(1,1),100);
 // Lookup does NOT choose a tie resolution or infer final finishing places.
});
