const assert=require('node:assert/strict');const {test}=require('node:test');const E=require('../assets/resort-engine.js');
test('a round draws exactly one valid question from each of six sports',()=>{
 for(const value of [0,.1,.42,.8,.999]){const round=E.createRound(()=>value);assert.equal(round.deck.length,6);assert.equal(new Set(round.deck.map(q=>q.sport)).size,6);assert.equal(new Set(round.deck.map(q=>q.id)).size,6);assert.equal(round.answers.length,0);assert.equal(round.complete,false);}
 assert.equal(E.questions.length,24);for(const q of E.questions){assert.equal(q.options.length,4);assert.ok(q.answer>=0&&q.answer<4);assert.ok(q.explanation.length>20);}
});
test('different random draws change the round while retaining six-sport coverage',()=>{
 assert.notDeepEqual(E.createRound(()=>.1).deck.map(q=>q.id),E.createRound(()=>.8).deck.map(q=>q.id));
});
test('an answer locks immediately and cannot be replaced or double-counted',()=>{
 const round=E.createRound(()=>.42);assert.equal(E.advance(round),false);assert.equal(E.answer(round,9),false);assert.equal(E.answer(round,'1'),false);assert.equal(E.answer(round,-2),false);
 assert.equal(E.answer(round,round.deck[0].answer),true);assert.equal(E.answer(round,0),false);assert.equal(E.score(round),1);assert.equal(E.advance(round),true);assert.equal(round.index,1);assert.equal(E.advance(round),false);
});
test('a full round resolves only after six answers and cannot advance beyond its result',()=>{
 const round=E.createRound(()=>.5);round.deck.forEach(q=>{assert.equal(E.answer(round,q.answer),true);assert.equal(E.advance(round),true);});assert.equal(round.complete,true);assert.equal(E.score(round),6);assert.equal(E.answer(round,0),false);assert.equal(E.advance(round),false);assert.equal(round.index,5);
});
test('passes and incorrect answers count honestly and a fresh round starts at zero',()=>{
 const round=E.createRound(()=>.3);round.deck.forEach((q,i)=>{E.answer(round,i===0?q.answer:i===1?-1:(q.answer+1)%4);E.advance(round);});assert.equal(E.score(round),1);assert.equal(round.answers[1],-1);assert.equal(E.score(E.createRound()),0);
});
test('six discovery stops have distinct catalog IDs and clues with a valid answer',()=>{
 const P=require('../assets/guest-passport.js');assert.equal(E.districts.length,6);assert.deepEqual(E.districts.map(d=>d.id),P.districts);
 for(const d of E.districts){assert.equal(d.options.length,3);assert.ok(d.options[d.answer]);assert.ok(d.clue.length>25);assert.ok(d.x>0&&d.x<100&&d.y>0&&d.y<100);}
 assert.match(E.districts.find(d=>d.id==='goat-island').status,/WORLD PREVIEW/);assert.match(E.districts.find(d=>d.id==='mountain-lodge').copy,/no skiing attraction yet/);
});
