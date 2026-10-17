import {mkdtemp,mkdir,readFile,writeFile,rm,realpath} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {prepareStaticRelease} from './static-release.mjs';
import {inspectPreview} from './preview-release.mjs';
export const FOUNDER_FILES=Object.freeze(['index.html','goatville.html','goatville-city.html','goat-games-play-lab.html',
  'assets/fonts/inter-latin.woff','assets/fonts/manrope-latin.woff','assets/fonts/Inter-OFL.txt','assets/fonts/Manrope-OFL.txt']);
const fontFaces="@font-face{font-family:Manrope;src:url('assets/fonts/manrope-latin.woff') format('woff');font-style:normal;font-weight:200 800;font-display:swap}@font-face{font-family:Inter;src:url('assets/fonts/inter-latin.woff') format('woff');font-style:normal;font-weight:100 900;font-display:swap}";
// Specific reviewable recipe, not an arbitrary repository crawler or bundler.
// Source is staged through the existing symlink/size/private-file gate first.
export async function prepareFounderPreview({sourceDirectory,outputDirectory}) {
  const sourceRoot=await realpath(sourceDirectory);
  const output=path.join(await realpath(path.dirname(path.resolve(outputDirectory))),path.basename(path.resolve(outputDirectory)));
  const relative=path.relative(sourceRoot,output);
  if(relative===''||(!relative.startsWith('..'+path.sep)&&relative!=='..'&&!path.isAbsolute(relative)))throw new Error('output_must_be_outside_source');
  const temp=await mkdtemp(path.join(tmpdir(),'goat-founder-build-'));
  let owned=false;
  try {
    const staging=path.join(temp,'source');await mkdir(staging);
    // Read only the exact eight public files; source symlinks are rejected.
    const {lstat}=await import('node:fs/promises');
    const rootStat=await lstat(sourceDirectory);if(!rootStat.isDirectory()||rootStat.isSymbolicLink())throw new Error('regular_directory_required');
    const sourceHashes=[],changes=[];let total=0;
    for(const file of FOUNDER_FILES) {
      let current=sourceDirectory;
      for(const [i,part] of file.split('/').entries()) {current=path.join(current,part);const stat=await lstat(current);
        if(stat.isSymbolicLink()||(i===file.split('/').length-1?!stat.isFile():!stat.isDirectory()))throw new Error('non_regular_source_path');}
      const stat=await lstat(current);if(stat.size>4194304||(total+=stat.size)>12582912)throw new Error('source_size_budget_exceeded');
      let bytes=await readFile(current);if(bytes.length!==stat.size)throw new Error('source_changed_during_export');
      sourceHashes.push({path:file,sha256:createHash('sha256').update(bytes).digest('hex')});
      if(file.endsWith('.html')) {
        const text=bytes.toString('utf8');let count=0;
        const replaced=text.replace(/@import\s+url\(['"]https:\/\/fonts\.googleapis\.com\/css2\?family=Inter:wght@[0-9;]+&family=Manrope:wght@[0-9;]+&display=swap['"]\);/g,()=>{count++;return fontFaces;});
        if(count>1)throw new Error('unexpected_font_import_count');
        if(count){bytes=Buffer.from(replaced);changes.push({file,change:'google_font_import_to_bundled_font_faces'});}
      }
      await mkdir(path.dirname(path.join(staging,file)),{recursive:true});await writeFile(path.join(staging,file),bytes);
    }
    const result=await prepareStaticRelease({sourceDirectory:staging,outputDirectory,files:FOUNDER_FILES});owned=true;
    const checks=[];
    for(const prefix of ['/','/Goat-Universe/']) checks.push(await inspectPreview({directory:outputDirectory,expectedManifestSha256:result.manifest_sha256,prefix}));
    if(checks.some(r=>r.status!=='passed')) {const error=new Error('founder_preview_references_failed');error.reports=checks;throw error;}
    return {...result,status:'prepared_local_preview',source_files:sourceHashes,transformations:changes,checks,production_ready:false};
  } catch(error) {if(owned)await rm(outputDirectory,{recursive:true,force:true});throw error;}
  finally {await rm(temp,{recursive:true,force:true});}
}
