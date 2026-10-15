/* GOATVILLE Atlas — accessible editorial map.
   Only a client-side view of the seven existing fictional districts.
   No analytics, user data, tracking, network, or official competition state. */
(()=>{
  'use strict';
  const points=Object.freeze([
    {id:'athletic',number:'01',title:'THE ATHLETIC DISTRICT',status:'PLAYABLE DEMOS',
     description:'Enter the GOAT Stadium experience through five sports practice challenges, Spotlight Circuit, and Field Vision. Fictional practice only.'},
    {id:'campus',number:'02',title:'GOAT UNIVERSITY',status:'IN DEVELOPMENT',
     description:'The planned home of GOAT Academy, training experiences, skills and creative learning. This is a digital concept, not a physical campus.'},
    {id:'culture',number:'03',title:'THE CULTURE DISTRICT',status:'PRIVATE CREATIVE PREVIEW',
     description:'Rehearse video and music inside the Cinematic Screening Room, or discover original media in GOATverse Publications.'},
    {id:'legends',number:'04',title:'THE LEGENDS DISTRICT',status:'IN DEVELOPMENT',
     description:'The future Hall of Fame and Vault: a home for verified histories, franchise stories, and competition legacies.'},
    {id:'market',number:'05',title:'GOATVILLE MARKET',status:'PLANNED / NO CHECKOUT',
     description:'The future marketplace for original GOAT apparel and collectibles. No products or payment checkout are offered in this preview.'},
    {id:'commons',number:'06',title:'GOATVILLE COMMONS',status:'IN DEVELOPMENT',
     description:'A planned community destination for fans, creators and competitors to discover each other and share experiences.'},
    {id:'afterdark',number:'07',title:'GOATVILLE AFTER DARK',status:'IN DEVELOPMENT',
     description:'Future nightlife-themed digital entertainment, original music and live events built for an adult audience.'}
  ]);
  const buttons=[...document.querySelectorAll('[data-map-point]')];
  const ids=new Map(points.map(p=>[p.id,p]));
  const $=id=>document.getElementById(id);
  const title=$('map-detail-title'),status=$('map-detail-status'),
    detail=$('map-detail-description'),route=$('map-detail-route'),
    counter=$('map-detail-number');
  if(!buttons.length||!title||!status||!detail||!route||!counter)return;
  let selected='athletic';
  function select(id,{focus=false}={}){
    const target=ids.get(id);
    if(!target)return;
    selected=id;
    title.textContent=target.title;
    status.textContent=target.status;
    detail.textContent=target.description;
    counter.textContent=target.number+' / 07';
    route.href='#district-'+target.id;
    route.setAttribute('aria-label','Explore '+target.title+' details');
    for(const button of buttons){
      const active=button.dataset.mapPoint===id;
      button.setAttribute('aria-pressed',String(active));
      button.tabIndex=active?0:-1;
      if(active&&focus)button.focus();
    }
  }
  for(const button of buttons){
    button.addEventListener('click',()=>select(button.dataset.mapPoint));
    button.addEventListener('keydown',event=>{
      const index=buttons.indexOf(button);
      let next=index;
      if(event.key==='ArrowRight'||event.key==='ArrowDown')next=(index+1)%buttons.length;
      else if(event.key==='ArrowLeft'||event.key==='ArrowUp')next=(index+buttons.length-1)%buttons.length;
      else if(event.key==='Home')next=0;
      else if(event.key==='End')next=buttons.length-1;
      else return;
      event.preventDefault();
      select(buttons[next].dataset.mapPoint,{focus:true});
    });
  }
  route.addEventListener('click',()=>{
    const all=document.querySelector('[data-filter="all"]');
    if(all&&all.getAttribute('aria-pressed')!=='true')all.click();
    // Let the native anchor navigate to the real district card.
  });
  select(selected);
})();