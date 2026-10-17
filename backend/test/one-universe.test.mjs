import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {application} from '../server.mjs';
const digest=b=>createHash('sha256').update(b).digest('hex');
const root=new URL('../../',import.meta.url);
const files=JSON.parse(await readFile(new URL('../public-files.json',import.meta.url),'utf8'));
async function start(localPath,publicSiteEnabled=true) {
 const app=await application({mode:'local',appEnv:'development',localPath,appOrigin:'http://fixture.invalid',paymentsEnabled:false,authEmailEnabled:false,publicSiteEnabled,tiers:{}});
 await new Promise(resolve=>app.server.listen(0,'127.0.0.1',resolve));
 const base=`http://127.0.0.1:${app.server.address().port}`;
 return {app,base,async stop(){app.server.closeAllConnections();await app.close();}};
}
test('private workspaces retain GST assets while visitor publishing is off',async t=>{
 const h=await start(undefined,false);t.after(()=>h.stop());
 assert.equal((await fetch(h.base+'/')).status,404);
 for(const [file,type] of [['gst-clock.js','text/javascript'],['gst-clock.css','text/css']]) {
  const response=await fetch(h.base+'/experience/'+file);assert.equal(response.status,200);
  assert.ok(response.headers.get('content-type').startsWith(type));
  assert.equal((await fetch(h.base+'/experience/'+file,{method:'HEAD'})).status,200);
 }
 for(const file of ['universe-shell.js','../backend/server.mjs','%67st-clock.js'])assert.equal((await fetch(h.base+'/experience/'+file)).status,404,file);
});
test('one entry point serves every explicitly public payload, preserves media bytes/ranges and denies repository files',async t=>{
 const h=await start();t.after(()=>h.stop());
 for(const file of files) {
  assert.doesNotMatch(file,/^(backend|supabase|docs|tests|node_modules)\/|package\.json/);
  const response=await fetch(h.base+'/'+file);assert.equal(response.status,200,file);
  assert.equal(digest(Buffer.from(await response.arrayBuffer())),digest(await readFile(new URL(file,root))),file);
 }
 const home=await fetch(h.base+'/');assert.equal(home.status,200);const html=await home.text();
 for(const link of ['href="/games"','href="/manage"','goatville-city.html','goatville-stadium.html','goatville-cinema.html'])assert.ok(html.includes(link),link);
 const csp=home.headers.get('content-security-policy');assert.doesNotMatch(csp,/script-src[^;]*unsafe-inline/);
 for(const [,attrs,code] of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi))if(!/\ssrc\s*=/.test(attrs))assert.ok(csp.includes("'sha256-"+createHash('sha256').update(code).digest('base64')+"'"));
 for(const privatePath of ['/package.json','/.env','/backend/server.mjs','/supabase/migrations/20261014000100_foundations.sql','/assets/package.json','/.local/one-universe','/docs/CONTROLLED_REMEDIATION_20261015.md'])assert.equal((await fetch(h.base+privatePath)).status,404,privatePath);
 const media='/assets/goatville/official-theme.mp4',bytes=await readFile(new URL(media.slice(1),root));
 const part=await fetch(h.base+media,{headers:{Range:'bytes=0-31'}});assert.equal(part.status,206);assert.deepEqual(Buffer.from(await part.arrayBuffer()),bytes.subarray(0,32));
 const suffix=await fetch(h.base+media,{headers:{Range:'bytes=-16'}});assert.equal(suffix.status,206);assert.deepEqual(Buffer.from(await suffix.arrayBuffer()),bytes.subarray(-16));
 assert.equal((await fetch(h.base+media,{headers:{Range:'bytes=99999999-'}})).status,416);
 assert.equal((await fetch(h.base+media,{method:'HEAD'})).headers.get('content-length'),String(bytes.length));
 assert.match((await fetch(h.base+'/guest/field-vision.html')).headers.get('content-security-policy'),/frame-ancestors 'self'/);
 assert.match((await fetch(h.base+'/goatville-field-vision.html')).headers.get('content-security-policy'),/frame-ancestors 'none'/);
 for(const route of ['/games','/manage','/bullpen'])assert.equal((await fetch(h.base+route)).status,200,route);
});
test('integrated accounts and all five game drafts persist across disk restart without granting founder privileges',async t=>{
 const temp=await mkdtemp(path.join(tmpdir(),'one-universe-persistence-'));let h=await start(path.join(temp,'db'));
 t.after(async()=>{await h?.stop();await rm(temp,{recursive:true,force:true});});
 const post=async(route,body,token)=>{const response=await fetch(h.base+route,{method:'POST',headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},body:JSON.stringify(body)});return {status:response.status,data:await response.json()};};
 const account={email:'one-universe@fixture.invalid',password:'ONE-Universe-Local-Test-Password-1234',display_name:'INTEGRATION TEST'};
 assert.equal((await post('/query',{op:'competition_dashboard'})).status,401);
 assert.equal((await post('/auth/signup',account)).status,201);
 let token=(await post('/auth/login',account)).data.access_token;assert.ok(token);
 const catalog=await(await fetch(h.base+'/goat-games')).json();assert.equal(catalog.games.length,5);
 for(const game of catalog.games) {
  const result=await post('/commands',{op:'game_draft_create',game_key:game.id,name:game.name+' INTEGRATION TEST',season:'2027'},token);assert.equal(result.status,200,game.id);
 }
 const before=(await post('/query',{op:'competition_dashboard'},token)).data;
 assert.equal(before.competitions.length,5);assert.ok(before.competitions.every(c=>c.leagues.length===1));
 assert.deepEqual((await post('/query',{op:'me'},token)).data.roles,[]);
 assert.equal((await post('/bullpen/query',{op:'snapshot'},token)).status,403);
 assert.equal((await post('/billing/checkout',{tier:'member'},token)).data.error,'payments_not_enabled');
 await h.stop();h=await start(path.join(temp,'db'));
 token=(await post('/auth/login',account)).data.access_token;assert.ok(token);
 const after=(await post('/query',{op:'competition_dashboard'},token)).data;
 assert.deepEqual(after.competitions.map(c=>c.leagues.map(l=>l.id)),before.competitions.map(c=>c.leagues.map(l=>l.id)));
 const counts=(await h.app.db.db.query('select (select count(*)::int from public.goat_audit) as audit,(select count(*)::int from public.goat_leagues) as leagues')).rows[0];
 assert.equal(counts.leagues,5);assert.ok(counts.audit>=5);
 const health=await(await fetch(h.base+'/health')).json();assert.equal(health.database,'local');assert.equal(health.payments_enabled,false);assert.equal(health.auth_email_enabled,false);
});
