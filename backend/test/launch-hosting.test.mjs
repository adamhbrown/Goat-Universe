import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {createServer} from 'node:http';
import {configuration} from '../config.mjs';
const hosted={BACKEND_MODE:'supabase',APP_ENV:'staging',SUPABASE_URL:'https://devfixture.supabase.co',SUPABASE_PUBLISHABLE_KEY:'sb_publishable_FIXTURE',APP_ORIGIN:'https://dev.fixture.invalid'};

test('hosted configuration rejects malformed origins, missing development host, and insecure staging',()=>{
 for(const APP_ORIGIN of ['https://dev.fixture.invalid/path','https://user:pass@dev.fixture.invalid','https://dev.fixture.invalid?token=secret','https://dev.fixture.invalid#token','https://dev.fixture.invalid/','javascript:alert(1)'])
  assert.throws(()=>configuration({...hosted,APP_ORIGIN}),/invalid_app_origin/);
 assert.throws(()=>configuration({...hosted,APP_ORIGIN:undefined}),/hosted_app_origin_required/);
 assert.throws(()=>configuration({...hosted,APP_ORIGIN:'http://dev.fixture.invalid'}),/hosted_https_origin_required/);
 for(const PORT of ['x','0','-1','65536','8.5'])assert.throws(()=>configuration({...hosted,PORT}),/invalid_port/);
 const cfg=configuration({...hosted,NODE_ENV:'production'});
 assert.equal(cfg.appEnv,'staging');assert.equal(cfg.authEmailEnabled,false);assert.equal(cfg.paymentsEnabled,false);
 assert.equal(cfg.appOrigin,'https://dev.fixture.invalid');
 assert.throws(()=>configuration({...hosted,BACKEND_MODE:'local',NODE_ENV:'production'}),/local_auth_forbidden/);
});

function healthProcess(port){
 return new Promise((resolve,reject)=>{
  const child=spawn(process.execPath,['backend/scripts/container-health.mjs'],{cwd:new URL('../../',import.meta.url),env:{...process.env,PORT:String(port)},stdio:['ignore','pipe','pipe']});
  let output='';for(const stream of [child.stdout,child.stderr])stream.on('data',c=>output+=c);
  child.on('error',reject);child.on('exit',code=>resolve({code,output}));
 });
}
test('container probe rejects an unavailable or unmigrated database, and never leaks response bodies',async()=>{
 let body={status:'ok',database_ok:true,schema_version:4};let status=200,requests=0;
 const server=createServer((req,res)=>{requests++;assert.equal(req.method,'GET');assert.equal(req.url,'/health');res.writeHead(status,{'Content-Type':'application/json'});res.end(JSON.stringify(body));});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const port=server.address().port;
 try{
  assert.deepEqual(await healthProcess(port),{code:0,output:''});
  for(const value of [{status:'ok',database_ok:true,schema_version:3},{status:'ok',database_ok:false,schema_version:4},{error:'SECRET_FIXTURE_DO_NOT_LOG'}]){
   body=value;assert.deepEqual(await healthProcess(port),{code:1,output:''});
  }
  status=503;body={status:'ok',database_ok:true,schema_version:4};assert.equal((await healthProcess(port)).code,1);assert.equal(requests,5);
 }finally{await new Promise(r=>server.close(r));}
 assert.deepEqual(await healthProcess(port),{code:1,output:''});
});
