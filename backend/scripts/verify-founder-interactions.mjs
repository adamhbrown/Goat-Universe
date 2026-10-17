// Executes reviewed founder-preview inline code in JSDOM. JSDOM is not a
// security sandbox. Use only a trusted digest of source reviewed by the team.
// No resources are loaded; this is DOM regression evidence, not browser QA.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {JSDOM,VirtualConsole} from 'jsdom';
import {inspectPreview} from '../preview-release.mjs';
const [directory,expectedManifestSha256]=process.argv.slice(2);
try {
  if(process.argv.length!==4)throw new Error('directory_and_trusted_digest_required');
  const results=[];
  for(const prefix of ['/','/Goat-Universe/']) {
    const report=await inspectPreview({directory,expectedManifestSha256,prefix});assert.equal(report.status,'passed');
    for(const file of ['goat-games-play-lab.html','goatville.html']) {
      const errors=[],virtualConsole=new VirtualConsole();virtualConsole.on('jsdomError',e=>errors.push(e.type));
      const dom=new JSDOM(await readFile(path.join(directory,file),'utf8'),{url:'http://127.0.0.1'+prefix+file,runScripts:'dangerously',virtualConsole,beforeParse(w){w.Math.random=()=>0.5;}});
      try {
        const doc=dom.window.document,$=id=>{const el=doc.getElementById(id);assert.ok(el,id);return el;};
        if(file==='goat-games-play-lab.html') {
          const select=(group,index=0)=>$(group).querySelectorAll('button')[index].click();
          select('football-options',1);$('confidence').value='3';$('football-play').click();assert.match($('football-result').textContent,/COVERS/);
          $('tab-cross').click();assert.equal($('arena-cross').hidden,false);
          select('cross-basket',1);select('cross-hockey',1);$('basket-length').value='6';$('hockey-length').value='6';$('cross-play').click();assert.match($('cross-result').textContent,/2 \/ 2/);
          $('tab-fantasy').click();select('fantasy-options');$('fantasy-play').click();assert.match($('fantasy-result').textContent,/paid off/);
          $('tab-baseball').click();select('baseball-options',1);$('baseball-length').value='6';$('baseball-play').click();assert.match($('baseball-result').textContent,/PERFECT SERIES CALL/);
          $('tab-hoops').click();for(let stage=0;stage<3;stage++){select('hoops-options');$('hoops-advance').click();}
          assert.match($('hoops-result').textContent,/YOUR MINI-BRACKET CHAMPION/);assert.equal($('completion').textContent,'5 / 5');
          $('reset-session').click();assert.equal($('completion').textContent,'0 / 5');
        } else {
          doc.querySelector('[data-role="competitor"]').click();assert.match($('mayor-response').textContent,/competitor/);
          for(const choice of [1,1,1,2,1,1]){$('answers').children[choice].click();$('quiz-next').click();}
          assert.match($('question').textContent,/6 \/ 6/);
          for(const [aim,power] of [[-10,64],[15,78],[-20,48]]){$('aim').value=String(aim);$('power').value=String(power);$('swing').click();$('next-hole').click();}
          assert.match($('golf-feedback').textContent,/300 \/ 300/);assert.match($('passport-count').textContent,/3 \/ 3/);
          $('clear-passport').click();assert.match($('passport-count').textContent,/0 \/ 3/);
        }
        assert.deepEqual(errors,[]);results.push({file,prefix,status:'passed'});
      } finally {dom.window.close();}
    }
  }
  console.log(JSON.stringify({status:'passed',checks:results,scope:'JSDOM simulated interactions; no real layout, Safari, CSP or device acceptance.'},null,2));
} catch(error) {
  console.log(JSON.stringify({status:'failed',diagnosis:/^[a-z_]+$/.test(error.message)?error.message:'founder_interactions_failed'}));process.exitCode=1;
}
