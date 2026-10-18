import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const city=read('goatville-city.html'),lab=read('goat-games-play-lab.html');
const home=read('goatville-stadium.html'),cinema=read('goatville-cinema.html');
test('cinematic arrival is an accessible choice, never a mandatory blocker',()=>{
  assert.match(city,/id="open-cinema"/);
  assert.match(city,/id="cinema-skip"/);
  assert.match(city,/href="#districts"/);
  assert.match(city,/href="goatville-cinema\.html"/);
  assert.match(city,/aria-label="Start your GOATVILLE journey"/);
  assert.doesNotMatch(city,/autoplay|new Audio\(|AudioContext|setTimeout\(/);
});
test('GOATVILLE gateway offers three direct City, league and media destinations while practice is secondary',()=>{
  assert.equal((city.match(/class="arrival-card"/g)||[]).length,3);
  for(const path of ['goatville-stadium.html','/games','goatville-cinema.html']){
    assert.ok(city.includes('class="arrival-card" href="'+path+'"'),path);
  }
  assert.match(city,/data-spot="stadium"/);
  assert.match(city,/data-spot="arcade"/);
  assert.match(city,/data-spot="cinema"/);
  assert.match(city,/FIVE GOAT GAMES/);
  assert.match(city,/LEAGUE WORKSPACE/);
  assert.match(city,/MEDIA &amp; MUSIC/);
  assert.match(city,/<details class="city-optional">/);
  assert.match(city,/href="goat-games-play-lab\.html"/);
});
test('five championship arenas have restrained motion with reduced-motion escape',()=>{
  assert.equal((lab.match(/data-number="\d\d" role="tabpanel"/g)||[]).length,5);
  assert.match(lab,/@keyframes gv-arena-enter/);
  assert.match(lab,/prefers-reduced-motion:reduce/);
  assert.match(lab,/\.arena:not\(\[hidden\]\)\{animation:none\}/);
  assert.match(lab,/role="tablist"/);
  assert.match(lab,/aria-selected/);
});
test('lab links to city and cinematic studio, but keeps game scenarios fictional',()=>{
  assert.match(lab,/href="goatville-city\.html"/);
  assert.match(lab,/href="goatville-cinema\.html"/);
  assert.match(lab,/FREE PLAY LAB/);
  assert.match(lab,/fictional demonstrations/);
  assert.match(lab,/No official GOAT Games entries/);
});
test('cinematic player stays local with explicit user-controlled audio',()=>{
  assert.match(cinema,/type="file" accept="video\/\*"/);
  assert.match(cinema,/type="file" accept="audio\/\*"/);
  assert.match(cinema,/SOUND OFF/);
  assert.match(cinema,/SKIP → ENTER GOATVILLE/);
  assert.match(cinema,/connect-src 'none'/);
  assert.match(home,/ENTER GOATVILLE CITY/);
});
