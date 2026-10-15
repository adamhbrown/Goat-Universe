// GOATVILLE Spotlight Circuit — five fictional practice scenarios.
// An opaque sandbox, a reviewed entry catalog and a parent-issued session are mandatory.
(()=>{
'use strict';
const CHANNEL='goatville.guest.v1',ID='spotlight-circuit',VERSION=1;
const scenarios=Object.freeze([
 {sport:'football',label:'FOOTBALL / 1st & BAA',title:'FOURTH DOWN. THE STADIUM GOES SILENT.',
  description:'Fictional playoff game, tied, fourth-and-two at midfield, 90 seconds left. What is your coaching approach?',
  options:[
   {label:'TRUST THE OFFENSE',note:'You choose aggression and keep control of the drive, accepting the field-position risk.'},
   {label:'PLAY THE FIELD-POSITION GAME',note:'You put faith in your defense and the clock, trading opportunity for a safer field position.'}
  ]},
 {sport:'hoops',label:'BASKETBALL / HORNS & HOOPS',title:'THE BRACKET IS ONE SHOT FROM CHAOS.',
  description:'Fictional tournament. Your team trails by two with six seconds remaining. You have one timeout. Your call?',
  options:[
   {label:'ATTACK THE RIM',note:'You choose the high-percentage two-point attempt and a chance to force overtime.'},
   {label:'DESIGN THE WINNING THREE',note:'You take the lower-percentage but higher-upside shot at a regulation victory.'}
  ]},
 {sport:'crossover',label:'HOCKEY × BASKETBALL / GOAT CROSSOVER',title:'TWO SPORTS. ONE CHAMPIONSHIP MINDSET.',
  description:'You manage a fictional crossover prediction card. Which strategy will you take for the final two series?',
  options:[
   {label:'VALUE CONSISTENT SERIES PROFILES',note:'You prioritize stable matchup evidence in both sports and accept fewer bold upset calls.'},
   {label:'HUNT THE DIFFERENCE-MAKING UPSETS',note:'You prioritize calculated contrarian picks across both sports and accept greater variance.'}
  ]},
 {sport:'fantasy',label:'FANTASY / LEAGUE OF GREATNESS',title:'YOUR FLEX DECISION COULD DEFINE THE WEEK.',
  description:'Choose between two fictional roster archetypes: a stable-volume receiver and a high-upside running back.',
  options:[
   {label:'START THE HIGH-FLOOR RECEIVER',note:'You favor touches and predictability, which may make sense in a closely projected matchup.'},
   {label:'START THE HIGH-VARIANCE RUNNING BACK',note:'You embrace volatility for a possible big performance, particularly when trailing.'}
  ]},
 {sport:'baseball',label:'BASEBALL / THE GOAT CLASSIC',title:'OCTOBER. EVERY INNING MATTERS.',
  description:'Fictional best-of-seven series. You must make a winner-and-length prediction. Which philosophy leads your card?',
  options:[
   {label:'BACK THE DEEPER ROSTER IN SIX',note:'You trust depth over a longer sample while leaving room for one difficult game.'},
   {label:'BACK THE ACE TO FINISH IT IN FIVE',note:'You bet on top-end starting talent to shorten the series, accepting bullpen uncertainty.'}
  ]}
]);
const $=id=>document.getElementById(id);
let config=null,step=0,selected=-1,finished=false;
function render(){
 const scene=scenarios[step];
 $('stage').textContent='ARENA '+(step+1)+' / '+scenarios.length;
 document.body.dataset.sport=scene.sport;
 $('sport-label').textContent=scene.label;
 $('scenario').textContent=scene.title;
 $('description').textContent=scene.description;
 [...document.querySelectorAll('.lights span')].forEach((x,i)=>x.classList.toggle('on',i<=step));
 const choices=$('choices');
 choices.replaceChildren();
 selected=-1;
 for(let i=0;i<scene.options.length;i++){
  const option=scene.options[i],button=document.createElement('button');
  button.type='button';button.textContent=option.label;button.setAttribute('aria-pressed','false');
  button.addEventListener('click',()=>{
   if(finished)return;
   selected=i;
   [...choices.children].forEach((b,j)=>b.setAttribute('aria-pressed',String(j===i)));
   $('feedback').textContent=option.note;
   $('advance').disabled=false;
  });
  choices.append(button);
 }
 $('feedback').textContent='There is no guaranteed right play. Choose your strategy and own your decision.';
 $('advance').disabled=true;
 $('advance').textContent=step===scenarios.length-1?'COMPLETE THE CIRCUIT →':'NEXT ARENA →';
 if(step>0)$('scenario').focus();
}
function complete(){
 if(finished||!config)return;
 finished=true;
 $('stage').textContent='ALL FIVE ARENAS COMPLETED';
 $('sport-label').textContent='YOUR GOATVILLE DEBUT';
 $('scenario').textContent='FIVE GAMES. ONE UNIVERSE.';
 $('description').textContent='You made five pressure decisions across the sports universe. Keep playing. Keep learning. Keep showing up.';
 $('choices').replaceChildren();
 $('feedback').textContent='The Circuit is complete. Your souvenir stamp is unverified and does not grant official points, prizes, or rankings.';
 $('advance').disabled=true;
 $('advance').textContent='CIRCUIT COMPLETE';
 parent.postMessage({channel:CHANNEL,session:config.session,attraction:ID,version:VERSION,
  sequence:1,type:'achievement',achievement:'spotlight-clear'},config.parentOrigin);
 $('scenario').focus();
}
$('advance').addEventListener('click',()=>{
 if(!config||finished||selected<0)return;
 if(step===scenarios.length-1)complete();
 else{step++;render();}
});
window.addEventListener('message',event=>{
 if(config||event.source!==parent||typeof event.origin!=='string'||!/^https?:\/\//.test(event.origin))return;
 const data=event.data;
 if(!data||typeof data!=='object'||Array.isArray(data)||
   Object.keys(data).length!==6||data.channel!==CHANNEL||data.type!=='init'||
   data.attraction!==ID||data.version!==VERSION||typeof data.reducedMotion!=='boolean'||
   typeof data.session!=='string'||!/^[a-f0-9]{32}$/.test(data.session))return;
 config=Object.freeze({session:data.session,parentOrigin:event.origin});
 render();
});
})();