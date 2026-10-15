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
if(!valid){tokenHash=undefined;message('This link is invalid or uses an unsupported format. Request a new email link from the sign-in page.');}
else {$('confirm').hidden=type!=='signup';$('reset').hidden=type!=='recovery';message(type==='signup'?'Ready to confirm your email.':'Choose a new password of 12–200 characters.');}
for(const id of ['confirm','reset'])$(id).addEventListener('submit',async event=>{
 event.preventDefault();const f=event.currentTarget,b=f.querySelector('button');b.disabled=true;
 try{
  if(!tokenHash)throw new Error('Request a new email link.');
  const body={token_hash:tokenHash};
  if(id==='reset'){
   if(f.elements.new_password.value!==f.elements.repeat_password.value)throw new Error('The new passwords do not match.');
   body.new_password=f.elements.new_password.value;
  }
  const response=await fetch('/auth/'+(id==='confirm'?'confirm':'reset'),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),credentials:'omit'});
  const result=await response.json();if(!response.ok)throw new Error((result.error||'request_failed').replaceAll('_',' '));
  tokenHash=undefined;f.hidden=true;message(id==='confirm'?'Email confirmed. Return to sign in.':'Password reset. Existing sessions were revoked. Return to sign in.');
 }catch(error){message(error.message);}
 finally{if(id==='reset'){f.elements.new_password.value='';f.elements.repeat_password.value='';}b.disabled=false;}
});
