import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const lab = readFileSync(new URL('../goat-games-play-lab.html', import.meta.url), 'utf8');
const goatville = readFileSync(new URL('../goatville.html', import.meta.url), 'utf8');
const homepage = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const script = lab.match(/<script>([\s\S]*?)<\/script>/)?.[1];

test('five unique sport attractions exist with labeled tabs and tab panels', () => {
  const sports = ['football', 'hoops', 'cross', 'fantasy', 'baseball'];
  assert.equal((lab.match(/role="tab" aria-controls=/g) || []).length, 5);
  assert.equal((lab.match(/role="tabpanel"/g) || []).length, 5);
  for (const name of sports) {
    assert.match(lab, new RegExp('id="tab-' + name + '"'));
    assert.match(lab, new RegExp('id="arena-' + name + '"'));
    assert.match(lab, new RegExp('aria-labelledby="tab-' + name + '"'));
  }
});
test('all five official identities and approved subtitles are represented accurately', () => {
  for (const name of ['1st &amp; BAA', 'Goats of the Gridiron Playoff League', 'HORNS &amp; HOOPS', "Downtown's BAAsketball Showcase XXXV", 'GOAT CROSSOVER', 'Two Sports, 1 Competition', 'LEAGUE OF GREATNESS', 'Fantasy Football Championships', 'THE GOAT CLASSIC', 'Take Your Swing at History']) {
    assert.ok(lab.includes(name), name);
  }
});
test('all internal anchors resolve, and IDs are unique', () => {
  const ids = [...lab.matchAll(/\bid="([^"]+)"/g)].map(m => m[1]);
  assert.equal(ids.length, new Set(ids).size);
  for (const [, hash] of lab.matchAll(/href="#([^"]+)"/g)) {
    assert.ok(ids.includes(hash), '#' + hash);
  }
});
test('GOATVILLE town map, destination CTA and homepage link open the play lab', () => {
  assert.ok((goatville.match(/href="goat-games-play-lab\.html"/g) || []).length >= 2);
  assert.match(homepage, /href="goat-games-play-lab\.html"/);
});
test('first sport has ATS and confidence mechanics', () => {
  assert.match(lab, /id="confidence"/);
  assert.match(lab, /Harbor Hawks -3\.5/);
  assert.match(lab, /margin>3\.5/);
});
test('bracket has two semifinal stages and a championship choice', () => {
  assert.match(lab, /const teams=\['Metro Meteors','Summit Storm','River Royals','Coast Comets'\]/);
  assert.match(lab, /stage===2\?'CROWN CHAMPION/);
});
test('crossover predicts both sport series winners and number of games', () => {
  assert.match(lab, /id="basket-length"/);
  assert.match(lab, /id="hockey-length"/);
  assert.match(lab, /if\(!picks\['cross-basket'\]\|\|!picks\['cross-hockey'\]\)/);
});
test('fantasy workout and baseball series are labeled fictional', () => {
  assert.match(lab, /Illustrative projection/);
  assert.match(lab, /Illustrative roster archetypes and sample projections/);
  assert.match(lab, /FICTIONAL SERIES:/);
  assert.match(lab, /id="baseball-length"/);
});
test('lab is keyboard-friendly, reduced-motion aware and self-contained', () => {
  assert.match(lab, /ArrowLeft/);
  assert.match(lab, /prefers-reduced-motion:reduce/);
  assert.match(lab, /aria-live="polite"/);
  assert.doesNotMatch(lab, /fetch\(|XMLHttpRequest|WebSocket|localStorage|<form\b/);
  assert.ok(script);
  assert.doesNotThrow(() => new Function(script));
});
test('lab makes no claims about live contest results or paid competitions', () => {
  assert.match(lab, /No official GOAT Games entries/);
  assert.match(lab, /independent of all official competitions/);
  assert.match(lab, /does not accept payments, stakes or real-money wagers/);
});
test('all five sports can be played, scored and reset in a simulated DOM', () => {
  class FakeElement {
    constructor(id='') {
      this.id=id;this.listeners={};this.attributes={};this.dataset={};
      this.children=[];this.style={};this.textContent='';this.value='';this.hidden=false;
      this.disabled=false;this.tabIndex=0;
      const classes=new Set();this.classList={
        add:name=>classes.add(name),
        contains:name=>classes.has(name),
        toggle:(name,enabled)=>{if(enabled)classes.add(name);else classes.delete(name);}
      };
    }
    addEventListener(name,fn){this.listeners[name]=fn;}
    click(){this.listeners.click?.({preventDefault(){}});}
    setAttribute(key,value){this.attributes[key]=value;}
    getAttribute(key){return this.attributes[key];}
    querySelectorAll(name){return name==='button'?this.children:[];}
    replaceChildren(){this.children=[];}
    appendChild(child){this.children.push(child);}
    focus(){}
  }
  const ids=[...lab.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);
  const elements=Object.fromEntries(ids.map(id=>[id,new FakeElement(id)]));
  const selectionGroups={
    'football-options':['Hawks','Wolves'],
    'cross-basket':['Kings','Comets'],
    'cross-hockey':['Blades','Frost'],
    'fantasy-options':['Mason Reed','Jordan Vale'],
    'baseball-options':['Admirals','Pioneers']
  };
  for(const [id,values] of Object.entries(selectionGroups)){
    for(const value of values){const n=new FakeElement(value);n.dataset.value=value;elements[id].appendChild(n);}
  }
  const tabs=['football','hoops','cross','fantasy','baseball'].map(name=>{
    const t=new FakeElement('tab-'+name);t.dataset.sport=name;t.attributes['aria-controls']='arena-'+name;return t;
  });
  const doc={
    getElementById:id=>elements[id],
    querySelectorAll:query=>query==='[data-sport]'?tabs:[],
    createElement:name=>new FakeElement(name)
  };
  const deterministicMath=Object.create(Math);
  deterministicMath.random=()=>.5;
  new Function('document','Math',script)(doc,deterministicMath);
  const select=(group,i)=>elements[group].children[i].click();
  select('football-options',1);
  elements.confidence.value='3';
  elements['football-play'].click();
  assert.match(elements['football-result'].textContent,/COVERS/);

  select('cross-basket',1);select('cross-hockey',1);
  elements['basket-length'].value='6';elements['hockey-length'].value='6';
  elements['cross-play'].click();
  assert.match(elements['cross-result'].textContent,/2 \/ 2/);

  select('fantasy-options',0);elements['fantasy-play'].click();
  assert.match(elements['fantasy-result'].textContent,/paid off/);

  select('baseball-options',1);elements['baseball-length'].value='6';
  elements['baseball-play'].click();
  assert.match(elements['baseball-result'].textContent,/PERFECT SERIES CALL/);

  for(let stage=0;stage<3;stage++){
    assert.equal(elements['hoops-options'].children.length,2);
    elements['hoops-options'].children[0].click();
    elements['hoops-advance'].click();
  }
  assert.match(elements['hoops-result'].textContent,/YOUR MINI-BRACKET CHAMPION/);
  assert.equal(elements.completion.textContent,'5 / 5');
  assert.equal(String(elements.perfect.textContent),'7');
  assert.equal(elements['last-play'].textContent,'Horns & Hoops');
  elements['reset-session'].click();
  assert.equal(elements.completion.textContent,'0 / 5');
  assert.equal(String(elements.perfect.textContent),'0');
});
