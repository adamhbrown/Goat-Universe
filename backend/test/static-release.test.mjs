import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdtemp,mkdir,readFile,writeFile,rm,symlink,stat} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {MANIFEST,prepareStaticRelease,verifyStaticRelease} from '../static-release.mjs';
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');

async function setup(t) {
  const root=await mkdtemp(path.join(tmpdir(),'goat-release-test-')), source=path.join(root,'source');
  t.after(()=>rm(root,{recursive:true,force:true}));
  await mkdir(path.join(source,'assets'),{recursive:true});
  await writeFile(path.join(source,'index.html'),'<!doctype html><title>Fixture</title><script src="assets/game.js"></script>');
  await writeFile(path.join(source,'assets/game.js'),'console.log("FIXTURE")');
  await writeFile(path.join(source,'not-selected.txt'),'PRIVATE FIXTURE NOT SELECTED');
  const output=path.join(root,'release'), files=['index.html','assets/game.js'];
  return {root,sourceDirectory:source,outputDirectory:output,files};
}
const check=(s,digest)=>verifyStaticRelease({directory:s.outputDirectory,expectedManifestSha256:digest});

test('explicit export is deterministic, read-only to source and requires a trusted manifest digest',async t=>{
  const s=await setup(t), sourceBytes=await readFile(path.join(s.sourceDirectory,'index.html'));
  const first=await prepareStaticRelease(s);
  const second=await prepareStaticRelease({...s,files:[...s.files].reverse(),outputDirectory:path.join(s.root,'second')});
  assert.equal(first.status,'verified');assert.equal(first.files,2);
  assert.equal(first.manifest_sha256,second.manifest_sha256);
  assert.deepEqual(await readFile(path.join(s.sourceDirectory,'index.html')),sourceBytes);
  assert.equal((await check(s,first.manifest_sha256)).status,'verified');
  await assert.rejects(stat(path.join(s.outputDirectory,'not-selected.txt')), {code:'ENOENT'});
  await assert.rejects(check(s,undefined),/trusted_manifest_digest_required/);
  await assert.rejects(check(s,'a'.repeat(64)),/manifest_digest_mismatch/);
});

test('release verifier detects same-size byte tampering',async t=>{
  const s=await setup(t), result=await prepareStaticRelease(s);
  const file=path.join(s.outputDirectory,'assets/game.js');
  const bytes=await readFile(file);bytes[0]^=1;await writeFile(file,bytes);
  await assert.rejects(check(s,result.manifest_sha256),/release_file_digest_mismatch/);
});

test('release verifier detects missing and unexpected files',async t=>{
  for (const variant of ['missing','extra']) {
    const s=await setup(t), result=await prepareStaticRelease(s);
    if (variant==='missing') await rm(path.join(s.outputDirectory,'assets/game.js'));
    else await writeFile(path.join(s.outputDirectory,'extra.js'),'unexpected');
    await assert.rejects(check(s,result.manifest_sha256),/release_file_set_mismatch/);
  }
});

test('rewriting both a payload and its adjacent manifest cannot pass the original trusted digest',async t=>{
  const s=await setup(t), result=await prepareStaticRelease(s);
  const file=path.join(s.outputDirectory,'assets/game.js'), replacement=Buffer.from('forged');
  await writeFile(file,replacement);
  const manifest=JSON.parse(await readFile(path.join(s.outputDirectory,MANIFEST),'utf8'));
  const record=manifest.files.find(f=>f.path==='assets/game.js');record.bytes=replacement.length;record.sha256=hash(replacement);
  await writeFile(path.join(s.outputDirectory,MANIFEST),JSON.stringify(manifest)+'\n');
  await assert.rejects(check(s,result.manifest_sha256),/manifest_digest_mismatch/);
});

test('path selection rejects traversal, absolute paths, aliases, reserved manifest and excessive files',async t=>{
  const s=await setup(t);
  for (const files of [[],['../index.html'],['/index.html'],['a//b.js'],['./index.html'],['assets/../index.html'],
    ['.env'],['a\\b.js'],[MANIFEST],['Index.html','index.html'],Array(500).fill('index.html')])
    await assert.rejects(prepareStaticRelease({...s,files}),/invalid_public_file_selection|duplicate_public_path/);
  await assert.rejects(prepareStaticRelease({...s,outputDirectory:path.join(s.sourceDirectory,'dist')}),/output_must_be_outside_source/);
});

test('existing outputs and symlinks are preserved without overwrite',async t=>{
  const s=await setup(t);
  await mkdir(s.outputDirectory);await writeFile(path.join(s.outputDirectory,'preserve.txt'),'keep');
  await assert.rejects(prepareStaticRelease(s),/output_already_exists/);
  assert.equal(await readFile(path.join(s.outputDirectory,'preserve.txt'),'utf8'),'keep');
  await symlink(s.outputDirectory,path.join(s.root,'linked-output'));
  await assert.rejects(prepareStaticRelease({...s,outputDirectory:path.join(s.root,'linked-output')}),/output_already_exists/);
  await symlink(s.sourceDirectory,path.join(s.root,'linked-source'));
  await assert.rejects(prepareStaticRelease({...s,sourceDirectory:path.join(s.root,'linked-source')}),/regular_directory_required/);
});

test('source symlinks at the file or intermediate directory are rejected',async t=>{
  const s=await setup(t);
  await symlink(path.join(s.sourceDirectory,'index.html'),path.join(s.sourceDirectory,'linked.html'));
  await symlink(path.join(s.sourceDirectory,'assets'),path.join(s.sourceDirectory,'linked-assets'));
  for (const files of [['linked.html'],['linked-assets/game.js']])
    await assert.rejects(prepareStaticRelease({...s,files}),/non_regular_source_path/);
});

test('failed security audit removes only its newly created output',async t=>{
  const s=await setup(t);
  await writeFile(path.join(s.sourceDirectory,'assets/game.js'),'sb_secret_'+'x'.repeat(30));
  await assert.rejects(prepareStaticRelease(s),/public_export_audit_failed/);
  await assert.rejects(stat(s.outputDirectory),{code:'ENOENT'});
  assert.equal(await readFile(path.join(s.sourceDirectory,'not-selected.txt'),'utf8'),'PRIVATE FIXTURE NOT SELECTED');
});

test('manifest schema, order and digest fields are validated even when digest is supplied by a caller',async t=>{
  const s=await setup(t);await prepareStaticRelease(s);
  const manifestPath=path.join(s.outputDirectory,MANIFEST);
  const original=JSON.parse(await readFile(manifestPath,'utf8'));
  for (const mutate of [m=>{m.authority='official';},m=>{m.files.reverse();},m=>{m.files[0].path='../escape';},
    m=>{m.files[0].bytes=-1;},m=>{m.files[0].sha256='invalid';},m=>{m.files.push({...m.files[0]});}]) {
    const m=structuredClone(original);mutate(m);const bytes=Buffer.from(JSON.stringify(m)+'\n');
    await writeFile(manifestPath,bytes);
    await assert.rejects(check(s,hash(bytes)),/invalid_release_manifest|manifest_paths_not_canonical|duplicate_public_path/);
  }
});

test('size budgets are enforced before copying oversized source assets',async t=>{
  const s=await setup(t);
  await writeFile(path.join(s.sourceDirectory,'large.mp4'),Buffer.alloc(4194305));
  await assert.rejects(prepareStaticRelease({...s,files:['large.mp4']}),/source_size_budget_exceeded/);
  await assert.rejects(stat(s.outputDirectory),{code:'ENOENT'});
});
