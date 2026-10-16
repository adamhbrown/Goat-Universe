import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp, mkdir, writeFile, symlink, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {auditStaticArtifact} from '../static-artifact.mjs';

async function fixture(t, files) {
  const root=await mkdtemp(path.join(tmpdir(),'goat-public-export-'));
  t.after(() => rm(root,{recursive:true,force:true}));
  for (const [name,body] of Object.entries(files)) { await mkdir(path.dirname(path.join(root,name)),{recursive:true}); await writeFile(path.join(root,name),body); }
  return root;
}

test('static export allows a small self-contained public bundle',async t => {
  const root=await fixture(t,{'index.html':'<!doctype html><title>GOATVILLE</title><script src="game.js"></script>','game.js':'console.log("guest")','assets/font.woff2':Buffer.alloc(20)});
  const report=await auditStaticArtifact(root); assert.equal(report.status,'passed'); assert.equal(report.files,3);
});
test('static export rejects backend, environment, database, build metadata and source maps',async t => {
  const root=await fixture(t,{'index.html':'ok','backend/server.mjs':'private','supabase/config.toml':'private','.env':'private','package-lock.json':'{}','app.js.map':'{}','archive.zip':'private','docs/internal.md':'private'});
  const report=await auditStaticArtifact(root); assert.equal(report.status,'failed');
  assert.equal(report.issues.length,7); assert.ok(report.issues.every(x=>x.code==='private_path_forbidden'));
});
test('static export detects privileged credentials without returning secret excerpts',async t => {
  // Synthetic tokens generated here; these cannot authenticate to any service.
  const secret='sb_secret_'+'x'.repeat(30);
  const jwt='eyJhbGciOiJIUzI1NiJ9.'+Buffer.from(JSON.stringify({role:'service_role'})).toString('base64url')+'.'+ 'x'.repeat(30);
  const root=await fixture(t,{'index.html':secret,'game.js':jwt,'config.json':'postgresql://fixture:fake-password@invalid.test/db'});
  const report=await auditStaticArtifact(root); assert.equal(report.issues.length,3);
  assert.ok(report.issues.every(x=>x.code==='credential_pattern_detected'));
  assert.ok(!JSON.stringify(report).includes(secret)); assert.ok(!JSON.stringify(report).includes(jwt));
});
test('static export rejects symlinks and external active code dependencies',async t => {
  const root=await fixture(t,{'index.html':'<script src=https://cdn.invalid/code.js></script>','style.css':'@import url(//fonts.invalid/font.css);','remote.mjs':'import x from "https://cdn.invalid/code.mjs"'});
  await symlink('/etc/passwd',path.join(root,'escape.txt'));
  const report=await auditStaticArtifact(root); assert.equal(report.issues.length,4);
  assert.ok(report.issues.some(x=>x.code==='non_regular_path_forbidden'));
});
test('static export enforces per-file, aggregate-code, count and depth budgets',async t => {
  const root=await fixture(t,{'index.html':'x'.repeat(262145),'a.js':'x'.repeat(200000),'b.js':'x'.repeat(200000),'c.js':'x'.repeat(200000),'large.mp4':Buffer.alloc(4194305),[('a/').repeat(9)+'deep.txt']:'no'});
  const report=await auditStaticArtifact(root);
  assert.ok(report.issues.some(x=>x.code==='file_budget_exceeded'));
  assert.ok(report.issues.some(x=>x.code==='initial_code_budget_exceeded'));
  assert.ok(report.issues.some(x=>x.code==='directory_depth_exceeded'));
  const many=await fixture(t,Object.fromEntries(Array.from({length:501},(_,i)=>[`${i}.txt`,'x'])));
  assert.ok((await auditStaticArtifact(many)).issues.some(x=>x.code==='artifact_budget_exceeded'));
});
test('static export fails closed on empty bundles and unknown types',async t => {
  assert.equal((await auditStaticArtifact(await fixture(t,{}))).status,'failed');
  const report=await auditStaticArtifact(await fixture(t,{'index.html':'ok','payload.bin':'no'}));
  assert.ok(report.issues.some(x=>x.code==='file_type_forbidden'));
});
