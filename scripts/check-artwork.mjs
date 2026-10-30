import { readFile, readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const manifest = JSON.parse(await readFile(path.join(root, 'docs/artwork-provenance.json'), 'utf8'));
const approved = new Map(manifest.images.map(image => [image.file, image]));
const extensions = new Set(manifest.imageExtensions);
const found = new Set();
const errors = [];

async function scan(folder) {
  for (const entry of await readdir(path.join(root, folder), { withFileTypes: true })) {
    const relative = `${folder}/${entry.name}`;
    if (manifest.excludePrefixes.some(prefix => relative === prefix.slice(0, -1) || relative.startsWith(prefix))) continue;
    if (entry.isDirectory()) await scan(relative);
    else if (extensions.has(path.extname(entry.name).toLowerCase())) {
      found.add(relative);
      const image = approved.get(relative);
      if (!image) { errors.push(`Unreviewed image: ${relative}`); continue; }
      const hash = createHash('sha256').update(await readFile(path.join(root, relative))).digest('hex');
      if (hash !== image.sha256) errors.push(`Image changed; review its source: ${relative}`);
    }
  }
}
for (const folder of manifest.scope) await scan(folder);
for (const image of manifest.images) {
  if (!image.optional && !found.has(image.file)) errors.push(`Missing approved image: ${image.file}`);
}

async function checkExternalImages(relative) {
  const text = await readFile(path.join(root, relative), 'utf8');
  if (/<img\b[^>]*\bsrc\s*=\s*["'](?:https?:)?\/\//i.test(text) || /!\[[^\]]*\]\(\s*(?:https?:)?\/\//i.test(text) || /url\(\s*["']?(?:https?:)?\/\//i.test(text)) {
    errors.push(`External image reference: ${relative}`);
  }
}
async function scanText(folder) {
  for (const entry of await readdir(path.join(root, folder), { withFileTypes: true })) {
    const relative = `${folder}/${entry.name}`;
    if (entry.isDirectory()) await scanText(relative);
    else if (/\.(md|html|css|ts|tsx)$/.test(entry.name)) await checkExternalImages(relative);
  }
}
await checkExternalImages('README.md');
await checkExternalImages('index.html');
await scanText('docs');
await scanText('src');
if (errors.length) {
  console.error(errors.join('\n'));
  process.exitCode = 1;
} else console.log(`Artwork verified: ${found.size} approved images; no external image embeds.`);
