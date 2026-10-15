import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, existsSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, join } from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
function files(dir) {
  return readdirSync(dir, {withFileTypes:true}).flatMap(entry => {
    if (entry.name.startsWith('.') || ['context','node_modules','tests','output'].includes(entry.name)) return [];
    const path = join(dir, entry.name);
    return entry.isDirectory() ? files(path) : [path];
  });
}

test('every static local page, stylesheet, script and module link resolves', () => {
  const missing = [];
  for (const file of files(root).filter(path => /\.(html|js)$/.test(path))) {
    const source = readFileSync(file, 'utf8');
    const pattern = file.endsWith('.html') ? /(?:href|src)="([^"]+)"/g : /(?:from\s*|import\s*)["'](\.[^"']+)["']/g;
    for (const match of source.matchAll(pattern)) {
      const reference = match[1];
      if (/^(?:[a-z][a-z\d+.-]*:|\/\/|#)/i.test(reference) || reference.includes('${')) continue;
      const path = decodeURIComponent(reference.split(/[?#]/)[0]);
      if (!path) continue;
      const target = path.startsWith('/') ? resolve(root, '.'+path) : resolve(dirname(file),path);
      if (!existsSync(target) || (statSync(target).isDirectory() && !existsSync(join(target,'index.html')))) missing.push(`${file}: ${reference}`);
    }
  }
  assert.deepEqual(missing, []);
});

test('editorial JSON remains valid', () => {
  for (const file of files(join(root, 'data')).filter(path => path.endsWith('.json'))) {
    assert.doesNotThrow(() => JSON.parse(readFileSync(file,'utf8')), file);
  }
});
