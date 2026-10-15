import test from 'node:test';
import assert from 'node:assert/strict';
import {validatePredictionBatch,scoreVerifiedPredictions} from '../rules/prediction-engines.mjs';

const policy={game_id:'goat-classic',season:2028,approved:true,source_reference:'SYNTHETIC TEST POLICY ONLY',missing_policy:'block',tie_policy:'shared_rank',points_by_sport:{MLB:{Fixture:1}}};
const event={id:'fixture',sport:'MLB',round:'Fixture',options:['Fixture H','Fixture A'],locked_at:'2028-03-01T00:00:00Z',source_url:'https://fixture.invalid/schedule'};
const batch={game_id:'goat-classic',season:2028,policy,member_id:'fixture-member',events:[event],picks:[{event_id:event.id,selection:event.options[0]}],received_at:'2028-02-29T23:59:59Z'};
test('nonexistent calendar dates and normalized 24:00 deadlines never authorize a pick',()=>{
 for(const bad of ['2027-02-29T12:00:00Z','2028-02-30T12:00:00Z','2028-04-31T12:00:00Z','2028-02-29T24:00:00Z','2028-13-01T00:00:00Z']){
  assert.throws(()=>validatePredictionBatch({...batch,received_at:bad}),/goat_invalid_timestamp/);
  assert.throws(()=>validatePredictionBatch({...batch,events:[{...event,locked_at:bad}]}),/goat_invalid_timestamp/);
 }
 assert.equal(validatePredictionBatch(batch).picks.length,1);
 assert.equal(validatePredictionBatch({...batch,received_at:'2028-02-29T18:59:59-05:00'}).picks.length,1);
 assert.throws(()=>validatePredictionBatch({...batch,received_at:'2028-02-29T19:00:00-05:00'}),/goat_prediction_after_deadline/);
});
test('scoring and entry require a real HTTPS authority, no credentials or whitespace in evidence URLs',()=>{
 for(const bad of ['https://','https://@','https://user:password@fixture.invalid/result','https://fixture.invalid/with space','javascript:alert(1)']){
  assert.throws(()=>validatePredictionBatch({...batch,events:[{...event,source_url:bad}]}),/goat_entry_schedule_invalid/);
  assert.throws(()=>scoreVerifiedPredictions({game_id:batch.game_id,season:batch.season,policy,participants:['fixture-member'],events:[{...event,winner:'Fixture H',verified:true,evidence_url:bad,finalized_at:'2028-03-01T01:00:00Z'}],predictions:[{member_id:'fixture-member',event_id:'fixture',selection:'Fixture H',submitted_at:batch.received_at}]}),/goat_event_unverified/);
 }
});
