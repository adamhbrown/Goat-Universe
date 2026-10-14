// Email-template links put the one-time hash in the fragment, avoiding gateway
// query logs. Legacy token_hash queries are scrubbed too. Never accept or store
// an implicit-flow access/refresh token, arbitrary redirect, or caller identity.
const params=new URLSearchParams(location.hash.slice(1)||location.search.slice(1));
let tokenHash=params.get('token_hash');
const type=params.get('type');
const valid=typeof tokenHash==='string'&&/^[a-zA-Z0-9_-]{16,512}$/.test(tokenHash)&&['signup','recovery'].includes(type)&&!params.has('access_token')&&!params.has('refresh_token');
params.delete('token_hash');params.delete('access_token');params.delete('refresh_token');
history.replaceState(null,'','/auth/callback');
const $=id=>document.getElementById(id),message=text=>{$('message').textContent=text;};
let generation=0;
if(typeof window!=='undefined')window.addEventListener('pagehide',()=>{
 generation++;tokenHash=undefined;
 for(const id of ['confirm','reset'])$(id).hidden=true;
 $('reset').elements.new_password.value='';$('reset').elements.repeat_password.value='';
 message('This page was closed. Request a new email link from the sign-in page.');
});
if(!valid){tokenHash=undefined;message('This link is invalid or uses an unsupported format. Request a new email link from the sign-in page.');}
else {$('confirm').hidden=type!=='signup';$('reset').hidden=type!=='recovery';message(type==='signup'?'Ready to confirm your email.':'Choose a new password of 12–200 characters.');}
for(const id of ['confirm','reset'])$(id).addEventListener('submit',async event=>{
 event.preventDefault();const f=event.currentTarget,b=f.querySelector('button');
 if(b.disabled||f.hidden)return;
 b.disabled=true;f.setAttribute('aria-busy','true');const started=generation;
 try{
  if(!tokenHash)throw new Error('Request a new email link.');
  const body={token_hash:tokenHash};
  if(id==='reset'){
   if(f.elements.new_password.value!==f.elements.repeat_password.value)throw new Error('The new passwords do not match.');
   body.new_password=f.elements.new_password.value;
  }
  const response=await fetch('/auth/'+(id==='confirm'?'confirm':'reset'),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),credentials:'omit',signal:AbortSignal.timeout(15000)});
  const result=await response.json();if(started!==generation)return;
  if(!response.ok)throw new Error((result.error||'request_failed').replaceAll('_',' '));
  tokenHash=undefined;f.hidden=true;message(id==='confirm'?'Email confirmed. Return to sign in.':'Password reset. Existing sessions were revoked. Return to sign in.');
 }catch(error){if(started===generation)message(error.message);}
 finally{if(id==='reset'){f.elements.new_password.value='';f.elements.repeat_password.value='';}b.disabled=false;f.setAttribute('aria-busy','false');}
});
