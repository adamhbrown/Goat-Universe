import {verifyStaticRelease} from '../static-release.mjs';
try {
  if (process.argv.length!==4) throw new Error('directory_and_trusted_digest_required');
  console.log(JSON.stringify(await verifyStaticRelease({directory:process.argv[2],expectedManifestSha256:process.argv[3]}),null,2));
} catch (error) {
  const diagnosis=/^[a-z][a-z_]+$/.test(error.message)?error.message:'release_verification_unavailable';
  console.log(JSON.stringify({status:'failed',diagnosis})); process.exitCode=1;
}
