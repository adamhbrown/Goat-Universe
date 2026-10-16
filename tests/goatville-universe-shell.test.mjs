import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {test} from 'node:test';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const shell=read('experience/universe-shell.js');
const style=read('experience/universe-shell.css');
const pages=['index.html','goatville.html','goatville-city.html','goat-games-play-lab.html','goatville-cinema.html','goatville-field-vision.html','goatville-spotlight.html'];

test('shared experience navigation is included on all seven parent pages',()=>{
  for(const name of pages){
    const html=read(name);
    assert.match(html,/href="experience\/universe-shell\.css"/,name);
    assert.match(html,/src="experience\/universe-shell\.js"/,name);
    assert.equal((html.match(/href="experience\/universe-shell\.css"/g)||[]).length,1,name);
    assert.equal((html.match(/src="experience\/universe-shell\.js"/g)||[]).length,1,name);
  }
});
test('navigation links resolve to real checked-in destinations',()=>{
  for(const name of pages)assert.ok(shell.includes("path:'"+name+"'"),name);
  assert.equal((shell.match(/\{path:'[^']+',index:'/g)||[]).length,12);
  const links=[...shell.matchAll(/\{path:'([^']+)',index:/g)].map(m=>m[1]);
  assert.equal(links.length,new Set(links).size);
  assert.doesNotMatch(shell,/target\s*=\s*['"]_blank/);
});
test('cinematic overlay is screen-reader accessible, skippable and has no autoplay',()=>{
  for(const token of ['showModal()','dialog.close()','aria-labelledby','aria-describedby',
    'aria-current','aria-label','aria-expanded','aria-haspopup']){
    assert.ok(shell.includes(token),token);
  }
  assert.match(shell,/aria-label','Close universe destinations'/);
  assert.match(style,/#gv-portal-dialog::backdrop/);
  assert.match(style,/prefers-reduced-motion:reduce/);
  assert.match(style,/@media\(max-width:560px\)/);
  assert.match(shell,/location.href='goatville-city.html'/);
});
test('shared shell does not store user data, load remote code or read official scores',()=>{
  assert.doesNotMatch(shell,/fetch\(|XMLHttpRequest|WebSocket|localStorage|sessionStorage|navigator\.sendBeacon|<iframe|AudioContext|\\.play\(/);
  assert.doesNotMatch(style,/@import|https?:\/\//);
  assert.doesNotThrow(()=>new Function(shell));
});
test('guest shells accept the first-party stylesheet and JS under their CSP',()=>{
  for(const name of ['goatville-cinema.html','goatville-spotlight.html','goatville-field-vision.html']){
    const html=read(name);
    assert.match(html,/style-src 'self'/);
    assert.match(html,/script-src 'self'/);
    assert.match(html,/default-src 'none'/);
  }
});
test('open and close preserve focus, accurate route state, and scroll progress',()=>{
  class Node{
    constructor(tag='div'){
      this.tag=tag;this.id='';this.className='';this.attributes={};
      this.listeners={};this.children=[];this.textContent='';this.style={};
      this.open=false;this.focused=false;this.href='';this.type='';
    }
    setAttribute(key,value){this.attributes[key]=value;}
    getAttribute(key){return this.attributes[key];}
    addEventListener(event,handler){this.listeners[event]=handler;}
    append(...children){this.children.push(...children);}
    focus(){this.focused=true;}
    showModal(){this.open=true;}
    close(){this.open=false;this.listeners.close?.();}
    click(){this.listeners.click?.({target:this});}
  }
  const body=new Node('body');
  const raised=[];
  const doc={body,dispatchEvent:event=>{raised.push(event.type);},
    createElement:tag=>new Node(tag),
    createTextNode:value=>({textContent:value}),
    getElementById:id=>{
      const search=node=>node?.id===id?node:node?.children?.map(search).find(Boolean);
      return search(body)||null;
    },
    documentElement:{scrollHeight:2100}
  };
  const navEvents={};
  const win={innerHeight:800,scrollY:650,
    addEventListener:(name,cb)=>navEvents[name]=cb,
    requestAnimationFrame:fn=>fn()
  };
  const loc={pathname:'/goatville-city.html',href:''};
  new Function('document','window','location','CustomEvent',shell)(doc,win,loc,class CustomEvent{constructor(type){this.type=type;}});
  const get=id=>doc.getElementById(id);
  const toggle=get('gv-portal-launch'),modal=get('gv-portal-dialog'),progress=get('gv-experience-progress');
  assert.ok(toggle);
  assert.ok(modal);
  assert.equal(modal.open,false);
  toggle.click();
  assert.equal(modal.open,true);
  assert.deepEqual(raised,['goatverse:portal-open']);
  assert.equal(toggle.attributes['aria-expanded'],'true');
  const find=(node,p)=>p(node)?node:node.children?.map(x=>find(x,p)).find(Boolean);
  const close=find(modal,n=>n?.className==='gv-close');
  assert.ok(close.focused);
  const cards=[];
  const traverse=node=>{if(node?.className==='gv-destination')cards.push(node);for(const child of node.children||[])traverse(child);};
  traverse(modal);
  assert.equal(cards.length,12);
  assert.equal(cards.filter(n=>n.attributes['aria-current']==='page').length,1);
  assert.equal(cards.find(n=>n.attributes['aria-current']==='page').href,'goatville-city.html');
  close.click();
  assert.equal(modal.open,false);
  assert.equal(toggle.focused,true);
  assert.equal(toggle.attributes['aria-expanded'],'false');
  assert.equal(progress.style.width,'50.0%');
  win.scrollY=0;navEvents.scroll();
  assert.equal(progress.style.width,'0.0%');
});
