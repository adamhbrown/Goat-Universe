const assert=require('node:assert/strict');
const {test}=require('node:test');
const P=require('../assets/guest-passport.js');
function storage(){const values=new Map();return {getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,value),removeItem:key=>values.delete(key),values};}
test('memory play, identity and clear never acquire storage before opt-in',()=>{
 let accesses=0;const journal=P.createJournal(()=>{accesses++;throw Error('No permission');});
 journal.stamp('gridiron');journal.setFranchise('Night Shift');journal.remember(false);assert.equal(journal.count(),1);journal.clear();
 assert.equal(accesses,0);assert.equal(journal.count(),0);assert.equal(journal.state().franchise,'Gold Standard');
});
test('saved souvenirs require a new opt-in on every page and merge with current play',()=>{
 const disk=storage(),first=P.createJournal(()=>disk);first.stamp('town-square');first.setFranchise('Summit Club');first.remember(true);
 const second=P.createJournal(()=>disk);assert.equal(second.count(),0);assert.equal(second.state().remembering,false);second.stamp('hoops');second.remember(true);
 assert.equal(second.count(),2);assert.equal(second.state().franchise,'Summit Club');assert.deepEqual(new Set(second.snapshot().stamps),new Set(['town-square','hoops']));
 const stored=JSON.parse(disk.values.get(P.storageKey));assert.equal(stored.verification,'local-unverified');assert.equal(stored.version,2);
});
test('a franchise chosen before restoration takes precedence over the saved identity',()=>{
 const disk=storage(),first=P.createJournal(()=>disk);first.setFranchise('Summit Club');first.remember(true);
 const second=P.createJournal(()=>disk);second.setFranchise('Night Shift');second.remember(true);assert.equal(second.state().franchise,'Night Shift');
});
test('only declared souvenirs can enter the bounded journal; duplicates do not grow it',()=>{
 const journal=P.createJournal();for(const id of P.catalog){assert.equal(journal.stamp(id),true);journal.stamp(id);}
 assert.equal(journal.count(),12);assert.equal(journal.stamp('BAAS'),false);assert.equal(journal.stamp('score'),false);assert.equal(journal.stamp('<script>'),false);
 assert.equal(journal.count(P.sports),5);assert.equal(journal.count(P.districts),6);assert.equal(journal.setFranchise('CEO <script>'),false);
});
test('unknown fields, authority claims, duplicates, malformed schemas and oversized data are rejected',()=>{
 const good={version:2,verification:'local-unverified',stamps:['gridiron'],franchise:'Gold Standard'};
 const bad=[{...good,score:100},{...good,verification:'official'},{...good,stamps:['gridiron','gridiron']},{...good,stamps:['official-champion']},{...good,version:1},{...good,franchise:'Unknown'},[],null,'{not json}', 'x'.repeat(4097)];
 for(const value of bad){const disk=storage();disk.setItem(P.storageKey,typeof value==='string'?value:JSON.stringify(value));const journal=P.createJournal(()=>disk);journal.remember(true);assert.equal(journal.count(),0);assert.equal(journal.state().available,false);journal.stamp('classic');assert.equal(journal.count(),1);}
 assert.equal(P.validate(good),true);
});
test('storage denial and quota exhaustion preserve playable memory state',()=>{
 const blocked=P.createJournal(()=>{throw new DOMException('Blocked','SecurityError');});blocked.remember(true);blocked.stamp('club-goat');assert.equal(blocked.count(),1);assert.equal(blocked.state().available,false);
 const full=P.createJournal(()=>({getItem:()=>null,setItem:()=>{throw Error('Quota');},removeItem:()=>{}}));full.remember(true);full.stamp('sports-iq');assert.equal(full.has('sports-iq'),true);assert.equal(full.state().available,false);
});
test('opt-out deletes the opted-in saved record but keeps this page’s memory souvenirs',()=>{
 const disk=storage(),journal=P.createJournal(()=>disk);journal.stamp('classic');journal.remember(true);journal.remember(false);
 assert.equal(disk.getItem(P.storageKey),null);assert.equal(journal.count(),1);assert.equal(journal.state().remembering,false);journal.stamp('hoops');assert.equal(disk.getItem(P.storageKey),null);
});
test('clear deletes opted-in records, resets identity and stops further persistence',()=>{
 const disk=storage(),journal=P.createJournal(()=>disk);journal.remember(true);journal.stamp('classic');journal.setFranchise('Night Shift');journal.clear();journal.stamp('gridiron');
 assert.equal(disk.getItem(P.storageKey),null);assert.equal(journal.count(),1);assert.equal(journal.state().franchise,'Gold Standard');assert.equal(journal.state().remembering,false);
});
test('snapshots and subscriber state cannot mutate the journal and unsubscribe works',()=>{
 const journal=P.createJournal();let calls=0;const unsubscribe=journal.subscribe(state=>{calls++;state.stamps.push('classic');});journal.stamp('hoops');assert.equal(journal.has('classic'),false);const snap=journal.snapshot();snap.stamps.push('gridiron');assert.equal(journal.has('gridiron'),false);unsubscribe();journal.stamp('crossover');assert.equal(calls,1);
});
