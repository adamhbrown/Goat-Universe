import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {test} from 'node:test';

const read = path => readFileSync(new URL('../'+path, import.meta.url),'utf8');
const html = read('goatville-cinema.html');
const css = read('cinema/studio.css');
const source = read('cinema/studio.js');
const city = read('goatville-city.html');

test('cinema is linked from the GOATVILLE Culture District',()=>{
  assert.match(city,/href="goatville-cinema\.html"/);
  assert.match(html,/THE CINEMATIC SCREENING ROOM/);
  assert.match(html,/href="goatville-city\.html"/);
});
test('cinema is local-only, excludes network and browser persistence',()=>{
  assert.match(html,/default-src 'none'/);
  assert.match(html,/connect-src 'none'/);
  assert.match(html,/media-src blob: 'self'/);
  assert.match(html,/script-src 'self'/);
  assert.match(html,/src="cinema\/studio\.js"/);
  assert.doesNotMatch(source,/fetch\(|XMLHttpRequest|WebSocket|localStorage|sessionStorage|sendBeacon|navigator\.sendBeacon/);
  assert.doesNotMatch(html,/<form\b|action=|<iframe\b|autoplay|<script>(?!)/);
  assert.doesNotMatch(css,/@import|https?:\/\//);
});
test('cinema provides skip, pause, restart, silent default and no required upload',()=>{
  for(const id of ['screen-video','music','studio-music','video-file','audio-file','play','pause','restart','sound','clear','progress','timecode','feedback']){
    assert.match(html,new RegExp('id="'+id+'"'));
  }
  assert.match(html,/muted aria-label=/);
  assert.match(html,/href="goatville-city\.html" class="exit"/);
  assert.match(html,/aria-live="polite"/);
  assert.match(css,/prefers-reduced-motion:reduce/);
  assert.doesNotThrow(()=>new Function(source));
});
test('simulation: no play before local file selection, silent start, opt-in music, pause, restart and cleanup',async()=>{
  class Element {
    constructor(id=''){
      this.id=id;this.listeners={};this.attrs={};this.disabled=false;this.paused=true;this.ended=false;
      this.currentTime=0;this.duration=20;this.value='';this.files=[];this.style={};this.muted=true;
      const classes=new Set();this.classList={
        add:x=>classes.add(x),
        remove:x=>classes.delete(x),
        contains:x=>classes.has(x)
      };
    }
    addEventListener(event,fn){this.listeners[event]=fn;}
    setAttribute(name,value){this.attrs[name]=value;}
    removeAttribute(name){if(name==='src')this.src='';delete this.attrs[name];}
    emit(name){return this.listeners[name]?.();}
    click(){return this.emit('click');}
    load(){}
    play(){this.paused=false;this.ended=false;this.emit('play');return Promise.resolve();}
    pause(){this.paused=true;this.emit('pause');}
  }
  const ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(x=>x[1]);
  const elements=Object.fromEntries(ids.map(id=>[id,new Element(id)]));
  const doc={getElementById:id=>elements[id],querySelector:s=>s==='.stage-media'?new Element('stage'):null,hidden:false};
  const stage=doc.querySelector('.stage-media');
  doc.querySelector=()=>stage;
  doc.listeners={};doc.addEventListener=(name,fn)=>doc.listeners[name]=fn;
  const win={listeners:{},addEventListener(name,fn){this.listeners[name]=fn;}};
  const urls={created:[],revoked:[]};
  const url={createObjectURL(file){const u='blob:https://goat.example/'+file.name;urls.created.push(u);return u;},revokeObjectURL(u){urls.revoked.push(u);}};
  new Function('document','window','URL',source)(doc,win,url);
  const $=id=>elements[id];
  assert.equal($('play').disabled,true);
  assert.equal($('sound').attrs['aria-pressed'],'false');
  assert.equal(urls.created.length,0);
  $('video-file').files=[{name:'Entrance.mp4',type:'video/mp4'}];
  $('video-file').emit('change');
  assert.equal(urls.created.length,1);
  $('screen-video').emit('loadedmetadata');
  assert.equal($('play').disabled,false);
  assert.equal($('screen-video').muted,true);
  await $('play').click();
  assert.equal($('screen-video').paused,false);
  assert.equal($('studio-music').paused,true);
  $('audio-file').files=[{name:'Anthem.mp3',type:'audio/mpeg'}];
  $('audio-file').emit('change');
  assert.equal(urls.created.length,2);
  assert.equal($('screen-video').paused,true);
  await $('sound').click();
  assert.equal($('sound').attrs['aria-pressed'],'true');
  assert.equal($('screen-video').muted,true,'separate track replaces video audio');
  await $('play').click();
  assert.equal($('studio-music').paused,false);
  doc.listeners['goatverse:portal-open']();
  assert.equal($('studio-music').paused,true,'music stops behind the universe menu');
  assert.equal($('screen-video').paused,true,'video stops behind the universe menu');
  await $('play').click();
  assert.equal($('studio-music').paused,false);
  $('screen-video').currentTime=10;
  $('screen-video').emit('timeupdate');
  assert.equal($('progress').attrs['aria-valuenow'],'50');
  assert.equal($('timecode').textContent,'00:10');
  $('pause').click();
  assert.equal($('studio-music').paused,true);
  assert.equal($('screen-video').paused,true);
  $('restart').click();
  assert.equal($('screen-video').currentTime,0);
  $('clear').click();
  assert.equal($('play').disabled,true);
  assert.equal($('sound').attrs['aria-pressed'],'false');
  assert.equal(urls.revoked.length,2);
  assert.equal($('feedback').textContent.includes('Nothing was uploaded'),true);
  win.listeners.pagehide();
});
test('preview rejects non-media source and has a visible loading failure state',()=>{
  assert.match(source,/browser-supported/);
  assert.match(source,/could not decode this video/);
  assert.match(source,/could not open that media file/);
  assert.match(source,/Sound remains off/);
  assert.match(source,/visibilitychange/);
  assert.match(source,/pagehide/);
});
