import test from 'node:test';
import assert from 'node:assert/strict';
import {request} from 'node:http';
import {createGuestTestServer} from '../guest-test-server.mjs';

async function fixture(t, prefix = '/') {
  const {server, requests} = createGuestTestServer({prefix});
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const origin = `http://127.0.0.1:${server.address().port}`;
  return {origin, requests};
}

for (const prefix of ['/', '/Goat-Universe/backend/goatville/']) {
  test(`browser fixture serves the entire transitive guest module graph at ${prefix}`, async t => {
    const {origin} = await fixture(t, prefix);
    const pending = [prefix + 'demo.html'], visited = new Set();
    while (pending.length) {
      const path = pending.shift();
      if (visited.has(path)) continue;
      visited.add(path);
      const response = await fetch(origin + path);
      assert.equal(response.status, 200, `required dependency ${path}`);
      assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
      assert.equal(response.headers.get('cache-control'), 'no-store');
      const body = await response.text();
      const references = path.endsWith('.html')
        ? [...body.matchAll(/(?:src|href)=["']([^"']+)["']/g)].map(m => m[1])
        : path.endsWith('.mjs')
          ? [...body.matchAll(/(?:from\s*|new URL\(\s*)["'](\.\/[^"']+)["']/g)].map(m => m[1]) : [];
      for (const reference of references) pending.push(new URL(reference, origin + path).pathname);
    }
    assert.ok(visited.has(prefix + 'catalog.mjs'), 'host allowlist dependency must be reachable');
    assert.ok(visited.has(prefix + 'challenge.js'), 'sandboxed challenge must be reachable');
    assert.equal(visited.size, 8);
    const head = await fetch(origin + prefix + 'catalog.mjs', {method:'HEAD'});
    assert.equal(head.status, 200); assert.equal(await head.text(), '');
    assert.match(head.headers.get('content-type'), /^text\/javascript/);
  });
}

test('browser fixture rejects private files, path aliases, unsupported methods and path escape', async t => {
  const {origin} = await fixture(t);
  // node:http retains dot segments, unlike fetch URL normalization.
  const rawRequest = (path, method = 'GET') => new Promise((resolve, reject) => {
    const req = request(origin, {path, method}, res => {
      res.resume(); res.on('end', () => resolve({status:res.statusCode, allow:res.headers.allow}));
    });
    req.on('error', reject); req.end();
  });
  for (const path of ['/backend/server.mjs', '/.env', '/package.json', '/..%2fserver.mjs',
    '/nested/../catalog.mjs', '/%63atalog.mjs', '/catalog.mjs?token=private', '//catalog.mjs']) {
    assert.equal((await rawRequest(path)).status, 404, path);
  }
  const post = await rawRequest('/catalog.mjs', 'POST');
  assert.equal(post.status, 405); assert.equal(post.allow, 'GET, HEAD');
  assert.throws(() => createGuestTestServer({prefix:'/../'}), /invalid_fixture_prefix/);
});
