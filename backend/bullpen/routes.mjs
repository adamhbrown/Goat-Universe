import { readFile } from 'node:fs/promises';

// This route only serves an empty sign-in shell. All records require an
// authenticated, explicitly bound seat, including direct database RPC access.
export async function bullpenAsset(req, res, pathname, headers) {
  const files = { '/bullpen': 'index.html', '/bullpen/ui.mjs': 'ui.mjs', '/bullpen/style.css': 'style.css' };
  if (req.method !== 'GET' || !Object.hasOwn(files, pathname)) return false;
  const file = files[pathname];
  const content = await readFile(new URL(file, import.meta.url));
  res.writeHead(200, { ...headers, 'Content-Type': file.endsWith('.mjs') ? 'text/javascript' : file.endsWith('.css') ? 'text/css' : 'text/html' });
  res.end(content);
  return true;
}
