import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import { JSDOM } from 'jsdom';
import test from 'node:test';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const htmlPath = process.env.GOAT_SITE_HTML || path.join(root, 'index.html');
const html = fs.readFileSync(htmlPath, 'utf8');
const document = new JSDOM(html, { url: 'https://goat-universe.test/' }).window.document;

function accessibleName(element) {
  const labelledBy = element.getAttribute('aria-labelledby');
  const referenced = labelledBy?.split(/\s+/).map(id => document.getElementById(id)?.textContent ?? '').join(' ');
  return (element.getAttribute('aria-label') || referenced || element.getAttribute('title') || element.textContent).trim();
}

test('homepage retains language, title, mobile viewport and primary content landmarks', () => {
  assert.match(document.documentElement.lang, /^[a-z]{2}(-[A-Z]{2})?$/);
  assert.ok(document.title.trim(), 'document title is present');
  assert.match(document.querySelector('meta[name="viewport"]')?.content ?? '', /width=device-width/i);
  assert.equal(document.querySelectorAll('main').length, 1, 'one main landmark is present');
  assert.equal(document.querySelectorAll('h1').length, 1, 'one page heading is present');
});

test('all in-page navigation targets exist and element IDs are unique', () => {
  const ids = [...document.querySelectorAll('[id]')].map(element => element.id);
  assert.equal(ids.length, new Set(ids).size, 'IDs are unique');
  for (const link of document.querySelectorAll('a[href^="#"]')) {
    const target = decodeURIComponent(link.getAttribute('href').slice(1));
    assert.ok(target && document.getElementById(target), `broken in-page link: ${link.getAttribute('href')}`);
  }
});

test('links and controls have accessible names; content images have alt text', () => {
  for (const element of document.querySelectorAll('a, button')) {
    assert.ok(accessibleName(element), `unnamed ${element.tagName.toLowerCase()} control`);
  }
  for (const image of document.images) {
    assert.ok(image.hasAttribute('alt'), `image is missing alt text: ${image.getAttribute('src') ?? '(no src)'}`);
  }
});

test('referenced local scripts, stylesheets and media files exist', () => {
  const references = [
    ...document.querySelectorAll('a[href], script[src], img[src], source[src], video[poster], link[href]')
  ].map(element => element.getAttribute('src') ?? element.getAttribute('poster') ?? element.getAttribute('href'));
  const cssReferences = [...html.matchAll(/url\(\s*(['"]?)(.*?)\1\s*\)/gi)].map(match => match[2]);
  for (const reference of [...references, ...cssReferences]) {
    if (/^(?:[a-z]+:|\/\/|#|data:)/i.test(reference)) continue;
    const pathname = decodeURIComponent(reference.split(/[?#]/, 1)[0] || 'index.html').replace(/^\/+/, '');
    assert.ok(fs.existsSync(path.resolve(root, pathname)), `missing local asset: ${reference}`);
  }
});

test('inline JavaScript parses without executing page code', () => {
  for (const [index, script] of [...document.scripts].entries()) {
    if (script.src || !['', 'text/javascript', 'application/javascript'].includes(script.type)) continue;
    assert.doesNotThrow(
      () => new vm.Script(script.textContent, { filename: `homepage-inline-${index}.js` }),
      `inline script ${index} has invalid JavaScript syntax`
    );
  }
});

test('homepage includes narrow-screen layout rules', () => {
  const css = [...document.querySelectorAll('style')].map(style => style.textContent).join('\n');
  assert.match(css, /@media\s*\(max-width\s*:\s*900px\)/i);
  assert.match(css, /@media\s*\(max-width\s*:\s*560px\)/i);
});
