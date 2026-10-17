import {createHash} from 'node:crypto';
import {lstat, mkdir, readFile, readdir, realpath, rm, writeFile} from 'node:fs/promises';
import path from 'node:path';
import {auditStaticArtifact} from './static-artifact.mjs';

export const MANIFEST = 'goat-release-manifest.json';
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const fail = code => { throw new Error(code); };
const digest = value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
const exact = (value,keys) => value && typeof value === 'object' && !Array.isArray(value) &&
  Object.keys(value).sort().join('|') === keys.slice().sort().join('|');
const validPath = value => typeof value === 'string' && value.length <= 240 &&
  /^[A-Za-z0-9_-][A-Za-z0-9._/-]*$/.test(value) &&
  value.split('/').every(part => part && part !== '.' && part !== '..' && !part.startsWith('.')) &&
  value.split('/').length <= 9 && value.toLowerCase() !== MANIFEST;
const inside = (root,target) => { const rel=path.relative(root,target); return rel === '' || (!rel.startsWith('..'+path.sep) && rel !== '..' && !path.isAbsolute(rel)); };

async function directoryRoot(input) {
  const stat=await lstat(input);
  if (!stat.isDirectory() || stat.isSymbolicLink()) fail('regular_directory_required');
  return realpath(input);
}
async function regularFile(root,relative) {
  const parts=relative.split('/'); let current=root;
  for (let i=0;i<parts.length;i++) {
    current=path.join(current,parts[i]);
    const stat=await lstat(current);
    if (stat.isSymbolicLink() || (i===parts.length-1 ? !stat.isFile() : !stat.isDirectory())) fail('non_regular_source_path');
  }
  return current;
}
function selectedPaths(files) {
  if (!Array.isArray(files) || !files.length || files.length>499 || files.some(file => !validPath(file))) fail('invalid_public_file_selection');
  const sorted=[...files].sort();
  if (new Set(sorted.map(file => file.toLowerCase())).size!==sorted.length) fail('duplicate_public_path');
  return sorted;
}

/** Build a NEW private local directory from explicit relative file selections.
 * Never overwrites an output, follows source symlinks, mutates source files,
 * contacts a host, or authorizes release. A frozen source checkout is required;
 * this is not a defense against a hostile process changing files concurrently.
 */
export async function prepareStaticRelease({sourceDirectory,outputDirectory,files}) {
  const selected=selectedPaths(files), source=await directoryRoot(sourceDirectory);
  const output=path.join(await realpath(path.dirname(path.resolve(outputDirectory))),path.basename(path.resolve(outputDirectory)));
  if (inside(source,output)) fail('output_must_be_outside_source');
  const buffers=[]; let total=0;
  for (const file of selected) {
    const absolute=await regularFile(source,file), stat=await lstat(absolute);
    if (stat.size>4194304 || (total+=stat.size)>12582912) fail('source_size_budget_exceeded');
    const bytes=await readFile(absolute);
    if (bytes.length!==stat.size) fail('source_changed_during_export');
    buffers.push({path:file,bytes});
  }
  let owned=false;
  try {
    // Exclusive mkdir: an existing file, directory or symlink must be preserved.
    await mkdir(output,{mode:0o700}); owned=true;
    for (const file of buffers) {
      await mkdir(path.dirname(path.join(output,file.path)),{recursive:true,mode:0o700});
      await writeFile(path.join(output,file.path),file.bytes,{flag:'wx',mode:0o600});
    }
    const firstAudit=await auditStaticArtifact(output);
    if (firstAudit.status!=='passed') fail('public_export_audit_failed');
    const manifest={schema_version:1,files:buffers.map(file => ({path:file.path,bytes:file.bytes.length,sha256:sha256(file.bytes)}))};
    const manifestBytes=Buffer.from(JSON.stringify(manifest)+'\n');
    await writeFile(path.join(output,MANIFEST),manifestBytes,{flag:'wx',mode:0o600});
    const expected=sha256(manifestBytes);
    const verified=await verifyStaticRelease({directory:output,expectedManifestSha256:expected});
    return {...verified,manifest_sha256:expected};
  } catch (error) {
    if (owned) await rm(output,{recursive:true,force:true});
    // Do not propagate raw OS errors that might contain private paths.
    if (error.code==='EEXIST') fail('output_already_exists');
    if (/^[a-z][a-z_]+$/.test(error.message)) throw error;
    fail('static_export_unavailable');
  }
}

/** Requires a digest obtained from a separate trusted review record. A manifest
 * stored beside its files proves consistency only; it is not a digital signature.
 */
export async function verifyStaticRelease({directory,expectedManifestSha256}) {
  if (!digest(expectedManifestSha256)) fail('trusted_manifest_digest_required');
  const root=await directoryRoot(directory);
  const manifestFile=await regularFile(root,MANIFEST);
  if ((await lstat(manifestFile)).size>262144) fail('manifest_size_exceeded');
  const raw=await readFile(manifestFile);
  if (sha256(raw)!==expectedManifestSha256) fail('manifest_digest_mismatch');
  let manifest;
  try { manifest=JSON.parse(raw.toString('utf8')); } catch { fail('invalid_release_manifest'); }
  if (!exact(manifest,['schema_version','files']) || manifest.schema_version!==1 ||
      !Array.isArray(manifest.files) || !manifest.files.length || manifest.files.length>499 ||
      manifest.files.some(file => !exact(file,['path','bytes','sha256']) || !validPath(file.path) ||
        !Number.isSafeInteger(file.bytes) || file.bytes<0 || file.bytes>4194304 || !digest(file.sha256))) fail('invalid_release_manifest');
  const expected=selectedPaths(manifest.files.map(file => file.path));
  if (expected.some((name,i)=>name!==manifest.files[i].path)) fail('manifest_paths_not_canonical');
  const audit=await auditStaticArtifact(root);
  if (audit.status!=='passed') fail('public_export_audit_failed');
  const actual=[];
  async function list(relative='') {
    for (const entry of await readdir(path.join(root,relative),{withFileTypes:true})) {
      const name=relative ? relative+'/'+entry.name : entry.name;
      if (entry.isDirectory()) await list(name); else actual.push(name);
    }
  }
  await list(); actual.sort();
  const expectedFiles=[...expected,MANIFEST].sort();
  if (JSON.stringify(actual)!==JSON.stringify(expectedFiles)) fail('release_file_set_mismatch');
  for (const file of manifest.files) {
    const bytes=await readFile(await regularFile(root,file.path));
    if (bytes.length!==file.bytes || sha256(bytes)!==file.sha256) fail('release_file_digest_mismatch');
  }
  return {status:'verified',files:manifest.files.length,bytes:manifest.files.reduce((sum,file)=>sum+file.bytes,0),
    manifest_sha256:expectedManifestSha256};
}
