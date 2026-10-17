import {formatGST} from '../../experience/gst-time.js';
export function serverClock(serverTime,elapsedNow){
 const base=Date.parse(serverTime),started=elapsedNow();let elapsed=0;
 return ()=>{elapsed=Math.max(elapsed,elapsedNow()-started,0);return base+elapsed;};
}
function remainingText(seconds){
 const days=Math.floor(seconds/86400),hours=Math.floor(seconds%86400/3600),minutes=Math.floor(seconds%3600/60),rest=seconds%60;
 if(days)return days+'d '+hours+'h';if(hours)return hours+'h '+minutes+'m';if(minutes)return minutes+'m '+rest+'s';return rest+'s';
}
export function deadlineGuard({document,form,deadline,items,now,current,schedule,cancel}){
 const submit=form.querySelector('button[type=submit]'),status=document.createElement('p');
 status.className='deadline-status';status.setAttribute('role','timer');status.setAttribute('aria-live','off');
 form.append(status);let timer,locked=false,stopped=false;
 const cutoff=Date.parse(deadline),closedItems=new Set();
 function update(){
  if(stopped)return locked;
  if(!current()){stop();return locked;}
  const time=now();let left=cutoff-time;
  if(items){const upcoming=[];for(const [name,expires]of Object.entries(items)){
   const remaining=Date.parse(expires)-time;if(!Number.isFinite(remaining)||remaining<=0)closedItems.add(name);
   const input=form.elements[name];if(closedItems.has(name)){input.disabled=true;input.setAttribute('aria-label',input.closest('label').firstChild.textContent+' · Locked');}else upcoming.push(remaining);
  }left=upcoming.length?Math.min(...upcoming):0;}
  locked=locked||!Number.isFinite(left)||left<=0;
  if(locked){submit.disabled=true;status.setAttribute('role','status');status.setAttribute('aria-live','polite');status.textContent=Number.isFinite(left)?'Selections locked. Unsaved edits were not submitted.':'Deadline unavailable. Refresh the competition before submitting.';if(timer)cancel(timer);}
  else status.textContent=(items?'Next series closes in ':'Closes in ')+remainingText(Math.ceil(left/1000))+(items?' · '+closedItems.size+' locked':' · '+formatGST(cutoff));
  return locked;
 }
 function tick(){if(!update()&&!stopped)timer=schedule(tick,1000);}
 function stop(){stopped=true;if(timer)cancel(timer);}
 tick();return {update,stop,submit};
}
