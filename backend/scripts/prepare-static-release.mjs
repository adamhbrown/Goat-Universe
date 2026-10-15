import {lstat,readFile} from 'node:fs/promises';
import {prepareStaticRelease} from '../static-release.mjs';
try {
  if (process.argv.length!==5) throw new Error('source_output_selection_required');
  const [sourceDirectory,outputDirectory,selectionFile]=process.argv.slice(2);
  const stat=await lstat(selectionFile);
  if (!stat.isFile() || stat.isSymbolicLink() || stat.size>32768) throw new Error('invalid_selection_file');
  const files=JSON.parse(await readFile(selectionFile,'utf8'));
  console.log(JSON.stringify(await prepareStaticRelease({sourceDirectory,outputDirectory,files}),null,2));
} catch (error) {
  const diagnosis=/^[a-z][a-z_]+$/.test(error.message)?error.message:'static_export_unavailable';
  console.log(JSON.stringify({status:'blocked',diagnosis})); process.exitCode=2;
}
