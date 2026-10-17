// Reviewed guest-only attraction catalog. No arbitrary visitor-provided game URLs.
// Every addition requires code review, dedicated CSP and integration tests.
import {validateAttraction} from './protocol.mjs';

const entries=Object.freeze({
  'field-vision':Object.freeze({
    spec:Object.freeze({id:'field-vision',version:1,title:'GOATVILLE Field Vision strategy drill',achievements:Object.freeze(['field-vision-clear'])}),
    path:'./guest/field-vision.html'
  }),
  'spotlight-circuit':Object.freeze({
    spec:Object.freeze({id:'spotlight-circuit',version:1,title:'GOATVILLE Spotlight Circuit',achievements:Object.freeze(['spotlight-clear'])}),
    path:'./guest/spotlight-circuit.html'
  })
});
export function getReviewedAttraction(id){
  if(typeof id!=='string'||!Object.hasOwn(entries,id))throw new Error('unreviewed_game');
  return entries[id];
}
export function resolveReviewedGuestEntry({attraction,entryURL,windowImpl}){
  const spec=validateAttraction(attraction);
  const reviewed=getReviewedAttraction(spec.id);
  const v=reviewed.spec;
  if(v.version!==spec.version||v.title!==spec.title||
     v.achievements.length!==spec.achievements.length||
     !v.achievements.every((id,index)=>spec.achievements[index]===id))throw new Error('unreviewed_game');
  const expected=new URL(reviewed.path,windowImpl.location.href);
  const entry=new URL(entryURL,windowImpl.location.href);
  if(!['http:','https:'].includes(entry.protocol)||entry.origin!==windowImpl.location.origin||
     entry.username||entry.password||entry.search||entry.hash||entry.href!==expected.href)
     throw new Error('invalid_game_entry');
  return Object.freeze({spec:v,entry:expected});
}
