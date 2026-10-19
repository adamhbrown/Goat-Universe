import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const city=read('goatville-city.html'),stadium=read('goatville-stadium.html'),media=read('goatville-cinema.html'),mediaCss=read('cinema/studio.css');
const publicFiles=new Set(JSON.parse(read('backend/public-files.json')));
const games=['first-and-baa','horns-and-hoops','goat-crossover','league-of-greatness','goat-classic'];
const pages={city,stadium,media};
test('Pope City uses reviewed media and keeps its seven working districts and cinematic controls',()=>{
 assert.match(city,/<figure class="city city-photo"><img src="assets\/goatville\/founder-arrival-gate\.jpg"/);
 assert.doesNotMatch(city,/<svg class="skyline"/);
 assert.equal((city.match(/<article class="district"/g)||[]).length,7);
 for(const id of ['open-cinema','cinema-close','cinema-next','cinema-skip','filter-status'])
  assert.match(city,new RegExp('id="'+id+'"'));
 assert.match(city,/<details class="city-optional">/);
 assert.match(city,/href="goatville-stadium\.html"/);
 assert.match(city,/href="\/games"/);
});
test('City, Stadium and Creative Media return to one latest founder gateway; City market has a real destination',()=>{
 assert.ok(city.includes('href="arrival-experience.html#universe"'));
 assert.ok(stadium.includes('href="arrival-experience.html#universe"'));
 assert.ok(media.includes('href="arrival-experience.html#media"'));
 const market=city.split('<article class="district" data-district="market">')[1]?.split('</article>')[0];
 assert.ok(market?.includes('href="commerce.html#collections"'));
 assert.ok(publicFiles.has('commerce.html'));
 assert.ok(publicFiles.has('commerce/collections.js'));
});
test('Stadium leads into the five actual competition workspaces and retains optional game details',()=>{
 for(const game of games)assert.ok(stadium.includes('class="games-card-link" href="/games/'+game+'"'),game);
 assert.equal((stadium.match(/<details class="game-detail"/g)||[]).length,5);
 assert.match(stadium,/No verified GOAT Universe standings published yet/);
 assert.match(stadium,/id="goatMode"/);
});
test('Media keeps editorial content separate from local playback and never auto-plays founder theme',()=>{
 assert.equal((media.match(/class="media-shelf(?: featured)?"/g)||[]).length,4);
 assert.match(media,/<audio controls preload="none" src="assets\/goatville\/official-theme\.mp4"/);
 assert.doesNotMatch(media,/<(?:audio|video)[^>]*autoplay/);
 for(const id of ['screen-video','video-file','audio-file','music','play','pause','restart','sound'])
  assert.match(media,new RegExp('id="'+id+'"'));
 assert.match(mediaCss,/\.media-shelves/);
});
test('All internal links resolve to exposed files, the games workspace or guarded account routes',()=>{
 const files=['index.html',...publicFiles];
 for(const [label,html] of Object.entries(pages)){
  for(const match of html.matchAll(/href="([^"]+)"/g)){
   const href=match[1];
   if(href.startsWith('#')||href.startsWith('https://')||href.startsWith('mailto:')||href.startsWith('tel:'))continue;
   if(href==='/games'||href==='/manage'||games.some(id=>href==='/games/'+id))continue;
   const file=href.split('#')[0].split('?')[0];
   assert.ok(files.includes(file),'Unlisted internal link on '+label+': '+href);
   assert.ok(existsSync(new URL('../'+file,import.meta.url)),'Missing internal target on '+label+': '+href);
  }
 }
});
test('Pope pages preserve correct brand and protected public media assets',()=>{
 for(const file of ['goatville-city.html','goatville-stadium.html','goatville-cinema.html','assets/goatville/founder-arrival-gate.jpg','assets/goatville/official-theme.mp4'])
  assert.ok(publicFiles.has(file),'Missing published allowlist asset: '+file);
 assert.match(stadium,/GOATVERSE HOLDINGS INC\./);
 assert.match(media,/GOATVERSE HOLDINGS INC\./);
 for(const html of Object.values(pages))assert.doesNotMatch(html,/GOATVILLE USA/);
});
