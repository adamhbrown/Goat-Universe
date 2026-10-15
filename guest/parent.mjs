import {mountGuestGame} from './host.mjs';
import {createGuestJournal} from './protocol.mjs';

// Approved catalog entry only. Do not accept arbitrary visitor-supplied game URLs.
const spec=Object.freeze({id:'field-vision',version:1,title:'GOATVILLE Field Vision strategy drill',achievements:['field-vision-clear']});
const entry=new URL('./field-vision.html',import.meta.url);
const $=id=>document.getElementById(id);
let journal=createGuestJournal();
let game=null;

function announce(message){$('status').textContent=message;}
function showStamps(){
  const list=$('stamps');list.replaceChildren();
  const saved=journal.list();
  if(!saved.length){
    const li=document.createElement('li');li.className='empty-stamp';li.textContent='No souvenir stamps yet.';
    list.append(li);return;
  }
  for(const stamp of saved){
    const li=document.createElement('li');
    li.textContent='FIELD VISION COMPLETED · Unverified guest souvenir';
    li.setAttribute('data-verification',stamp.verification);
    list.append(li);
  }
}
function stop({returnFocus=true}={}){
  if(game){game.destroy();game=null;}
  $('game').replaceChildren();
  const empty=document.createElement('div');empty.className='empty';
  const strong=document.createElement('strong');strong.textContent='THE FIELD IS WAITING.';
  const sub=document.createElement('span');sub.textContent='Start another round whenever you are ready.';
  empty.append(strong,sub);$('game').append(empty);
  $('stop').disabled=true;
  if(returnFocus)$('start').focus();
}
$('start').addEventListener('click',()=>{
  stop({returnFocus:false});
  try{
    game=mountGuestGame({container:$('game'),attraction:spec,entryURL:entry,onAchievement(stamp){
      const result=journal.record(stamp);
      showStamps();
      announce(result.persisted?'Practice completed. Unverified souvenir saved on this device.':'Practice completed. Unverified souvenir held in memory only.');
    }});
    $('stop').disabled=false;
    game.frame.addEventListener('load',()=>game?.frame.focus(),{once:true});
    announce('Field Vision started in an isolated guest frame. Use Tab and Enter to play, or close the attraction.');
  }catch{
    stop({returnFocus:false});
    announce('This challenge cannot run in this preview. Please open it from an HTTPS site or local server.');
  }
});
$('stop').addEventListener('click',()=>{stop();announce('Attraction closed. Focus returned to Start.');});
$('persist').addEventListener('change',()=>{
  const current=journal.list();
  if($('persist').checked){
    let storage;
    try{storage=window.localStorage;if(!storage)throw Error('unavailable');}catch{
      $('persist').checked=false;announce('Device storage is unavailable. Your souvenirs remain in memory.');return;
    }
    journal=createGuestJournal({storage,persist:true});
    let stored=true;
    for(const stamp of current)stored=journal.record(stamp).persisted&&stored;
    showStamps();
    announce(!stored&&current.length?'Device storage is unavailable; your souvenirs remain in memory.':'Optional device saving is enabled for this visit. Souvenirs remain unverified.');
  }else{
    const previous=journal.list();
    let cleared=false;
    try{cleared=journal.clear();}catch{}
    journal=createGuestJournal();
    for(const item of previous)journal.record(item);
    showStamps();
    announce(cleared?'Device saving stopped and saved copy cleared. Stamps remain in memory.':'Device saving stopped. Your memory-only stamps remain; previous saved copy could not be verified as cleared.');
  }
});
$('clear').addEventListener('click',()=>{
  let cleared=false;
  try{cleared=journal.clear();}catch{}
  showStamps();
  announce(cleared?'Unverified souvenirs cleared.':'Memory souvenirs cleared. Browser storage access is unavailable.');
});
window.addEventListener('pagehide',()=>game?.destroy());
showStamps();