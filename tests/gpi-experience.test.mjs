import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {JSDOM} from 'jsdom';

const html=readFileSync(new URL('../gpi.html',import.meta.url),'utf8');
const script=[...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)].map(m=>m[1]).join('\n');

function render(hash=''){
 const dom=new JSDOM(html,{url:'https://founder.example/gpi.html'+hash,runScripts:'outside-only'});
 dom.window.eval(script);
 return dom;
}
test('GPI is the giant visible flagship brand rather than a tiny eyebrow label',()=>{
 const dom=render();
 const {document}=dom.window;
 const heading=document.querySelector('h1.gpi-wordmark');
 assert.ok(heading);
 assert.equal(heading.textContent,'GPI');
 assert.equal(document.querySelector('.gpi-fullname').textContent,'GOAT POWER INDEX');
 assert.equal(document.querySelectorAll('h1').length,1);
 assert.match(html,/font-size:clamp\(7\.1rem,30vw,23rem\)/);
 assert.match(html,/Same block\./);
 assert.match(html,/No GPS tracking, background geofencing/);
 assert.equal(document.querySelectorAll('input').length,0);
 dom.window.close();
});
test('GPI has five geographic tabs and does not invent a score or ranking',()=>{
 const dom=render();
 const {document}=dom.window;
 assert.deepEqual([...document.querySelectorAll('.tab')].map(b=>b.dataset.scope),['block','county','state','region','global']);
 assert.equal(document.querySelectorAll('.metric strong').length,4);
 assert.ok([...document.querySelectorAll('.metric strong')].every(e=>e.textContent==='—'));
 assert.match(document.getElementById('ranking-panel').textContent,/No verified rankings published/);
 assert.match(document.body.textContent,/Not zero\. Not unranked\./);
 assert.doesNotMatch(script,/\bfetch\(|\bXMLHttpRequest\b|\blocalStorage\b|\bsessionStorage\b/);
 dom.window.close();
});
test('GPI scope controls change both context and tab state',()=>{
 const dom=render(),{document}=dom.window;
 const county=document.getElementById('scope-county');
 county.click();
 assert.equal(county.getAttribute('aria-selected'),'true');
 assert.equal(document.getElementById('scope-block').getAttribute('aria-selected'),'false');
 assert.equal(document.getElementById('scope-title').textContent,'Make your county proud.');
 assert.equal(document.getElementById('scope-context-label').textContent,'County leaderboard:');
 assert.equal(dom.window.location.hash,'#county');
 assert.equal(document.getElementById('ranking-panel').getAttribute('aria-labelledby'),'scope-county');
 const event=new dom.window.KeyboardEvent('keydown',{key:'ArrowRight',bubbles:true});
 county.dispatchEvent(event);
 assert.equal(document.getElementById('scope-state').getAttribute('aria-selected'),'true');
 assert.equal(document.getElementById('scope-title').textContent,'Take on your state.');
 dom.window.close();
});
test('GPI deep links initialize the correct geographic level',()=>{
 const dom=render('#global');
 assert.equal(dom.window.document.getElementById('scope-global').getAttribute('aria-selected'),'true');
 assert.equal(dom.window.document.getElementById('scope-title').textContent,'Take on the world.');
 dom.window.close();
});
test('GPI provides working navigation to existing local competition and account routes',()=>{
 for(const path of ['/games','/manage','./goatville-city.html']){
  assert.ok(html.includes('href="'+path+'"'),path);
 }
 assert.match(html,/Goatverse Holdings Inc\./);
 assert.match(html,/max-width:480px/);
 assert.match(html,/role="tablist"/);
 assert.match(html,/aria-live="polite"/);
});


test('five founder-approved GPI challenges link to correct accessible scope without inventing member placements', () => {
 const dom=render();
 const doc=dom.window.document;
 const cards=[...doc.querySelectorAll('.challenge[data-target-scope]')];
 assert.deepEqual(cards.map(c=>c.dataset.targetScope),['block','county','state','region','global']);
 assert.match(doc.getElementById('challenge-heading').textContent,/Are you the GOAT/);
 assert.match(doc.querySelector('.challenge-ladder').textContent,/Top 10 in your county/);
 assert.match(doc.querySelector('.challenge-ladder').textContent,/Top 100 in your state/);
 assert.ok(cards.every(card=>card.textContent.includes('Not a verified placement')));
 cards[1].click();
 assert.equal(doc.getElementById('scope-county').getAttribute('aria-selected'),'true');
 assert.equal(doc.getElementById('scope-title').textContent,'Make your county proud.');
 assert.equal(dom.window.location.hash,'#county');
 assert.match(doc.getElementById('ranking-panel').textContent,/No verified rankings published/);
 dom.window.close();
});
test('deep-link changes from GPI challenge links update the geographic board',()=>{
 const dom=render();
 dom.window.location.hash='#region';
 dom.window.dispatchEvent(new dom.window.Event('hashchange'));
 assert.equal(dom.window.document.getElementById('scope-region').getAttribute('aria-selected'),'true');
 assert.equal(dom.window.document.getElementById('scope-title').textContent,'Rule your region.');
 dom.window.close();
});
