import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const manifest = JSON.parse(await fs.readFile(path.join(root, 'docs/publication-link-audit.json'), 'utf8'));
const allowedHost = 'goatverse-publications.downtownadamb.chatgpt.site';
const urls = [...new Set((manifest.results ?? []).map(item => item.url).filter(Boolean))];
if (!urls.length) throw new Error('Publication link audit has no URLs');

for (const value of urls) {
  const url = new URL(value);
  if (url.protocol !== 'https:' || url.hostname !== allowedHost) {
    throw new Error(`Unexpected publication link host or scheme: ${url.origin}`);
  }
}

const results = new Array(urls.length);
let nextIndex = 0;
async function check(url) {
  let lastError;
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const response = await fetch(url, {
        method: 'HEAD',
        redirect: 'follow',
        headers: { 'user-agent': 'GOAT-Universe-publication-link-check/1.0' },
        signal: AbortSignal.timeout(20000)
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      if (new URL(response.url).hostname !== allowedHost) throw new Error('Redirect left the approved site host');
      return { url, status: response.status, content_type: response.headers.get('content-type') ?? '' };
    } catch (error) {
      lastError = error;
      if (attempt < 2) await new Promise(resolve => setTimeout(resolve, 750));
    }
  }
  return { url, error: String(lastError?.message ?? lastError) };
}

async function worker() {
  while (true) {
    const index = nextIndex++;
    if (index >= urls.length) return;
    results[index] = await check(urls[index]);
  }
}

await Promise.all(Array.from({ length: Math.min(10, urls.length) }, worker));
const failures = results.filter(result => result.error || result.status !== 200);
console.log(`Publication links: ${results.length - failures.length}/${results.length} reachable (manifest checked ${manifest.checked_at ?? 'date unknown'}).`);
if (failures.length) {
  for (const failure of failures) console.error(`${failure.url}: ${failure.error ?? `HTTP ${failure.status}`}`);
  process.exitCode = 1;
}
