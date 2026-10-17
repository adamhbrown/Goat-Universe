import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,rm,copyFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {request} from 'node:http';
import {spawn} from 'node:child_process';
import {prepareStaticRelease} from '../static-release.mjs';
import {inspectPreview,createPreviewServer} from '../preview-release.mjs';
async function fixture(t,changes={}) {
  const root=await mkdtemp(path.join(tmpdir(),'goat-preview-'));t.after(()=>rm(root,{recursive:true,force:true}));
  const sourceDirectory=path.join(root,'source'),directory=path.join(root,'release');await mkdir(sourceDirectory);
  const content={'index.html':'<title>TEST</title><link rel="stylesheet" href="style.css"><a href="game.html#play">Play</a><script type="module" src="app.mjs"></script><img srcset="small.svg 1x, small.svg 2x"><video poster="small.svg"><source src="clip.webm"></video>',
    'style.css':'body{background:url(small.svg)}','app.mjs':'import "./engine.mjs";new URL("small.svg",import.meta.url);',
    'engine.mjs':'export const fixture=true;','game.html':'<title>TEST GAME</title><main id="play">FIXTURE</main>',
    'small.svg':'<svg xmlns="http://www.w3.org/2000/svg"></svg>','clip.webm':Buffer.from([0,1,2,3]),...changes};
  for(const [file,bytes] of Object.entries(content))if(bytes!==null)await writeFile(path.join(sourceDirectory,file),bytes);
  const result=await prepareStaticRelease({sourceDirectory,outputDirectory:directory,files:Object.keys(content).filter(k=>content[k]!==null)});
  return {directory,expectedManifestSha256:result.manifest_sha256};
}
test('complete HTML, CSS, module, srcset, media and fragment references pass root and prefix audits',async t=>{
  const options=await fixture(t);
  for(const prefix of ['/','/Goat-Universe/']) {const report=await inspectPreview({...options,prefix});assert.equal(report.status,'passed');assert.equal(report.issues.length,0);assert.ok(report.references>=10);}
});
test('missing assets, transitive imports and fragments fail offline without executing scripts',async t=>{
  for(const changes of [{'small.svg':null},{'engine.mjs':null},{'game.html':'<title>TEST</title><p>No target</p>'},{'index.html':'<script>throw new Error("must not execute");fetch("missing.json")</script>'}]) {
    const report=await inspectPreview(await fixture(t,changes));assert.equal(report.status,'failed');assert.ok(report.issues.some(i=>['missing_local_reference','missing_fragment'].includes(i.code)));
  }
});
test('root-relative resources reveal subpath incompatibility and external navigation is inventoried',async t=>{
  const options=await fixture(t,{'index.html':'<img src="/small.svg"><a href="https://example.invalid/?private=not-reported">External</a>'});
  assert.equal((await inspectPreview(options)).status,'passed');
  const report=await inspectPreview({...options,prefix:'/Goat-Universe/'});assert.equal(report.status,'failed');
  assert.ok(report.issues.some(i=>i.code==='reference_escapes_host_prefix'));assert.deepEqual(report.external,['navigation:https://example.invalid']);
});
test('external media, unknown schemes, base and active form navigation require review',async t=>{
  const options=await fixture(t,{'index.html':'<base href="/"><img src="https://example.invalid/image.png"><a href="javascript:void(0)">Bad</a><form action="/private"></form>'});
  const report=await inspectPreview(options);assert.equal(report.status,'failed');
  for(const code of ['external_dependency','unsupported_reference_scheme','base_element_requires_review','active_navigation_requires_review'])assert.ok(report.issues.some(i=>i.code===code));
});
function raw(port,url,headers={}) {return new Promise((resolve,reject)=>{const req=request({hostname:'127.0.0.1',port,path:url,headers},res=>{res.resume();res.on('end',()=>resolve(res.statusCode));});req.on('error',reject);req.end();});}
test('verified preview serves exact public files at root and prefix; denies private files, traversal and foreign Host',async t=>{
  const options=await fixture(t);
  for(const prefix of ['/','/Goat-Universe/']) {
    const server=await createPreviewServer({...options,prefix});await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
    t.after(()=>new Promise(resolve=>{server.closeAllConnections();server.close(resolve);}));const port=server.address().port,base=`http://127.0.0.1:${port}`;
    assert.equal((await fetch(base+prefix)).status,200);
    const js=await fetch(base+prefix+'app.mjs');assert.match(js.headers.get('content-type'),/javascript/);assert.equal(js.headers.get('cache-control'),'no-store');
    assert.equal((await fetch(base+prefix+'small.svg',{method:'HEAD'})).status,200);
    assert.equal((await fetch(base+prefix,{method:'POST'})).status,405);
    for(const url of [prefix+'../index.html',prefix+'%2e%2e/index.html',prefix+'%69ndex.html','/backend/server.mjs',prefix+'goat-release-manifest.json',prefix+'package.json']) assert.equal(await raw(port,url),404,url);
    assert.equal(await raw(port,prefix,{Host:'evil.invalid'}),403);
    const before=await readFile(path.join(options.directory,'index.html'),'utf8');
    await writeFile(path.join(options.directory,'index.html'),'changed after startup');
    assert.equal(await (await fetch(base+prefix)).text(),before);
    await writeFile(path.join(options.directory,'index.html'),before);
  }
});
test('tampered releases and incomplete bundles cannot start a preview',async t=>{
  const broken=await fixture(t,{'engine.mjs':null});await assert.rejects(createPreviewServer(broken),/preview_reference_audit_failed/);
  const options=await fixture(t);await writeFile(path.join(options.directory,'game.html'),'tampered');
  await assert.rejects(createPreviewServer(options),/release_file_digest_mismatch/);
  await assert.rejects(inspectPreview({...options,expectedManifestSha256:'a'.repeat(64)}),/manifest_digest_mismatch/);
});

test('distributed runner starts without node_modules and validates its release before serving',async t=>{
  const options=await fixture(t),tools=path.join(options.directory,'..','portable-tools');await mkdir(path.join(tools,'scripts'),{recursive:true});
  for(const file of ['portable-preview.mjs','static-release.mjs','static-artifact.mjs','scripts/serve-preview-bundle.mjs'])
    await copyFile(new URL('../'+file,import.meta.url),path.join(tools,file));
  const child=spawn(process.execPath,[path.join(tools,'scripts/serve-preview-bundle.mjs'),options.directory,options.expectedManifestSha256,'/Goat-Universe/'],{cwd:tools,stdio:['ignore','pipe','pipe']});
  t.after(()=>{child.kill();});
  const line=await new Promise((resolve,reject)=>{let data='';const timer=setTimeout(()=>reject(new Error('preview_start_timeout')),5000);child.once('error',reject);child.stdout.on('data',chunk=>{data+=chunk;if(data.includes('\n')){clearTimeout(timer);resolve(data.split('\n')[0]);}});});
  const status=JSON.parse(line);assert.equal(status.status,'local_preview_only');assert.equal(status.production_ready,false);
  assert.match(await (await fetch(status.url)).text(),/TEST/);
  assert.equal((await fetch(new URL('app.mjs',status.url))).status,200);
  child.kill();await new Promise(resolve=>child.once('exit',resolve));
});
