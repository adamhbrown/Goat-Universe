const assert=require('node:assert/strict');const {test}=require('node:test');const C=require('../assets/practice-card.js');
test('every portable card carries an accessible title and the fictional/unverified boundary',()=>{
 const card={destination:'Horns & Hoops',headline:'Harbor Night Owls',subline:'Your projected champion.',lines:['Opening: Harbor Night Owls','Final: Harbor Night Owls']};const svg=C.svg(card);
 assert.match(svg,/<title id="title">Horns &amp; Hoops — fictional practice keepsake/);assert.match(svg,/aria-labelledby="title description"/);assert.match(svg,/FICTIONAL PRACTICE EDITION/);assert.match(svg,/LOCAL-UNVERIFIED KEEPSAKE/);assert.match(svg,/No official result, entry, award, prize, BAAS or GPI/);assert.doesNotMatch(svg,/<script|foreignObject|href=|onload=|<image/);
});
test('all dynamic SVG content is XML-escaped, including the plain-text description',()=>{
 const card={destination:'<script>&"',headline:'<image onload="x">',subline:'a & b',lines:['</text><script>bad()</script>']};const svg=C.svg(card);assert.doesNotMatch(svg,/<script|<image|<\/text><script>/);assert.match(svg,/&lt;script&gt;/);assert.match(svg,/a &amp; b/);assert.match(svg,/&quot;/);
});
test('card layout bounds long input, and plain text preserves the full displayed result',()=>{
 const card={destination:'x'.repeat(500),headline:'Long word '.repeat(30),subline:'Practice only',lines:Array.from({length:100},(_,i)=>'line '+i)};const svg=C.svg(card);assert.ok(svg.length<20000);assert.doesNotMatch(svg,/>line 99</);assert.match(C.text(card),/line 99/);assert.match(C.text(card),/Local-unverified keepsake/);
});
