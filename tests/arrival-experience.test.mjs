import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {JSDOM} from 'jsdom';

const html=readFileSync(new URL('../arrival-experience.html',import.meta.url),'utf8');
const script=[...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)].map(m=>m[1]).join('\n');

function render(url='https://founder.example/arrival-experience.html'){
 const dom=new JSDOM(html,{url,runScripts:'outside-only',pretendToBeVisual:true});
 dom.window.matchMedia=()=>({matches:true});
 dom.window.HTMLElement.prototype.scrollIntoView=function(){};
 dom.window.scrollTo=()=>{};
 dom.window.eval(script);
 return dom;
}
test('flagship GOAT Universe intellectual-property brands dominate the arrival',()=>{
 const dom=render();
 const doc=dom.window.document;
 assert.equal(doc.querySelector('.goatville-brand')?.firstChild?.textContent,'GOATVILLE');
 assert.match(doc.querySelector('.games-wordmark')?.textContent,/GOAT GAMES/);
 assert.equal(doc.querySelector('#gpi-headline')?.textContent,'GPI');
 assert.match(doc.querySelector('.media-brand-heading')?.textContent,/GOATVERSE CREATIVE MEDIA/);
 assert.equal(doc.querySelectorAll('.cards a.card strong').length,5);
 assert.match(html,/\.card strong\{font:1000/);
 assert.match(html,/\.gpi-spotlight h2\.gpi-brand-heading\{font:1000/);
 dom.window.close();
});
test('cinematic arrival has one clear Enter the Universe action',()=>{
 const dom=render();
 const doc=dom.window.document;
 assert.equal(doc.querySelectorAll('#enter').length,1);
 assert.equal(doc.querySelectorAll('nav.nav a').length,4);
 assert.match(doc.querySelector('.hero').textContent,/I’m making being a sports fan more entertaining\./);
 assert.match(html,/founder-arrival-gate\.jpg/);
 assert.doesNotMatch(html,/<img[^>]*town\.svg/);
 doc.getElementById('enter').click();
 assert.equal(doc.body.classList.contains('entered'),true);
 assert.equal(dom.window.location.hash,'#universe');
 doc.getElementById('home').click();
 assert.equal(doc.body.classList.contains('entered'),false);
 dom.window.close();
});
test('Goatville opens through one dramatic, accessible city gateway',()=>{
 const dom=render();
 const doc=dom.window.document;
 const gateway=doc.querySelector('.goatville-portal');
 assert.ok(gateway,'one scenic gateway');
 assert.equal(doc.querySelectorAll('.goatville-portal').length,1);
 assert.equal(gateway.getAttribute('aria-labelledby'),'goatville-gate-title');
 const door=gateway.querySelector('.goatville-portal-link');
 assert.equal(door.getAttribute('href'),'./goatville-city.html');
 assert.equal(door.getAttribute('aria-label'),'Enter Goatville City');
 assert.match(door.textContent,/ENTER GOATVILLE/);
 assert.equal(gateway.querySelectorAll('.gateway-action').length,1);
 assert.equal(gateway.querySelectorAll('img').length,1);
 assert.equal(gateway.querySelector('img').getAttribute('alt'),'');
 assert.match(gateway.querySelector('img').getAttribute('src'),/founder-arrival-gate\\.jpg/);
 assert.ok(doc.querySelector('.gateway-nearby a[href="./goatville-stadium.html"]'));
 assert.ok(doc.querySelector('.gateway-nearby a[href="./gpi.html"]'));
 assert.match(html,/prefers-reduced-motion:reduce/);
 dom.window.close();
});
test('each GOAT Game sends visitors to a distinct actual competition workspace',()=>{
 const dom=render();
 assert.deepEqual([...dom.window.document.querySelectorAll('.cards a.card')].map(a=>a.getAttribute('href')),[
 '/games/league-of-greatness',
 '/games/first-and-baa',
 '/games/horns-and-hoops',
 '/games/goat-crossover',
 '/games/goat-classic'
 ]);
 assert.equal(dom.window.document.querySelectorAll('.practice details').length,0);
 assert.equal(dom.window.document.querySelectorAll('details.practice').length,1);
 dom.window.close();
});
test('arrival directly reaches City, Stadium, Media, GPI and member account',()=>{
 const dom=render();
 const destinations=[...dom.window.document.querySelectorAll('a[href]')].map(a=>a.getAttribute('href'));
 for(const path of ['./goatville-city.html','./goatville-stadium.html','./gpi.html','/games','/manage','./goatville-cinema.html'])
  assert.ok(destinations.includes(path),path);
 assert.match(dom.window.document.body.textContent,/Goatverse Holdings Inc/);
 dom.window.close();
});
test('deep links open the correct world destination without reentering',()=>{
 const dom=render('https://founder.example/arrival-experience.html#games');
 assert.equal(dom.window.document.body.classList.contains('entered'),true);
 dom.window.close();
});
