import {prepareFounderPreview} from '../founder-preview.mjs';
try {
  if(process.argv.length!==4)throw new Error('source_and_new_output_required');
  console.log(JSON.stringify(await prepareFounderPreview({sourceDirectory:process.argv[2],outputDirectory:process.argv[3]}),null,2));
} catch(error) {
  console.log(JSON.stringify({status:'blocked',diagnosis:/^[a-z_]+$/.test(error.message)?error.message:'founder_preview_unavailable',checks:error.reports}));process.exitCode=2;
}
