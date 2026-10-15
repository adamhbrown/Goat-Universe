/* GOATVILLE console. Only reviewed bundled data; all progress remains recreational. */
(() => {
  'use strict';
  const E=globalThis.GoatResort, P=globalThis.GoatPassport, journal=globalThis.goatGuestJournal;
  if(!E||!P||!journal)return;
  const root=document.getElementById('resort-content'), announcement=document.getElementById('resort-announcement');
  const esc=value=>String(value).replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const sports=[['gridiron','1st & BAA','Four football calls'],['hoops','Horns & Hoops','Build your bracket'],['crossover','GOAT Crossover','Court meets ice'],['greatness','League of Greatness','Your fantasy clubhouse'],['classic','The GOAT Classic','Write your October']];
  let route='explore',selected=E.districts[0],round=null;
  const clueAnswers=new Map();
  document.getElementById('resort-fallback').hidden=true;
  const announce=message=>{announcement.textContent=message;};
  function icon(name,className='district-symbol'){
    const drawings={square:'<path d="M10 55h60M20 55V30h40v25M15 30l25-18 25 18M33 55V40h14v15M40 12V4m0 0 15 5-15 5"/>',crown:'<path d="m12 24 14 10 14-20 14 20 14-10-7 31H19ZM20 62h40M25 46h30"/><circle cx="40" cy="13" r="3"/>',flag:'<path d="M40 60V12l26 13-26 10M14 64c0-8 52-8 52 0s-52 8-52 0Z"/><circle cx="25" cy="53" r="3"/>',disc:'<circle cx="40" cy="40" r="30"/><circle cx="40" cy="40" r="8"/><path d="M17 34a24 24 0 0 1 23-18m23 30a24 24 0 0 1-23 18M25 37a16 16 0 0 1 15-13m15 19a16 16 0 0 1-15 13"/>',island:'<path d="M10 62c15-10 45-10 60 0M38 55l8-32m0 0c-14-15-25-4-25-4s14-2 25 4Zm0 0c8-20 23-9 23-9S54 14 46 23Zm0 0c-3-14 9-18 9-18M13 70q9-5 18 0t18 0 18 0"/>',mountain:'<path d="m5 63 27-44 15 22 10-14 18 36ZM21 37l11-18 15 22-13-7-6 6m21-2 8-11 10 19-10-7"/>'};
    return `<svg class="${className}" viewBox="0 0 80 80" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">${drawings[name]||drawings.crown}</svg>`;
  }
  function circuitBar(){
    const count=journal.count(P.districts),next=E.districts.find(d=>!journal.has(d.id));
    return `<section class="circuit-bar" aria-labelledby="circuit-title"><div><p class="eyebrow">THE GOATVILLE NIGHT CIRCUIT</p><h2 id="circuit-title">${count===6?'Six stops. Your own GOATVILLE story.':'Six stops. Six clues. Make the town yours.'}</h2><p>${count===6?'Discovery complete. These are local-unverified keepsakes, with no official award or reward.':'Read each district’s clue. Make the call. Collect six discovery stamps. No timer.'}</p><div class="circuit-progress" role="img" aria-label="${count} of 6 discovery stops complete">${P.districts.map(id=>`<i class="${journal.has(id)?'on':''}"></i>`).join('')}</div></div><span class="circuit-number">${count}<small> / 6</small></span>${next?`<button type="button" class="secondary" data-action="district" data-district="${next.id}">${count?'Next discovery':'Start the circuit'} <span aria-hidden="true">↗</span></button>`:'<a class="secondary" href="#passport">Open your passport ↗</a>'}</section>`;
  }
  function districtAction(d){
    if(d.id==='town-square')return '<div class="district-actions"><a class="primary" href="#sports-iq">Take the Sports IQ challenge <span aria-hidden="true">↗</span></a></div>';
    if(d.id==='championship-district')return `<div class="game-routes">${sports.map(([id,name,description])=>`<a href="play.html#${id}"><strong>${esc(name)}</strong><span>${description} ↗</span></a>`).join('')}</div>`;
    if(d.id==='tee-district')return '<div class="district-actions"><a class="primary" href="index.html#goat-tee">Play GOAT TEE <span aria-hidden="true">↗</span></a></div>';
    if(d.id==='club-goat')return '<div class="district-actions"><button type="button" class="primary" data-action="open-player">Open the listening room <span aria-hidden="true">↗</span></button></div>';
    return '<p class="question-context">The discovery clue below is playable. This district’s full attraction remains a future experience.</p>';
  }
  function discovery(d){
    const stamped=journal.has(d.id),answer=clueAnswers.get(d.id),wrong=answer!==undefined&&answer!==d.answer;
    return `<details class="discovery" open><summary><span><span class="eyebrow">NIGHT CIRCUIT · STOP ${d.number}</span><br>${stamped?'Discovery stamp collected':'Solve the district clue'}</span><span aria-hidden="true">${stamped?'✓':'+'}</span></summary>${stamped?`<div class="stamp-complete" id="district-stamp" tabindex="-1"><span aria-hidden="true">✓</span><div><strong>${esc(d.reply)}</strong><small>LOCAL-UNVERIFIED · DISCOVERY SOUVENIR</small></div></div>`:`<p class="discovery-clue">${esc(d.clue)}</p><h4>${esc(d.question)}</h4><div class="clue-options">${d.options.map((option,i)=>`<button type="button" data-action="clue" data-answer="${i}" aria-pressed="${answer===i}"><span aria-hidden="true">${String.fromCharCode(65+i)}.</span>${esc(option)}</button>`).join('')}</div><p class="clue-feedback" id="clue-feedback" role="status">${wrong?'Not this one. Read the clue above and try again.':''}</p>`}</details>`;
  }
  function explore(){
    const d=selected;
    return `<div class="explore-layout"><section class="town-plan" aria-labelledby="town-plan-title" id="town-map"><div class="plan-topline"><strong id="town-plan-title">GOATVILLE / THE NIGHT PLAN</strong><span>SELECT A DISTRICT</span></div><div class="plan-visual"><img src="assets/goatville/town.svg" width="940" height="720" alt="Original architectural night plan of GOATVILLE, with its stadium, island green and illuminated city districts.">${E.districts.map(place=>`<button type="button" class="map-pin${journal.has(place.id)?' is-stamped':''}" data-action="district" data-district="${place.id}" aria-label="Explore ${esc(place.name)}" aria-pressed="${d.id===place.id}">${place.number}</button>`).join('')}</div><div class="district-list" aria-label="Choose a district">${E.districts.map(place=>`<button type="button" data-action="district" data-district="${place.id}" aria-pressed="${d.id===place.id}"><span>${place.number}</span>${esc(place.name)}${journal.has(place.id)?'<b aria-label="Discovery stamp collected">✓</b>':''}</button>`).join('')}</div></section><article class="dossier" aria-labelledby="district-title"><div class="dossier-top"><span>${esc(d.status)}</span>${icon(d.icon)}</div><p class="eyebrow">${esc(d.kicker)}</p><h2 id="district-title" tabindex="-1">${esc(d.name)}</h2><h3>${esc(d.title)}</h3><p class="dossier-copy">${esc(d.copy)}</p><blockquote class="host-quote">${esc(d.quote)}<cite>${esc(d.host)}</cite></blockquote>${districtAction(d)}${discovery(d)}<button type="button" class="text-button" data-action="back-map">↑ Choose another district</button></article></div>${circuitBar()}`;
  }
  function iqIntro(){
    return `<section class="iq-intro" aria-labelledby="iq-title"><div class="iq-presentation"><p class="eyebrow">THE BAA REPORT PRESENTS</p><h2 id="iq-title">Big sports energy.<br><em>Know your game.</em></h2><p>Six sports. Six calls. No clock. The Sports IQ challenge is a quick test of rules, scoring and your read on the moment.</p><button type="button" class="primary" data-action="iq-start">Step into the challenge <span aria-hidden="true">↗</span></button></div><div class="iq-brief"><p class="eyebrow">THE SIX-SPORT SWITCH</p><h3>A different arena with every call.</h3><div class="sport-six">${['Football','Basketball','Hockey','Baseball','Golf','Fantasy'].map((sport,i)=>`<div><span>0${i+1}</span>${sport}</div>`).join('')}</div><p class="iq-rules">One question per sport, drawn from 24 original prompts. Choose an answer, get an explanation, then move on. Pass any question. Replay for a new mix. Fantasy questions state their fictional scoring rules.</p></div></section>`;
  }
  function iqResult(){
    const score=E.score(round),title=score===6?'All six. Every arena.':score>=4?'You know your way around.':score>=2?'Good instincts. More to discover.':'The best stories start with a rematch.';
    return `<section class="iq-game" aria-labelledby="iq-result-title"><header class="iq-result-head">${icon('crown','crown-icon')}<p class="eyebrow">SPORTS IQ · THIS ROUND’S RESULT</p><h2 id="iq-result-title" tabindex="-1">${title}</h2><strong>${score}<small> / 6</small></strong><p>You made six calls across six sports. Your Sports IQ visit is stamped in this page’s passport. This is a recreational quiz result, not an official GPI, award or ranking.</p><button type="button" class="primary" data-action="iq-start">Play a fresh six <span aria-hidden="true">↻</span></button><a class="secondary" href="#passport">Open your passport ↗</a></header><ol class="answer-review" aria-label="Review all six answers">${round.deck.map((q,i)=>`<li><p class="eyebrow">${esc(q.sport)} · ${round.answers[i]===q.answer?'CORRECT':'REVIEW THE CALL'}</p><h3>${esc(q.prompt)}</h3><p class="review-selection">Your call: ${round.answers[i]===-1?'Passed':esc(q.options[round.answers[i]])}<br>Correct: ${esc(q.options[q.answer])}</p><p>${esc(q.explanation)}</p></li>`).join('')}</ol><p class="iq-note">General rules are simplified for these stated scenarios. Real competition rules and fantasy scoring formats vary. No current team data or live sports results are used.</p></section>`;
  }
  function iq(){
    if(!round)return iqIntro();if(round.complete)return iqResult();
    const q=round.deck[round.index],answered=round.answers.length>round.index,choice=round.answers[round.index],correct=choice===q.answer;
    return `<section class="iq-game" aria-labelledby="question-title"><header class="iq-scoreline"><span>SPORTS IQ <strong>/ ${esc(q.sport.toUpperCase())}</strong></span><span>CALL ${round.index+1} OF 6 · <strong>${E.score(round)} CORRECT</strong></span></header><ol class="iq-progress" aria-label="Round progress">${round.deck.map((question,i)=>`<li class="${i<round.answers.length?(round.answers[i]===question.answer?'correct':'incorrect'):i===round.index?'current':''}" aria-label="Question ${i+1}${i<round.answers.length?(round.answers[i]===question.answer?' correct':' answered'):i===round.index?' current':' ahead'}"></li>`).join('')}</ol><div class="iq-question"><p class="eyebrow">${esc(q.title.toUpperCase())}</p><h2 id="question-title" tabindex="-1">${esc(q.prompt)}</h2><p class="question-context">One answer. No timer. ${q.sport==='Fantasy'?'Use only the scoring stated in this fictional scenario.':'Use the standard rule for the stated situation.'}</p><div class="iq-options${answered?' has-answer':''}">${q.options.map((option,i)=>`<button type="button" class="iq-option${answered&&i===q.answer?' correct':answered&&choice===i?' incorrect':''}" data-action="iq-answer" data-answer="${i}"${answered?' disabled':''}><span aria-hidden="true">${String.fromCharCode(65+i)}</span>${esc(option)}${answered&&i===q.answer?'<b aria-label="Correct answer">✓</b>':''}</button>`).join('')}</div>${answered?`<div class="answer-feedback" id="answer-feedback" tabindex="-1" role="status"><h3>${choice===-1?'Passed. Here’s the call.':correct?'That’s the call.':'A different call this time.'}</h3><p class="answer-summary">${choice===-1?'You passed.':`Your call: ${esc(q.options[choice])}.`} Correct: ${esc(q.options[q.answer])}.</p><p>${esc(q.explanation)}</p><div class="answer-actions"><button type="button" class="primary" data-action="iq-next">${round.index===5?'See my result':'Next arena'} <span aria-hidden="true">↗</span></button><span class="eyebrow">${correct?'ONE CORRECT CALL':'KEEP PLAYING'}</span></div></div>`:'<button type="button" class="text-button" data-action="iq-pass">Pass this question →</button>'}</div></section>`;
  }
  function stampList(items){return `<ol class="stamp-list">${items.map(([id,name,href])=>`<li class="${journal.has(id)?'stamped':''}"><a href="${href}"><b aria-hidden="true">${journal.has(id)?'✓':'◇'}</b><span><strong>${esc(name)}</strong><small>${journal.has(id)?'LOCAL-UNVERIFIED SOUVENIR':'EXPERIENCE AWAITS'}</small></span></a></li>`).join('')}</ol>`;}
  function storageMessage(){const s=journal.state();return !s.available?'Saved data is unavailable. The passport works in memory for this page visit.':s.remembering?'Saving souvenirs in this browser. On another page or after reload, opt in again to restore them.':'Memory only for this page. Opt in to save; opt in again on a new page to restore. No storage is read before that choice.';}
  function passport(){
    const state=journal.state(),count=journal.count();
    return `<section class="journal-header"><div><p class="eyebrow">YOUR LOCAL GOATVILLE PASSPORT</p><h2>${esc(state.franchise)}.<br>Your night, collected.</h2><p>Five sports rooms. Six discoveries. One Sports IQ visit. Keep the story of where you played. Every stamp is a local-unverified souvenir with no official status, award or reward.</p></div><span class="journal-seal">${count}<small>OF 12 STOPS</small></span></section><div class="journal-layout"><div><section class="stamp-section"><h3>01 / The championship district <small>${journal.count(P.sports)} of 5</small></h3>${stampList(sports.map(([id,name])=>[id,name,`play.html#${id}`]))}</section><section class="stamp-section"><h3>02 / The Night Circuit <small>${journal.count(P.districts)} of 6</small></h3>${stampList(E.districts.map(d=>[d.id,d.name,`#explore/${d.id}`]))}</section><section class="stamp-section"><h3>03 / The Baa Report</h3>${stampList([['sports-iq','Sports IQ challenge','#sports-iq']])}</section></div><aside class="journal-controls" aria-labelledby="journal-controls-title"><h3 id="journal-controls-title">Your clubhouse. Your choice.</h3><label for="resort-franchise">Choose your franchise identity</label><select id="resort-franchise">${P.identities.map(name=>`<option${state.franchise===name?' selected':''}>${esc(name)}</option>`).join('')}</select><label class="storage-optin"><input id="resort-remember" type="checkbox"${state.remembering?' checked':''}> Save my passport in this browser</label><p class="small-note" id="resort-storage">${storageMessage()}</p><button type="button" class="secondary" data-action="clear-passport">Clear passport & turn off saving</button><details><summary>What do these stamps mean?</summary><p>They record local play and discovery only. You can edit or delete them. They never create membership, competition entries, championship titles, BAAS, GPI or verified achievements. Nothing is sent to a server. An official passport would need a separately reviewed account and verification service.</p></details></aside></div>`;
  }
  function count(){document.getElementById('resort-count').textContent=journal.count();}
  function render(focus){
    document.body.classList.toggle('is-playing-iq',route==='sports-iq'&&!!round&&!round.complete);
    root.innerHTML=route==='sports-iq'?iq():route==='passport'?passport():explore();count();
    if(focus)document.getElementById(focus)?.focus({preventScroll:false});
  }
  function readRoute({focus=false}={}){
    const [key,id]=location.hash.slice(1).split('/');route=['explore','sports-iq','passport'].includes(key)?key:'explore';
    if(route==='explore'&&id)selected=E.districts.find(d=>d.id===id)||E.districts[0];
    document.querySelectorAll('[data-route]').forEach(link=>{if(link.dataset.route===route)link.setAttribute('aria-current','page');else link.removeAttribute('aria-current');});
    document.title=`${route==='sports-iq'?'Sports IQ':route==='passport'?'Your Passport':'GOATVILLE After Dark'} — GOAT Universe`;
    render(focus?'resort-content':null);
  }
  root.addEventListener('click',event=>{
    const button=event.target.closest('button[data-action]');if(!button)return;
    const action=button.dataset.action;
    if(action==='district'){
      const d=E.districts.find(place=>place.id===button.dataset.district);if(!d)return;
      selected=d;history.pushState(null,'',`#explore/${d.id}`);render('district-title');announce(`Exploring ${d.name}. ${d.status}.`);
    }else if(action==='back-map'){document.getElementById('town-map').scrollIntoView({block:'start'});root.querySelector(`.map-pin[data-district="${selected.id}"]`).focus({preventScroll:true});}
    else if(action==='clue'){
      const value=Number(button.dataset.answer);if(!Number.isInteger(value)||value<0||value>=selected.options.length)return;
      clueAnswers.set(selected.id,value);
      if(value===selected.answer){journal.stamp(selected.id);render('district-stamp');announce(`${selected.name} discovery stamp collected. ${journal.count(P.districts)} of 6 Night Circuit stops complete.`);}
      else{render();root.querySelector(`[data-action=clue][data-answer="${value}"]`)?.focus({preventScroll:true});announce('Not this one. Read the clue and try again.');}
    }else if(action==='iq-start'){round=E.createRound();render('question-title');root.scrollIntoView({block:'start'});announce('Six sports. Six questions. Your round has started.');}
    else if(action==='iq-answer'||action==='iq-pass'){
      const value=action==='iq-pass'?-1:Number(button.dataset.answer);
      if(E.answer(round,value)){render('answer-feedback');}
    }else if(action==='iq-next'){
      if(E.advance(round)){
        if(round.complete){journal.stamp('sports-iq');render('iq-result-title');announce(`Sports IQ complete. ${E.score(round)} of 6 correct.`);}
        else render('question-title');
      }
    }else if(action==='clear-passport'){
      journal.clear();clueAnswers.clear();render();root.querySelector('[data-action=clear-passport]').focus({preventScroll:true});announce('Passport cleared. Saving is off.');
    }else if(action==='open-player'){
      document.getElementById('theme-lounge').hidden=false;document.getElementById('theme-play').focus();
    }
  });
  root.addEventListener('change',event=>{
    if(event.target.id==='resort-remember'){
      journal.remember(event.target.checked);document.getElementById('resort-storage').textContent=storageMessage();render();document.getElementById('resort-remember').focus({preventScroll:true});announce(storageMessage());
    }else if(event.target.id==='resort-franchise'){
      journal.setFranchise(event.target.value);render();document.getElementById('resort-franchise').focus({preventScroll:true});announce(`Your franchise is ${journal.state().franchise}.`);
    }
  });
  document.querySelector('[data-action=close-player]').addEventListener('click',()=>{
    globalThis.GoatTheme?.pause();document.getElementById('theme-lounge').hidden=true;root.querySelector('[data-action=open-player]')?.focus({preventScroll:true});
  });
  journal.subscribe(count);
  window.addEventListener('hashchange',()=>readRoute({focus:true}));
  window.addEventListener('popstate',()=>readRoute());
  readRoute();
})();
