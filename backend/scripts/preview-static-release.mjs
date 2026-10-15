import {inspectPreview,createPreviewServer} from '../preview-release.mjs';
const [mode,directory,expectedManifestSha256,prefix='/']=process.argv.slice(2);
let server;
try {
  if(!['check','serve'].includes(mode)||!directory||!expectedManifestSha256||process.argv.length>6) throw new Error('preview_arguments_required');
  const options={directory,expectedManifestSha256,prefix};
  if(mode==='check') {const report=await inspectPreview(options);console.log(JSON.stringify(report,null,2));if(report.status!=='passed')process.exitCode=1;}
  else {
    server=await createPreviewServer(options);
    await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
    console.log(JSON.stringify({status:'local_preview_only',url:`http://127.0.0.1:${server.address().port}${prefix}`,production_ready:false}));
    for(const signal of ['SIGINT','SIGTERM'])process.once(signal,()=>server.close());
  }
} catch(error) {console.log(JSON.stringify({status:'blocked',diagnosis:/^[a-z_]+$/.test(error.message)?error.message:'preview_unavailable'}));process.exitCode=2;server?.close();}
