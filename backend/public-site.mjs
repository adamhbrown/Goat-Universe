import {readFile,lstat} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
const files=JSON.parse(await readFile(new URL('./public-files.json',import.meta.url),'utf8'));
const publicFiles=new Set(files);
const mime={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.json':'application/json','.woff':'font/woff','.woff2':'font/woff2','.jpg':'image/jpeg','.png':'image/png','.svg':'image/svg+xml','.mp4':'video/mp4','.webm':'video/webm','.mp3':'audio/mpeg','.ogg':'audio/ogg','.txt':'text/plain; charset=utf-8'};
export async function publicSiteAsset(req,res,baseHeaders) {
  const raw=req.url.split('?')[0],file=raw==='/'?'arrival-experience.html':raw.slice(1);
  // Exact, reviewed paths only; never interpret encoded aliases or directories.
  if(!raw.startsWith('/')||!publicFiles.has(file))return false;
  if(!['GET','HEAD'].includes(req.method)){res.writeHead(405,{...baseHeaders,Allow:'GET, HEAD'});res.end();return true;}
  let current=root;
  for(const part of file.split('/')) {current=path.join(current,part);if((await lstat(current)).isSymbolicLink())throw new Error('public_symlink_forbidden');}
  const stat=await lstat(current);if(!stat.isFile()||stat.size>4194304)throw new Error('public_file_unavailable');
  const bytes=await readFile(current),extension=path.extname(file),headers={...baseHeaders,'Content-Type':mime[extension]||'application/octet-stream'};
  if(extension==='.html') {
    const hashes=[...bytes.toString('utf8').matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)].filter(m=>!/[\s]src\s*=/.test(m[1])).map(m=>"'sha256-"+createHash('sha256').update(m[2]).digest('base64')+"'");
    const ancestors=file.startsWith('guest/')?"'self'":"'none'";
    headers['Content-Security-Policy']="default-src 'none'; script-src 'self' "+hashes.join(' ')+"; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self'; media-src 'self' blob:; frame-src 'self'; connect-src 'self'; frame-ancestors "+ancestors+"; base-uri 'none'; form-action 'self'; object-src 'none'";
  }
  headers['Content-Length']=bytes.length;
  if(['.mp4','.webm','.mp3','.ogg'].includes(extension)) {
    headers['Accept-Ranges']='bytes';
    if(req.headers.range) {
      const match=/^bytes=(\d*)-(\d*)$/.exec(req.headers.range);
      let start,end;
      if(match&&(match[1]||match[2])) {
        if(match[1]){start=Number(match[1]);end=match[2]?Math.min(Number(match[2]),bytes.length-1):bytes.length-1;}
        else {const suffix=Number(match[2]);start=Math.max(0,bytes.length-suffix);end=bytes.length-1;}
      }
      if(!Number.isSafeInteger(start)||!Number.isSafeInteger(end)||start<0||start>end||start>=bytes.length) {
        res.writeHead(416,{...headers,'Content-Length':0,'Content-Range':`bytes */${bytes.length}`});res.end();return true;
      }
      headers['Content-Range']=`bytes ${start}-${end}/${bytes.length}`;headers['Content-Length']=end-start+1;
      res.writeHead(206,headers);res.end(req.method==='HEAD'?undefined:bytes.subarray(start,end+1));return true;
    }
  }
  res.writeHead(200,headers);res.end(req.method==='HEAD'?undefined:bytes);return true;
}
