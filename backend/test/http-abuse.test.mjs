import test, {before,after} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {application} from '../server.mjs';
import {configuration} from '../config.mjs';

let app,dir,base;
before(async()=>{
  dir=await mkdtemp(join(tmpdir(),'goat-api-security-'));
  app=await application({...configuration({}),localPath:join(dir,'db')});
  await new Promise((resolve,reject)=>{
    app.server.once('error',reject);
    app.server.listen(0,'127.0.0.1',resolve);
  });
  base='http://127.0.0.1:'+app.server.address().port;
});
after(async()=>{
  if(app)await app.close();
  if(dir)await rm(dir,{recursive:true,force:true});
});
async function post(path,body,headers={}) {
  const res=await fetch(base+path,{method:'POST',headers:{'Content-Type':'application/json',...headers},
    body:typeof body==='string'?body:JSON.stringify(body)});
  return {status:res.status,body:await res.json()};
}
test('backend enforces no-cache and anti-cross-site origin guard before serving private interfaces',async()=>{
  for(const path of ['/games','/manage','/crm','/goat-games','/health']){
    const rejected=await fetch(base+path,{headers:{Origin:'https://attacker.example'}});
    assert.equal(rejected.status,403,path);
    assert.equal((await rejected.json()).error,'origin_denied');
    assert.equal(rejected.headers.get('Cache-Control'),'no-store');
    assert.match(rejected.headers.get('Content-Security-Policy'),/frame-ancestors 'none'/);
  }
  const denied=await post('/query',{op:'me'},{Origin:'https://attacker.example'});
  assert.equal(denied.status,403);
  assert.equal(denied.body.error,'origin_denied');
});

test('non-JSON submissions, anonymous queries and oversized inputs fail closed',async()=>{
  const form=await fetch(base+'/query',{method:'POST',
    headers:{'Content-Type':'application/x-www-form-urlencoded'},body:'op=me'});
  assert.equal(form.status,415);
  assert.equal((await form.json()).error,'json_required');
  const anonymous=await post('/query',{op:'me'});
  assert.equal(anonymous.status,401);
  assert.equal(anonymous.body.error,'authentication_required');
  const large=await post('/query',{op:'me',padding:'x'.repeat(40000)});
  assert.equal(large.status,413);
  assert.equal(large.body.error,'request_too_large');
  assert.equal(await(await fetch(base+'/')).status,404);
});

test('auth flood cannot evade the ten-attempt socket cap by spoofing forwarded addresses',async()=>{
  for(let i=0;i<10;i++){
    const attempt=await post('/auth/login',{email:'not-an-email',password:'x'},
      {'X-Forwarded-For':'203.0.113.'+(i+1)});
    assert.equal(attempt.status,400,'attempt '+i);
    assert.equal(attempt.body.error,'invalid_email');
  }
  const blocked=await post('/auth/login',{email:'not-an-email',password:'x'},
    {'X-Forwarded-For':'198.51.100.14'});
  assert.equal(blocked.status,429);
  assert.equal(blocked.body.error,'rate_limit');
  // Public read-only content stays available when credential attempts are throttled.
  const catalog=await fetch(base+'/goat-games');
  assert.equal(catalog.status,200);
  assert.equal((await catalog.json()).competition_count,5);
  // No account data or credential values in throttling response.
  assert.deepEqual(blocked.body,{error:'rate_limit'});
});
