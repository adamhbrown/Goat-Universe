// Read-only local integration candidate audit. Never runs migrations or HTTP calls.
// Checks artifact presence, script conflicts and source migration digests.
// A pass on these items is never staging approval, hosting proof or AI connectivity.
import {readFile,readdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';

const root=new URL('../../',import.meta.url);
const files=Object.freeze({
  bullpen:Object.freeze([
    'backend/bullpen/index.html',
    'backend/bullpen/ui.mjs',
    'backend/bullpen/client.mjs',
    'backend/bullpen/routes.mjs',
    'backend/bullpen/readiness.mjs',
    'backend/scripts/check-bullpen-readiness.mjs',
    'backend/test/bullpen-readiness.test.mjs',
    'supabase/migrations/20261014221554_bullpen_private_boardroom.sql'
  ]),
  staging:Object.freeze([
    'backend/staging-infrastructure.mjs',
    'backend/scripts/check-staging-infrastructure.mjs',
    'backend/test/staging-infrastructure.test.mjs',
    '.github/workflows/supabase-development-apply.yml',
    'docs/HOSTED_DEVELOPMENT.md'
  ]),
  host:Object.freeze([
    'Dockerfile',
    'backend/deployment-target.mjs',
    'backend/scripts/container-health.mjs'
  ])
});
const safeMigration=/^supabase\/migrations\/[0-9]{14}_[a-z0-9_]+\.sql$/;
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const pathUrl=path=>new URL(path,root);
const read=path=>readFile(pathUrl(path));
const list=()=>readdir(pathUrl('supabase/migrations/'));

export async function auditBullpenCandidate({readSource=read,listMigrationFiles=list}={}) {
  const checks=[];
  const add=(name,state,detail)=>checks.push({name,state,...(detail?{detail}:{})});
  const cache=new Map();
  async function get(path){
    if(cache.has(path))return cache.get(path);
    try{
      const value=await readSource(path);
      const bytes=Buffer.isBuffer(value)?value:Buffer.from(value);
      if(bytes.length>4*1024*1024)throw new Error('too_large');
      const result={exists:true,bytes};
      cache.set(path,result);
      return result;
    }catch{
      const result={exists:false};
      cache.set(path,result);
      return result;
    }
  }
  for(const [group,items] of Object.entries(files)) {
    const missing=[];
    for(const file of items)if(!(await get(file)).exists)missing.push(file);
    add(group+'_required_artifacts',missing.length?'missing':'present',missing.length?missing.join(', '):undefined);
  }

  const rawManifest=await get('docs/BULLPEN_DEPLOYMENT_REVIEW_20261015.json');
  let manifest=null;
  try{
    if(rawManifest.exists)manifest=JSON.parse(rawManifest.bytes.toString('utf8'));
  }catch{manifest=null;}
  if(!manifest||manifest.source_prototype_commit!=='c8b120dfc0f81bcc480408d6eee914893bd6ad84'||
    !Array.isArray(manifest.prototype_migrations)||manifest.prototype_migrations.length!==5){
    add('prototype_manifest','missing_or_invalid');
  }else{
    const seen=new Set();
    let badFormat=false,missing=0,diverged=0;
    for(const entry of manifest.prototype_migrations){
      if(!entry||typeof entry.file!=='string'||!safeMigration.test(entry.file)||
         typeof entry.sha256!=='string'||!/^[a-f0-9]{64}$/.test(entry.sha256)||
         seen.has(entry.file)){badFormat=true;continue;}
      seen.add(entry.file);
      const source=await get(entry.file);
      if(!source.exists)missing++;
      else if(hash(source.bytes)!==entry.sha256)diverged++;
    }
    add('prototype_migration_hashes',
      badFormat?'invalid':missing?'missing':diverged?'changed_review_required':'match',
      badFormat?'Manifest contains invalid or duplicate migration path':
      missing?missing+' reviewed SQL file(s) missing':
      diverged?diverged+' reviewed SQL file(s) changed':undefined);
    try{
      const present=await listMigrationFiles();
      if(!Array.isArray(present))throw new Error();
      const unknown=present.filter(name=>/\.sql$/.test(name)&&!seen.has('supabase/migrations/'+name));
      add('extra_migrations',unknown.length?'review_required':'none',unknown.length?unknown.join(', '):undefined);
    }catch{add('extra_migrations','not_verified');}
  }

  const packageFile=await get('package.json');
  if(packageFile.exists) {
    try{
      const pkg=JSON.parse(packageFile.bytes.toString('utf8'));
      const required=['check:bullpen','check:staging-infrastructure','test'];
      const missing=required.filter(name=>typeof pkg.scripts?.[name]!=='string'||!pkg.scripts[name].trim());
      add('combined_package_scripts',missing.length?'missing':'present',missing.length?missing.join(', '):undefined);
    }catch{add('combined_package_scripts','invalid');}
  }else add('combined_package_scripts','missing');

  const commit=manifest?.combined_commit;
  add('reviewed_combined_commit',typeof commit==='string'&&/^[a-f0-9]{40}$/.test(commit)?'declared_unverified':'not_frozen');

  // Deliberately never return "ready": proof of hosted isolation, authenticated
  // account bindings, approval and a real live workstream is out of scope.
  return Object.freeze({
    status:'blocked_pending_approval_and_hosted_acceptance',
    scope:'offline_source_only',
    checks,
    pending:[
      'Kodak combine application and reviewed PR #8 prerequisites, resolve package/workflow/shared-file conflicts, run full CI',
      'Verify exact combined Git commit, migration hashes and container artifact',
      'Confirm new isolated staging project quota and cost without touching preserved projects',
      'Approve a named HTTPS Node host, cost, identity/secret plan and rollback',
      'Complete hosted Auth, RLS, seat provisioning, revocation, backups and desktop/iPhone Safari checks',
      'Verify supported AI workstreams individually; historical receipt is not proof of connection',
      'Separate explicit CEO authorization required for migration, provider changes, merge and deployment'
    ],
    connections_verified:0,
    mutations_performed:0
  });
}
