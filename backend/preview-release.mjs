import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {createVerifiedPreviewServer} from './portable-preview.mjs';
import {JSDOM} from 'jsdom';
import {MANIFEST,verifyStaticRelease} from './static-release.mjs';

// Deliberately offline: never fetch external destinations or execute page code.
// Covers declarative HTML/CSS and literal JS references; runtime-generated URLs
// still require the separate browser acceptance gate.
export async function inspectPreview({directory,expectedManifestSha256,entry='index.html',prefix='/'}) {
  const verified=await verifyStaticRelease({directory,expectedManifestSha256});
  if (!/^\/(?:[A-Za-z0-9_-]+\/)*$/.test(prefix)) throw new Error('invalid_preview_prefix');
  const manifest=JSON.parse(await readFile(path.join(directory,MANIFEST),'utf8'));
  const files=new Set(manifest.files.map(f=>f.path)), docs=new Map(), refs=[], issues=[], external=new Set();
  if (!files.has(entry) || !entry.endsWith('.html')) throw new Error('preview_entry_missing');
  const add=(file,value,kind='dependency')=>{if(value) refs.push({file,value,kind});};
  function css(file,text) {
    for(const m of text.matchAll(/url\(\s*["']?([^"')\s]+)["']?\s*\)|@import\s+["']([^"']+)["']/gi)) add(file,m[1]||m[2]);
  }
  function js(file,text) {
    for(const pattern of [/\b(?:import|export)\s+(?:[^;\n]*?\s+from\s*)?["']([^"']+)["']/g,
      /\b(?:import|fetch|Worker|SharedWorker)\s*\(\s*["']([^"']+)["']/g,
      /\bnew\s+URL\s*\(\s*["']([^"']+)["']\s*,\s*import\.meta\.url/g])
      for(const m of text.matchAll(pattern)) add(file,m[1]);
  }
  for(const file of files) {
    if(!/\.(html|css|m?js)$/.test(file)) continue;
    const text=await readFile(path.join(directory,file),'utf8');
    if(file.endsWith('.html')) {
      const dom=new JSDOM(text); const doc=dom.window.document; docs.set(file,new Set([...doc.querySelectorAll('[id]')].map(e=>e.id)));
      if(doc.querySelector('base')) issues.push({file,code:'base_element_requires_review'});
      for(const el of doc.querySelectorAll('[src],[href],[poster],[data],[srcset],[style]')) {
        for(const attr of ['src','href','poster','data']) if(el.hasAttribute(attr)) add(file,el.getAttribute(attr),el.localName==='a'&&attr==='href'?'navigation':'dependency');
        if(el.hasAttribute('srcset')) {
          // Commas in data URLs make generic splitting ambiguous. Fail closed.
          if(el.getAttribute('srcset').includes('data:')) issues.push({file,code:'data_srcset_requires_review'});
          else for(const item of el.getAttribute('srcset').split(',')) add(file,item.trim().split(/\s+/)[0]);
        }
        if(el.hasAttribute('style')) css(file,el.getAttribute('style'));
      }
      for(const el of doc.querySelectorAll('style')) css(file,el.textContent);
      for(const el of doc.querySelectorAll('script:not([src])')) if(!el.type||el.type==='module'||el.type==='text/javascript') js(file,el.textContent);
      if(doc.querySelector('form[action],meta[http-equiv="refresh"],iframe[srcdoc]')) issues.push({file,code:'active_navigation_requires_review'});
      dom.window.close();
    } else if(file.endsWith('.css')) css(file,text); else js(file,text);
  }
  const origin='http://preview.invalid';
  for(const {file,value,kind} of refs) {
    if(value.startsWith('#') && !file.endsWith('.html')) continue;
    let url; try {url=new URL(value,origin+prefix+file);} catch {issues.push({file,code:'invalid_reference'});continue;}
    if(['data:','mailto:','tel:'].includes(url.protocol)) continue;
    if(!['http:','https:'].includes(url.protocol)) {issues.push({file,code:'unsupported_reference_scheme'});continue;}
    if(url.origin!==origin) {
      // Report host only: don't leak query strings, signed URLs or credentials.
      external.add(kind+':'+url.origin);
      if(kind!=='navigation') issues.push({file,code:'external_dependency'});
      continue;
    }
    if(!url.pathname.startsWith(prefix)) {issues.push({file,code:'reference_escapes_host_prefix'});continue;}
    let target;try {target=decodeURIComponent(url.pathname.slice(prefix.length));} catch {issues.push({file,code:'invalid_reference_encoding'});continue;}
    if(!target || target.endsWith('/')) target+='index.html';
    if(!files.has(target)) {issues.push({file,target,code:'missing_local_reference'});continue;}
    if(kind==='navigation'&&url.hash&&docs.has(target)) {
      let fragment;try {fragment=decodeURIComponent(url.hash.slice(1));}catch{fragment='';}
      if(!docs.get(target).has(fragment)) issues.push({file,target,code:'missing_fragment'});
    }
  }
  return {...verified,status:issues.length?'failed':'passed',entry,prefix,references:refs.length,issues,external:[...external].sort(),
    scope:'Offline declarative and literal-reference audit; runtime/browser behavior and external reachability remain unverified.'};
}

export async function createPreviewServer(options) {
  const report=await inspectPreview(options);
  if(report.status!=='passed')throw new Error('preview_reference_audit_failed');
  return createVerifiedPreviewServer(options);
}
