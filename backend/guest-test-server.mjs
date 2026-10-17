// Local acceptance fixture only. Never serves the repository root or private APIs.
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';

export const GUEST_TEST_FILES = Object.freeze([
  'demo.html', 'demo.mjs', 'demo.css', 'host.mjs', 'protocol.mjs',
  'catalog.mjs', 'challenge.html', 'challenge.js'
]);
const allowed = new Set(GUEST_TEST_FILES);

export function createGuestTestServer({prefix = '/'} = {}) {
  if (!/^\/(?:[a-zA-Z0-9_-]+\/)*$/.test(prefix)) throw new Error('invalid_fixture_prefix');
  const requests = [];
  const server = createServer(async (req, res) => {
    // Check the raw request path: URL normalization must not turn traversal into
    // an approved asset. Exact paths also exclude query strings and encoded names.
    const raw = req.url ?? '';
    requests.push(raw);
    const name = raw.startsWith(prefix) ? raw.slice(prefix.length) : '';
    if (!allowed.has(name)) { res.writeHead(404); res.end(); return; }
    if (!['GET', 'HEAD'].includes(req.method)) {
      res.writeHead(405, {Allow:'GET, HEAD'}); res.end(); return;
    }
    try {
      const body = await readFile(new URL('./goatville/' + name, import.meta.url));
      res.writeHead(200, {
        'Content-Type':name.endsWith('.html') ? 'text/html; charset=utf-8' :
          name.endsWith('.css') ? 'text/css; charset=utf-8' : 'text/javascript; charset=utf-8',
        'X-Content-Type-Options':'nosniff', 'Cache-Control':'no-store'
      });
      res.end(req.method === 'HEAD' ? undefined : body);
    } catch { res.writeHead(500); res.end(); }
  });
  return {server, requests};
}
