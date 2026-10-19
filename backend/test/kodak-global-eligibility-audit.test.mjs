import test from 'node:test';
import assert from 'node:assert/strict';
import {auditApprovedEntryCollisions} from '../games/eligibility-audit.mjs';
import {auditFiveGameCandidate} from '../games/release-gates.mjs';

const league=(id,game_key,season,entries)=>({
  league:{id,game_key,season,rules:{approved:false,unresolved:['test pending']}},
  entries
});
const approved=user_id=>({user_id,status:'approved'});
const pending=user_id=>({user_id,status:'pending'});

test('same member approved in two commissioner leagues of same game and season is flagged without identifiers',()=>{
  const snapshots=[
    league('league-A','goat-crossover',2027,[approved('private-user@example.invalid')]),
    league('league-B','goat-crossover',2027,[approved('private-user@example.invalid')])
  ];
  const before=JSON.stringify(snapshots);
  const audit=auditApprovedEntryCollisions(snapshots);
  assert.equal(audit.duplicate_game_season_entry_groups,1);
  assert.equal(audit.conflicts_by_game['goat-crossover'],1);
  assert.equal(audit.approved_entries_inspected,2);
  assert.equal(audit.absence_of_collisions_certified,false);
  assert.equal(JSON.stringify(snapshots),before);
  assert.doesNotMatch(JSON.stringify(audit),/private-user|example.invalid|league-A|league-B/);
  assert.equal(Object.isFrozen(audit),true);
  assert.equal(Object.isFrozen(audit.conflicts_by_game),true);
  const report=auditFiveGameCandidate(snapshots);
  assert.equal(report.status,'blocked');
  assert.equal(report.can_launch,false);
  assert.ok(report.games.find(g=>g.game_key==='goat-crossover').issues.includes('eligibility_policy_review_required'));
  assert.equal(report.member_eligibility_audit.duplicate_game_season_entry_groups,1);
});

test('one approved membership across different GOAT Games or seasons does not create a collision',()=>{
  const snapshots=[
    league('league-A','first-and-baa',2027,[approved('member-1')]),
    league('league-B','horns-and-hoops',2027,[approved('member-1')]),
    league('league-C','first-and-baa',2028,[approved('member-1')]),
    league('league-D','goat-classic',2027,[pending('member-1')])
  ];
  const audit=auditApprovedEntryCollisions(snapshots);
  assert.equal(audit.duplicate_game_season_entry_groups,0);
  assert.equal(audit.approved_entries_inspected,3);
  assert.equal(audit.incomplete_entry_records,0);
  assert.equal(audit.absence_of_collisions_certified,false,'a partial audit never certifies uniqueness of real people');
});

test('repeated snapshots of same league do not count as separate league enrollment',()=>{
 const audit=auditApprovedEntryCollisions([
   league('same','goat-classic',2027,[approved('member-1')]),
   league('same','goat-classic',2027,[approved('member-1')])
 ]);
 assert.equal(audit.duplicate_game_season_entry_groups,0);
});

test('incomplete records cannot silently certify clear membership data',()=>{
 const audit=auditApprovedEntryCollisions([
   league('known','league-of-greatness',2027,[approved('member-1')]),
   league('unknown','league-of-greatness',2027,[{status:'approved'}]),
   league('empty','goat-classic',2027,null),
   null
 ]);
 assert.equal(audit.incomplete_entry_records,3);
 assert.equal(audit.absence_of_collisions_certified,false);
 for(const input of [null,{},Array(1001).fill({})])
   assert.throws(()=>auditApprovedEntryCollisions(input),/invalid_entry_audit_input/);
});

test('duplicate memberships remain a review question until the founder approves a policy',()=>{
  const snapshots=[
    league('A','goat-classic',2027,[approved('member-1')]),
    league('B','goat-classic',2027,[approved('member-1')])
  ];
  const unresolved=auditFiveGameCandidate(snapshots);
  assert.equal(unresolved.eligibility_policy_reviewed,false);
  assert.equal(unresolved.eligibility_policy_mode,'not_decided');
  assert.equal(unresolved.games.find(g=>g.game_key==='goat-classic').issues.includes('eligibility_policy_review_required'),true);
  assert.equal(unresolved.games.find(g=>g.game_key==='goat-classic').issues.includes('duplicate_approved_game_season_entry'),false);
  for(const invalidPolicy of [
    {mode:'one_league_per_game_season',approved:false,source_reference:'Fixture review'},
    {mode:'allow_multiple_leagues',approved:true,source_reference:' '},
    {mode:'make_up_a_rule',approved:true,source_reference:'Fixture review'},
    null
  ]) assert.throws(()=>auditFiveGameCandidate(snapshots,{eligibilityPolicy:invalidPolicy}),/eligibility_policy_approval_required/);
  const exclusive=auditFiveGameCandidate(snapshots,{eligibilityPolicy:{
    mode:'one_league_per_game_season',approved:true,source_reference:'SYNTHETIC TEST REVIEW, NOT FOUNDER AUTHORIZATION'
  }});
  assert.equal(exclusive.eligibility_policy_reviewed,true);
  assert.equal(exclusive.games.find(g=>g.game_key==='goat-classic').issues.includes('duplicate_approved_game_season_entry'),true);
  const multiple=auditFiveGameCandidate(snapshots,{eligibilityPolicy:{
    mode:'allow_multiple_leagues',approved:true,source_reference:'SYNTHETIC TEST REVIEW, NOT FOUNDER AUTHORIZATION'
  }});
  assert.equal(multiple.eligibility_policy_mode,'allow_multiple_leagues');
  assert.equal(multiple.games.find(g=>g.game_key==='goat-classic').issues.includes('eligibility_policy_review_required'),false);
  // Duplicate selected event snapshots still have their own separate reason
  // to be rejected in a single five-game release candidate.
  assert.equal(multiple.games.find(g=>g.game_key==='goat-classic').issues.includes('duplicate_competition_snapshot'),true);
});

test('absent membership collections do not masquerade as verified zero entries',()=>{
  const r=auditApprovedEntryCollisions([
    league('A','first-and-baa',2027,[]),
    league('B','horns-and-hoops',2027,undefined),
    league('C','goat-classic',2027,[null,{status:'invalid'},pending('member-1')])
  ]);
  assert.equal(r.inspected_league_snapshots,3);
  assert.equal(r.incomplete_entry_records,3);
  assert.equal(r.approved_entries_inspected,0);
  assert.equal(r.absence_of_collisions_certified,false);
});
