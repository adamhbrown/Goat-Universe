// GOATVILLE Field Vision — a fictional, sandboxed guest-only decision drill.
// External classic script is intentional: opaque sandbox frames avoid same-origin modules.
(()=>{
'use strict';
const spec=Object.freeze({channel:'goatville.guest.v1',attraction:'field-vision',version:1,achievement:'field-vision-clear'});
const scenarios=Object.freeze([
 {title:'FOURTH DOWN. EVERYTHING ON THE LINE.',
  prompt:'A fictional championship is tied with 90 seconds left. Fourth-and-two near midfield. What does your sideline call?',
  options:[
   {label:'TRUST THE OFFENSE',effect:'Aggressive call. You take control of your fate and accept the risk of giving the opponent field position.'},
   {label:'WIN WITH FIELD POSITION',effect:'Calculated call. You choose your defense and the clock over an immediate high-risk conversion.'}
  ]},
 {title:'THE RED ZONE. NO TIME TO WASTE.',
  prompt:'Your fictional team trails by four with 28 seconds left at the opponent’s eight-yard line. One timeout remains. Which approach?',
  options:[
   {label:'ATTACK THE SIDELINE',effect:'You preserve clock flexibility and target space before the boundary closes.'},
   {label:'ATTACK THE MIDDLE',effect:'You attack the defense’s soft spot, counting on the remaining timeout if the receiver stays inbounds.'}
  ]},
 {title:'CLOSING TIME. DEFEND THE LEAD.',
  prompt:'Up three. Twenty seconds remain. Your opponent has the ball at its own 39-yard line. What is your defensive priority?',
  options:[
   {label:'PROTECT THE DEEP BALL',effect:'You make the offense earn its way forward with shorter gains and force the clock to work for you.'},
   {label:'BRING IMMEDIATE PRESSURE',effect:'You aim to end the drive at the quarterback, accepting risk against a quick deep throw.'}
  ]}
]);
const $=id=>document.getElementById(id);
let initialized=false,config=null,position=0,selected=-1,complete=false;
function render(){
 if(!initialized)return;
 selected=-1;
 const s=scenarios[position];
 $('round').textContent='DECISION '+(position+1)+' / '+scenarios.length;
 $('scenario').textContent=s.title;
 $('description').textContent=s.prompt;
 const root=$('choices');root.replaceChildren();
 s.options.forEach((option,index)=>{
  const button=document.createElement('button');
  button.type='button';button.textContent=option.label;button.setAttribute('aria-pressed','false');
  button.addEventListener('click',()=>{
   if(complete)return;
   selected=index;root.querySelectorAll('button').forEach((b,i)=>b.setAttribute('aria-pressed',String(i===index)));
   $('feedback').textContent=option.effect;
   $('next').disabled=false;
  });
  root.append(button);
 });
 $('next').disabled=true;
 $('next').textContent=position===scenarios.length-1?'COMPLETE PRACTICE →':'NEXT DECISION →';
 $('feedback').textContent='There is no single guaranteed play. Choose your approach and own the decision.';
 if(position>0)$('scenario').focus();
}
function finish(){
 if(complete||!config)return;
 complete=true;
 $('round').textContent='PRACTICE COMPLETE';
 $('scenario').textContent='YOU MADE THE CALL.';
 $('description').textContent='Three pressure situations. Three deliberate choices. Greatness starts with the courage to make a decision.';
 $('choices').replaceChildren();
 $('feedback').textContent='You completed Field Vision. Any guest souvenir is local and unverified; no official GOAT Games score was recorded.';
 $('next').disabled=true;
 $('next').textContent='SESSION COMPLETE';
 parent.postMessage({
  channel:spec.channel,session:config.session,attraction:spec.attraction,version:spec.version,
  sequence:1,type:'achievement',achievement:spec.achievement
 },config.parentOrigin);
 $('scenario').focus();
}
$('next').addEventListener('click',()=>{
 if(!initialized||complete||selected<0)return;
 if(position+1===scenarios.length){finish();return;}
 position++;render();
});
addEventListener('message',event=>{
 // The sandbox has an opaque origin, so location.origin may serialize as 'null'.
 // The loaded resource URL still identifies the reviewed HTTP(S) site. Require
 // that exact parent origin and send completions to the authenticated sender.
 const resource=new URL(location.href);
 if(initialized||event.source!==parent||!['https:','http:'].includes(resource.protocol)||
    event.origin!==resource.origin)return;
 const m=event.data;
 if(!m||typeof m!=='object'||Array.isArray(m)||Object.keys(m).length!==6||
 m.channel!==spec.channel||m.type!=='init'||m.attraction!==spec.attraction||
 m.version!==spec.version||typeof m.reducedMotion!=='boolean'||
 typeof m.session!=='string'||!/^[a-f0-9]{32}$/.test(m.session))return;
 config=Object.freeze({session:m.session,parentOrigin:event.origin});
 initialized=true;render();
});
})();