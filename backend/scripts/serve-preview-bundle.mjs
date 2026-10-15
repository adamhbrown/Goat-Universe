// Can be distributed with the three adjacent builtin-only verification modules.
import {createVerifiedPreviewServer} from '../portable-preview.mjs';
const [directory,expectedManifestSha256,prefix='/']=process.argv.slice(2);
let server;
try {
  if(!directory||!expectedManifestSha256||process.argv.length>5)throw new Error('directory_and_trusted_digest_required');
  server=await createVerifiedPreviewServer({directory,expectedManifestSha256,prefix});
  await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
  console.log(JSON.stringify({status:'local_preview_only',url:`http://127.0.0.1:${server.address().port}${prefix}`,production_ready:false}));
  for(const signal of ['SIGINT','SIGTERM'])process.once(signal,()=>server.close());
} catch(error) {console.log(JSON.stringify({status:'blocked',diagnosis:/^[a-z_]+$/.test(error.message)?error.message:'preview_unavailable'}));process.exitCode=2;server?.close();}
