import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,rm,stat} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {prepareFounderPreview,FOUNDER_FILES} from '../founder-preview.mjs';
import {prepareStaticRelease} from '../static-release.mjs';
async function setup(t) {
  const root=await mkdtemp(path.join(tmpdir(),'founder-recipe-'));t.after(()=>rm(root,{recursive:true,force:true}));
  const sourceDirectory=path.join(root,'source'),outputDirectory=path.join(root,'output');
  for(const file of FOUNDER_FILES) {
    await mkdir(path.dirname(path.join(sourceDirectory,file)),{recursive:true});
    await writeFile(path.join(sourceDirectory,file),file.endsWith('.html')?'<title>TEST</title><style>@import url(\'https://fonts.googleapis.com/css2?family=Inter:wght@400;800&family=Manrope:wght@400;800&display=swap\');</style><a href="goatville.html">Play</a>':'TEST FONT / LICENSE FIXTURE');
  }
  return {root,sourceDirectory,outputDirectory};
}
test('founder recipe preserves source, localizes only known fonts, includes licenses and is deterministic',async t=>{
  const s=await setup(t),before=await readFile(path.join(s.sourceDirectory,'index.html'));
  await writeFile(path.join(s.sourceDirectory,'private.txt'),'not selected');
  const first=await prepareFounderPreview(s),second=await prepareFounderPreview({...s,outputDirectory:path.join(s.root,'second')});
  assert.equal(first.status,'prepared_local_preview');assert.equal(first.files,8);assert.equal(first.transformations.length,4);
  assert.equal(first.manifest_sha256,second.manifest_sha256);assert.ok(first.checks.every(c=>c.status==='passed'));
  assert.deepEqual(await readFile(path.join(s.sourceDirectory,'index.html')),before);
  assert.doesNotMatch(await readFile(path.join(s.outputDirectory,'index.html'),'utf8'),/googleapis/);
  await assert.rejects(stat(path.join(s.outputDirectory,'private.txt')),{code:'ENOENT'});
});
test('broken candidate is rejected and only newly owned output cleaned; existing output and source preserved',async t=>{
  const s=await setup(t);await writeFile(path.join(s.sourceDirectory,'index.html'),'<img src="missing.png">');
  await assert.rejects(prepareFounderPreview(s),/founder_preview_references_failed/);
  await assert.rejects(stat(s.outputDirectory),{code:'ENOENT'});
  await mkdir(s.outputDirectory);await writeFile(path.join(s.outputDirectory,'keep.txt'),'keep');
  await assert.rejects(prepareFounderPreview(s),/output_already_exists/);
  assert.equal(await readFile(path.join(s.outputDirectory,'keep.txt'),'utf8'),'keep');
  await assert.rejects(prepareFounderPreview({...s,outputDirectory:path.join(s.sourceDirectory,'dist')}),/output_must_be_outside_source/);
});
test('reviewed audio payload formats are copied byte-for-byte under unchanged media budgets',async t=>{
  const s=await setup(t),bytes=Buffer.from([0,255,1,2]);
  for(const name of ['clip.mp3','clip.ogg','clip.wav'])await writeFile(path.join(s.sourceDirectory,name),bytes);
  const result=await prepareStaticRelease({...s,files:['clip.mp3','clip.ogg','clip.wav']});assert.equal(result.files,3);
  for(const name of ['clip.mp3','clip.ogg','clip.wav'])assert.deepEqual(await readFile(path.join(s.outputDirectory,name)),bytes);
});
