// Founder-preview smoke checks for the standalone cinematic arrival.
// Run from the repository root: node scripts/check-tiffany-arrival.mjs
import { readFileSync, existsSync } from 'node:fs';
import { strict as assert } from 'node:assert';
const html = readFileSync('arrival-experience.html', 'utf8');
const checks = [
  ['single arrival action', () => assert.equal((html.match(/id="enter"/g)||[]).length, 1)],
  ['five game cards', () => assert.equal((html.match(/class="card" href="\.\/goat-games-play-lab\.html"/g)||[]).length, 5)],
  ['four navigation destinations', () => ['universe','games','media','league'].forEach(id => assert.match(html, new RegExp('data-target="'+id+'"')))],
  ['real Goatville city destination', () => assert.match(html, /href="\.\/goatville-city\.html"/)],
  ['real cinema destination', () => assert.match(html, /href="\.\/goatville-cinema\.html"/)],
  ['media included in every league', () => assert.match(html, /Included with every league/)],
  ['accessible primary entrance', () => assert.match(html, /class="skip" href="#enter"/)],
  ['reduced motion support', () => assert.match(html, /prefers-reduced-motion:reduce/)],
  ['no inactive sound control', () => assert.doesNotMatch(html, /id="sound"/)],
  ['local assets and links resolve', () => {
    for (const target of ['assets/goatville/founder-arrival-gate.jpg','assets/goatville/town.svg','goatville-city.html','goatville-cinema.html','goatville.html','goat-games-play-lab.html','play.html']) assert.ok(existsSync(target), 'Missing: '+target);
  }]
];
let failures=0;
for (const [name, check] of checks) {
  try { check(); process.stdout.write('PASS '+name+'\n'); }
  catch (error) { failures++; process.stderr.write('FAIL '+name+': '+error.message+'\n'); }
}
process.stdout.write((checks.length-failures)+'/'+checks.length+' arrival smoke checks passed\n');
if (failures) process.exitCode=1;
