/* GOAT UNIVERSE — Shared immersive navigation.
   Pure static page enhancement: no network, no tracking, no storage, no audio. */
(()=>{
  'use strict';
  if(document.getElementById('gv-portal-dialog'))return;
  const pages=Object.freeze([
    {path:'goatville-city.html',index:'01',title:'GOATVILLE CITY',desc:'Enter the city. Explore seven connected districts.',kind:'EXPLORE'},
    {path:'goat-games-play-lab.html',index:'02',title:'THE FIVE GOAT GAMES',desc:'Five sports. Five different interactive practice experiences.',kind:'PLAY'},
    {path:'goatville.html',index:'03',title:'GOATVILLE PLAYGROUND',desc:'Meet the city, try arcade challenges and discover the passport.',kind:'PLAY'},
    {path:'goatville-spotlight.html',index:'04',title:'SPOTLIGHT CIRCUIT',desc:'Five sports. Five strategy decisions. One guest challenge.',kind:'PLAY'},
    {path:'goatville-field-vision.html',index:'05',title:'FIELD VISION',desc:'Take control of the fictional football decision room.',kind:'PLAY'},
    {path:'goatville-cinema.html',index:'06',title:'THE CINEMATIC STUDIO',desc:'Rehearse GOATVILLE video and music with private local files.',kind:'WATCH'},
    {path:'index.html',index:'07',title:'GOAT UNIVERSE',desc:'Discover the GOAT Games, stories and bigger vision.',kind:'DISCOVER'}
  ]);
  const current=location.pathname.split('/').pop()||'index.html';
  const make=(tag,classes,text)=>{
    const node=document.createElement(tag);
    if(classes)node.className=classes;
    if(text!==undefined)node.textContent=text;
    return node;
  };
  const trigger=make('button','','');
  trigger.id='gv-portal-launch';
  trigger.type='button';
  trigger.setAttribute('aria-haspopup','dialog');
  trigger.setAttribute('aria-controls','gv-portal-dialog');
  trigger.setAttribute('aria-expanded','false');
  trigger.setAttribute('aria-label','Explore the GOAT Universe destinations');
  trigger.append(make('span','gv-launch-label','EXPLORE UNIVERSE'),make('span','gv-launch-icon','↗'));

  const dialog=make('dialog');dialog.id='gv-portal-dialog';
  dialog.setAttribute('aria-labelledby','gv-portal-title');
  dialog.setAttribute('aria-describedby','gv-portal-description');
  const shell=make('div','gv-shell');
  const top=make('div','gv-menu-top');
  const brand=make('div','gv-wordmark');
  brand.append(document.createTextNode('GOAT '),make('strong','','UNIVERSE'));
  const close=make('button','gv-close','CLOSE ✕');
  close.type='button';close.setAttribute('aria-label','Close universe destinations');
  top.append(brand,close);
  shell.append(top,make('div','gv-eyebrow','WELCOME TO THE GOAT UNIVERSE / WHERE THE GOATS PLAY'));

  const heading=make('h2','gv-h1');heading.id='gv-portal-title';
  heading.append(document.createTextNode('EVERY GOAT HAS '),make('em','','A PLACE.'));
  const intro=make('p','gv-subtitle','Enter the city. Choose your arena. Explore original sports, stories, music and entertainment—all under one universe.');
  intro.id='gv-portal-description';
  shell.append(heading,intro);

  const grid=make('nav','gv-navigation');
  grid.setAttribute('aria-label','GOAT Universe destinations');
  for(const item of pages){
    const card=make('a','gv-destination');
    card.href=item.path;
    if(item.path===current)card.setAttribute('aria-current','page');
    const topLine=make('div','gv-entry-top');
    topLine.append(make('span','',item.index+' / '+item.kind),make('span','gv-entry-arrow','↗'));
    const bottom=make('div');
    bottom.append(make('div','gv-entry-title',item.title),make('p','gv-entry-description',item.desc));
    card.append(topLine,bottom);
    grid.append(card);
  }
  shell.append(grid);
  const banner=make('div','gv-route-highlight');
  banner.append(make('strong','','THE WORLD IS IN DEVELOPMENT'),make('span','','Explore working guest demos and creative previews. No official GOAT Games entries, championships, memberships or purchases are activated here.'));
  shell.append(banner);
  const foot=make('div','gv-menu-bottom');
  foot.append(make('span','','YOU DON’T JUST WATCH THE STORY. YOU ENTER IT.'),make('b','','CAN’T STOP THE BAA.'));
  shell.append(foot);
  dialog.append(shell);

  const progress=make('div');progress.id='gv-experience-progress';
  progress.setAttribute('aria-hidden','true');

  document.body.append(trigger,dialog,progress);
  const open=()=>{
    if(typeof dialog.showModal!=='function'){
      location.href='goatville-city.html';
      return;
    }
    if(dialog.open)return;
    dialog.showModal();
    trigger.setAttribute('aria-expanded','true');
    close.focus();
  };
  trigger.addEventListener('click',open);
  close.addEventListener('click',()=>dialog.close());
  dialog.addEventListener('close',()=>{
    trigger.setAttribute('aria-expanded','false');
    trigger.focus({preventScroll:true});
  });
  // Native <dialog> already handles Escape and inert background.
  dialog.addEventListener('click',event=>{
    if(event.target===dialog)dialog.close();
  });
  let scheduled=false;
  function updateProgress(){
    scheduled=false;
    const max=document.documentElement.scrollHeight-window.innerHeight;
    const percentage=max>0?Math.min(100,Math.max(0,window.scrollY/max*100)):0;
    progress.style.width=percentage.toFixed(1)+'%';
  }
  const schedule=()=>{
    if(scheduled)return;
    scheduled=true;
    if(typeof window.requestAnimationFrame==='function')window.requestAnimationFrame(updateProgress);
    else updateProgress();
  };
  window.addEventListener('scroll',schedule,{passive:true});
  window.addEventListener('resize',schedule);
  schedule();
})();
