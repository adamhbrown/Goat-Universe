import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {createServer} from 'node:http';
import {createHash} from 'node:crypto';
import {MANIFEST,verifyStaticRelease} from './static-release.mjs';

// Dependency-free, localhost-only serving of an already reviewed release.
// Hash verification is integrity evidence, not a claim of safe executable code.
const MIME={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.json':'application/json','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp','.avif':'image/avif','.ico':'image/x-icon','.woff':'font/woff','.woff2':'font/woff2','.mp4':'video/mp4','.webm':'video/webm','.mp3':'audio/mpeg','.ogg':'audio/ogg','.wav':'audio/wav','.txt':'text/plain; charset=utf-8'};
export async function createVerifiedPreviewServer(options) {
  await verifyStaticRelease(options);
  if (!/^\/(?:[A-Za-z0-9_-]+\/)*$/.test(options.prefix||'/')) throw new Error('invalid_preview_prefix');
  const {directory,prefix='/',entry='index.html'}=options;
  const manifest=JSON.parse(await readFile(path.join(directory,MANIFEST),'utf8'));
  // Load only verified public bytes into memory; later disk edits are not served.
  const payloads=new Map();
  for(const file of manifest.files) {
    const body=await readFile(path.join(directory,file.path));
    if(body.length!==file.bytes||createHash('sha256').update(body).digest('hex')!==file.sha256) throw new Error('release_file_digest_mismatch');
    payloads.set(prefix+file.path,{body,type:MIME[path.extname(file.path)]||'application/octet-stream'});
  }
  // Close the read/verify gap under the documented frozen-source assumption.
  await verifyStaticRelease(options);
  return createServer((req,res)=>{
    res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','no-referrer');
    const host=req.headers.host;
    if(!/^127\.0\.0\.1:\d+$/.test(host||'')) {res.writeHead(403);res.end();return;}
    if(!['GET','HEAD'].includes(req.method)) {res.writeHead(405,{Allow:'GET, HEAD'});res.end();return;}
    const raw=req.url.split('?')[0];
    const file=payloads.get(raw===prefix?prefix+entry:raw);
    if(!file) {res.writeHead(404);res.end();return;}
    res.writeHead(200,{'Content-Type':file.type,'Content-Length':file.body.length});res.end(req.method==='HEAD'?undefined:file.body);
  });
}
