/* GOAT UNIVERSE — Shared immersive navigation.
   Pure static page enhancement: no network, no tracking, no storage, no audio. */
(()=>{
  'use strict';
  if(document.getElementById('gv-portal-dialog'))return;
  const pages=Object.freeze([
    {path:'index.html',index:'00',title:'GOAT UNIVERSE ARRIVAL',desc:'The cinematic entrance and optional founder theme.',kind:'ENTER'},
    {path:'goatville-city.html',index:'01',title:'GOATVILLE CITY',desc:'Corporate headquarters and seven connected districts.',kind:'EXPLORE'},
    {path:'/games',index:'02',title:'GOAT GAMES · LEAGUE WORKSPACE',desc:'Five distinct competitions. Local registration, saved drafts and commissioner tools; official launch pending.',kind:'COMPETE'},
    {path:'/manage',index:'03',title:'MEMBER ACCOUNT',desc:'Register and manage your local account. Paid membership and email remain off.',kind:'ACCOUNT'},
    {path:'goatville-stadium.html',index:'04',title:'THE STADIUM',desc:'Discover the five competition identities and Downtown Sports Nation.',kind:'DISCOVER'},
    {path:'play.html',index:'05',title:'SPORTS PRACTICE ROOMS',desc:'Five fictional sports practice experiences. Scores stay separate from league results.',kind:'PRACTICE'},
    {path:'goat-games-play-lab.html',index:'06',title:'FIVE-SPORT PRACTICE LAB',desc:'Try the mechanics with fictional scenarios. Open the League Workspace for competitions.',kind:'PRACTICE'},
    {path:'resort.html',index:'07',title:'THE RESORT',desc:'The resort circuit, Sports IQ, golf and guest keepsakes.',kind:'EXPLORE'},
    {path:'goatville.html',index:'08',title:'GOATVILLE PLAYGROUND',desc:'Meet the city, try arcade challenges and discover the passport.',kind:'PLAY'},
    {path:'goatville-spotlight.html',index:'09',title:'SPOTLIGHT CIRCUIT',desc:'Five sports. Five strategy decisions. One guest challenge.',kind:'PLAY'},
    {path:'goatville-field-vision.html',index:'10',title:'FIELD VISION',desc:'Take control of the fictional football decision room.',kind:'PLAY'},
    {path:'goatville-cinema.html',index:'11',title:'THE CINEMATIC STUDIO',desc:'Rehearse Goatville video and music with private local files.',kind:'WATCH'},
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
  banner.append(make('strong','','THE WORLD IS IN DEVELOPMENT'),make('span','','One connected local application: guest attractions and authenticated development league tools. No public contest, payments, verified guest awards or production launch is activated.'));
  shell.append(banner);
  const foot=make('div','gv-menu-bottom');
  foot.append(make('span','','GOATVERSE HOLDINGS INC. · GOAT Universe · Goatville'),make('b','','CAN’T STOP THE BAA.'));
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
    document.dispatchEvent(new CustomEvent('goatverse:portal-open'));
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
