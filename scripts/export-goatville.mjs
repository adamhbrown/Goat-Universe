/** Read-only source audit and allowlisted static export. Never deploys. */
import { cp, lstat, mkdir, mkdtemp, readdir } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
const checkout = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const files = [];
async function scan(relative) {
  const path = join(checkout, relative), stat = await lstat(path);
  if (stat.isSymbolicLink()) throw new Error('Symlink rejected: ' + relative);
  if (relative.split('/').length > 8) throw new Error('Directory depth exceeded: ' + relative);
  if (stat.isDirectory()) {
    for (const name of await readdir(path)) {
      if (name.startsWith('.')) throw new Error('Hidden asset rejected: ' + name);
      await scan(relative + '/' + name);
    }
  } else if (stat.isFile()) {
    const code = /\.(?:html|css|js)$/i.test(relative);
    const media = /\.(?:mp3|mp4|webm|ogg|wav)$/i.test(relative);
    const imageFont = /\.(?:svg|jpg|jpeg|png|webp|avif|woff2?|ttf)$/i.test(relative);
    const limit = code ? 256 * 1024 : media ? 4 * 1024 ** 2 : imageFont ? 1024 ** 2 : 256 * 1024;
    if (stat.size > limit) throw new Error('Asset budget exceeded: ' + relative);
    files.push({ path: relative, bytes: stat.size, code });
  } else throw new Error('Non-file rejected: ' + relative);
}
for (const root of ['index.html', 'play.html', 'assets']) await scan(root);
const bytes = files.reduce((sum, f) => sum + f.bytes, 0);
const codeBytes = files.filter(f => f.code).reduce((sum, f) => sum + f.bytes, 0);
if (files.length > 500 || bytes > 12 * 1024 ** 2 || codeBytes > 512 * 1024) throw new Error('Aggregate export budget exceeded');
const output = await mkdtemp(join(tmpdir(), 'goatville-export-'));
for (const root of ['index.html', 'play.html', 'assets']) await cp(join(checkout, root), join(output, root), { recursive: true, force: false, errorOnExist: true });
console.log(JSON.stringify({ output, files: files.length, bytes, code_bytes: codeBytes, budgets: 'passed', deployed: false }));
