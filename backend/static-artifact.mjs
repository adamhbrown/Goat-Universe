import {lstat, readdir, readFile, realpath} from 'node:fs/promises';
import path from 'node:path';

const ALLOWED = new Set(['.html','.css','.js','.mjs','.json','.svg','.png','.jpg','.jpeg','.webp','.avif','.ico','.woff','.woff2','.txt','.mp4','.webm','.mp3','.ogg','.wav']);
const TEXT = new Set(['.html','.css','.js','.mjs','.json','.svg','.txt']);
const PRIVATE = /^(backend|supabase|node_modules|docs|coverage|tests?|\.git|\.github|\.local)(\/|$)|(^|\/)(?:\.env(?:\..*)?|package(?:-lock)?\.json|Dockerfile|.*\.(?:pem|key|sql|map|zip|tar|gz|sqlite|db))$/i;
const SENSITIVE = /sb_secret_[A-Za-z0-9_-]{12,}|sbp_[A-Za-z0-9_-]{20,}|(?:ghp_|github_pat_)[A-Za-z0-9_]{20,}|sk_(?:live|test)_[A-Za-z0-9]{16,}|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|postgres(?:ql)?:\/\/[^\s"'<>]+:[^\s"'<>]+@/;
// Legacy privileged JWTs must also stay out of public assets. Do not print them.
function privilegedJWT(text) {
  for (const token of text.match(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g) || []) {
    try { if (JSON.parse(Buffer.from(token.split('.')[1], 'base64url')).role === 'service_role') return true; } catch { /* Not a JWT. */ }
  }
  return false;
}

/** Audits a prepared PUBLIC EXPORT, never the repository root. No network,
 * credentials, uploads or provider changes. Paths and codes only, no excerpts.
 * Bounds are initial engineering budgets, not measured real-device performance.
 */
export async function auditStaticArtifact(directory) {
  const root = await realpath(directory);
  const issues = [];
  const report = {status:'failed', files:0, bytes:0, initial_code_bytes:0, limits:{files:500, total_bytes:12582912,
    code_file_bytes:262144, image_file_bytes:1048576, media_file_bytes:4194304, initial_code_bytes:524288}, issues};
  const issue = (file, code) => { if (issues.length < 200) issues.push({file, code}); };
  let stopped = false;
  async function walk(relative = '') {
    if (stopped) return;
    const entries = await readdir(path.join(root, relative), {withFileTypes:true});
    for (const entry of entries) {
      if (stopped) break;
      const rel = relative ? `${relative}/${entry.name}` : entry.name;
      const absolute = path.join(root, rel);
      if (PRIVATE.test(rel) || entry.name.startsWith('.')) { issue(rel, 'private_path_forbidden'); continue; }
      const stat = await lstat(absolute);
      if (stat.isSymbolicLink() || (!stat.isDirectory() && !stat.isFile())) { issue(rel, 'non_regular_path_forbidden'); continue; }
      if (stat.isDirectory()) {
        if (rel.split('/').length > 8) { issue(rel, 'directory_depth_exceeded'); continue; }
        await walk(rel); continue;
      }
      report.files++; report.bytes += stat.size;
      if (report.files > report.limits.files || report.bytes > report.limits.total_bytes) { issue(rel, 'artifact_budget_exceeded'); stopped = true; break; }
      const extension = path.extname(rel).toLowerCase();
      if (!ALLOWED.has(extension)) { issue(rel, 'file_type_forbidden'); continue; }
      const code = ['.html','.js','.mjs','.css','.json','.svg','.txt'].includes(extension);
      const budget = code ? report.limits.code_file_bytes : /\.(mp4|webm|mp3|ogg|wav)$/.test(rel) ? report.limits.media_file_bytes : report.limits.image_file_bytes;
      if (stat.size > budget) { issue(rel, 'file_budget_exceeded'); continue; }
      if (['.html','.js','.mjs','.css'].includes(extension)) report.initial_code_bytes += stat.size;
      if (TEXT.has(extension)) {
        const text = await readFile(absolute, 'utf8');
        if (SENSITIVE.test(text) || privilegedJWT(text)) issue(rel, 'credential_pattern_detected');
        if (/<(?:script|iframe)\b[^>]*\bsrc\s*=\s*["']?(?:https?:)?\/\//i.test(text) ||
            /@import\s+(?:url\()?\s*["']?(?:https?:)?\/\//i.test(text) ||
            /(?:import|export)\s+(?:[^;\n]*?\s+from\s*)?["']https?:\/\//i.test(text) ||
            /import\s*\(\s*["']https?:\/\//i.test(text)) issue(rel, 'external_active_dependency_requires_review');
      }
    }
  }
  const rootStat = await lstat(directory);
  if (!rootStat.isDirectory() || rootStat.isSymbolicLink()) { issue('.', 'regular_directory_required'); return report; }
  await walk();
  if (report.initial_code_bytes > report.limits.initial_code_bytes) issue('.', 'initial_code_budget_exceeded');
  if (report.files === 0) issue('.', 'empty_artifact');
  report.status = issues.length ? 'failed' : 'passed';
  return report;
}
