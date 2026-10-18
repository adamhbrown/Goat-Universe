/* GOAT UNIVERSE — Shared immersive navigation.
   Pure static page enhancement: no network, no tracking, no storage, no audio. */
(()=>{
  'use strict';
  if(document.getElementById('gv-portal-dialog'))return;
  // Only four primary choices; rankings, legacy entry points and attractions are secondary.
  const pages=Object.freeze([
    {path:'goatville-city.html',index:'01',title:'GOATVILLE',desc:'Enter the city and explore its destinations.',kind:'DISCOVER'},
    {path:'/games',index:'02',title:'GAMES',desc:'Five official competition workspaces. Development access only.',kind:'COMPETE'},
    {path:'goatville-cinema.html',index:'03',title:'MEDIA',desc:'Explore the cinema and sports storytelling experience.',kind:'WATCH'},
    {path:'/manage',index:'04',title:'MY LEAGUE',desc:'Your account and connected competition access.',kind:'ACCOUNT'},
    {path:'gpi.html',index:'05',title:'GOAT POWER INDEX',desc:'Personal, Block, County, State, Region and Global standings. No invented results.',kind:'RANKINGS'},
    {path:'goatville-stadium.html',index:'06',title:'THE STADIUM',desc:'Make your way from the city into the arena.',kind:'EXPLORE'},
    {path:'arrival-experience.html',index:'07',title:'THE ARRIVAL',desc:'Return to the premium GOAT Universe entrance.',kind:'ENTER'},
    {path:'index.html',index:'08',title:'THE ORIGINAL WORLD',desc:'Explore the preserved GOAT Universe homepage.',kind:'ARCHIVE'},
    {path:'resort.html',index:'09',title:'THE RESORT',desc:'The resort district and guest experiences.',kind:'EXPLORE'},
    {path:'goatville.html',index:'10',title:'GOATVILLE ATTRACTIONS',desc:'Explore additional districts and activities.',kind:'EXPLORE'},
    {path:'play.html',index:'11',title:'SPORTS ROOMS',desc:'Optional practice experiences. Not official results.',kind:'PRACTICE'},
    {path:'goat-games-play-lab.html',index:'12',title:'PRACTICE ARCADE',desc:'Try optional fictional sports challenges.',kind:'PRACTICE'},
    {path:'goatville-spotlight.html',index:'13',title:'SPOTLIGHT CIRCUIT',desc:'An optional guest skill challenge.',kind:'PRACTICE'},
    {path:'goatville-field-vision.html',index:'14',title:'FIELD VISION',desc:'An optional football decision room.',kind:'PRACTICE'},
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
  const intro=make('p','gv-subtitle','One universe. Four clear destinations. Explore rankings, the stadium and guest attractions when you want more.');
  intro.id='gv-portal-description';
  shell.append(heading,intro);

  const grid=make('nav','gv-navigation');
  grid.setAttribute('aria-label','Four primary GOAT Universe destinations');
  for(const item of pages.slice(0,4)){
    const card=make('a','gv-destination');
    card.href=item.path;
    if(item.path===current||item.path==='/'+current)card.setAttribute('aria-current','page');
    const topLine=make('div','gv-entry-top');
    topLine.append(make('span','',item.index+' / '+item.kind),make('span','gv-entry-arrow','↗'));
    const bottom=make('div');
    bottom.append(make('div','gv-entry-title',item.title),make('p','gv-entry-description',item.desc));
    card.append(topLine,bottom);
    grid.append(card);
  }
  shell.append(grid);
  const extras=make('details','gv-secondary');
  const summary=make('summary','','GPI, Stadium & more destinations');
  extras.append(summary);
  const additional=make('nav','gv-navigation gv-additional');
  additional.setAttribute('aria-label','Rankings, stadium and optional attractions');
  for(const item of pages.slice(4)){
    const card=make('a','gv-destination');
    card.href=item.path;
    if(item.path===current||item.path==='/'+current)card.setAttribute('aria-current','page');
    const topLine=make('div','gv-entry-top');
    topLine.append(make('span','',item.index+' / '+item.kind),make('span','gv-entry-arrow','↗'));
    const bottom=make('div');
    bottom.append(make('div','gv-entry-title',item.title),make('p','gv-entry-description',item.desc));
    card.append(topLine,bottom);
    additional.append(card);
  }
  extras.append(additional);
  shell.append(extras);
  const banner=make('div','gv-route-highlight');
  banner.append(make('strong','','THE WORLD IS IN DEVELOPMENT'),make('span','','One connected local application: guest attractions and authenticated development league tools. No public contest, payments, verified guest awards or production launch is activated.'));
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
