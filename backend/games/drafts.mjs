// Selection drafts are private, tab-local memory. They never use Web Storage,
// browser URLs or background requests, and are cleared at account boundaries.
export function selectionDrafts(document){
 const saved=new Map(),bindings=new WeakMap();let revision=0;
 function capture(form){
  const b=bindings.get(form);if(!b||!b.current()||b.restoring)return null;
  const values=Object.fromEntries(b.fields.map(s=>[s.name,s.type==='checkbox'?form.elements[s.name].checked:form.elements[s.name].value]));
  const previous=saved.get(b.key);
  if(!previous||JSON.stringify(previous.values)!==JSON.stringify(values)){
   saved.delete(b.key);saved.set(b.key,{values,revision:++revision});
   if(saved.size>100)saved.delete(saved.keys().next().value);
  }
  return {key:b.key,revision:saved.get(b.key).revision};
 }
 return {
  bind(form,{scope,label,fields,current,discard}){
   if(!fields.some(s=>/^(side_|weight_|pick_|team_)/.test(s.name))&&label!=='Save qualifying pick')return;
   const qualifier=label==='Save qualifying pick'?JSON.stringify(fields[0].options):'';
   const key=JSON.stringify([scope,label,fields.every(s=>s.name.startsWith('team_'))?'series':fields.map(s=>s.name),qualifier]);
   bindings.set(form,{key,fields,current,discard,restoring:false});
   const changed=()=>queueMicrotask(()=>capture(form));form.addEventListener('input',changed);form.addEventListener('change',changed);
  },
  capture,
  acknowledge(ticket){if(ticket&&saved.get(ticket.key)?.revision===ticket.revision)saved.delete(ticket.key);},
  pending(ticket){return Boolean(ticket&&saved.has(ticket.key));},
  restore(panel){
   for(const form of panel.querySelectorAll('form')){
    const b=bindings.get(form),draft=b&&saved.get(b.key);if(!draft||!b.current())continue;
    b.restoring=true;
    try{for(const s of b.fields){if(!Object.hasOwn(draft.values,s.name))continue;const input=form.elements[s.name];
     if(s.type==='checkbox')input.checked=draft.values[s.name];else input.value=draft.values[s.name];
     input.dispatchEvent(new document.defaultView.Event('change',{bubbles:true}));
    }}finally{b.restoring=false;}
    const notice=document.createElement('p');notice.className='draft-notice';notice.setAttribute('role','status');notice.textContent='Unsaved selections restored in this tab. They have not been submitted. Review your choices before saving.';
    const discard=document.createElement('button');discard.type='button';discard.className='secondary';discard.textContent='Discard unsaved selections';
    discard.addEventListener('click',()=>{if(!b.current()||discard.disabled)return;discard.disabled=true;saved.delete(b.key);Promise.resolve().then(()=>b.discard()).catch(()=>{discard.disabled=false;});});
    form.append(notice,discard);
   }
  },
  clear(){saved.clear();}
 };
}
