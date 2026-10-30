import { readFile, readdir, writeFile, copyFile, mkdir, stat } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const lock = JSON.parse(await readFile(path.join(root, 'package-lock.json'), 'utf8'));
const sections = ['Third-party software notices\n\nProject code: GPL-3.0-only; see LICENSE. Dependencies retain their own licenses.'];
for (const [relative, info] of Object.entries(lock.packages).sort(([a], [b]) => a.localeCompare(b, 'en'))) {
  if (!relative || info.dev) continue;
  const folder = path.join(root, relative);
  let pkg;
  try { pkg = JSON.parse(await readFile(path.join(folder, 'package.json'), 'utf8')); }
  catch (error) { if (info.optional && error.code === 'ENOENT') continue; throw error; }
  const names = (await readdir(folder)).filter(name => /^(licen[sc]e|copying|notice)(\.|$)/i.test(name)).sort();
  const texts = [];
  for (const name of names) {
    if ((await stat(path.join(folder, name))).isFile()) texts.push(await readFile(path.join(folder, name), 'utf8'));
  }
  if (!texts.length && pkg.name === '@pixi/colord' && pkg.version === '2.9.6') {
    texts.push(await readFile(path.join(root, 'doc/licenses/colord-MIT.txt'), 'utf8'));
  }
  if (!texts.length) throw new Error(`No license text found for ${pkg.name}@${pkg.version}`);
  sections.push(`${pkg.name}@${pkg.version} (${pkg.license})\n${texts.join('\n\n')}`);
}
sections.push('Android distribution: AndroidX libraries, Copyright The Android Open Source Project; Kotlin standard library and JetBrains annotations, Copyright JetBrains s.r.o. and contributors; JSpecify annotations, Copyright The JSpecify Authors. Licensed under Apache License 2.0. Resolved coordinates are included as ANDROID_DEPENDENCIES.txt inside the APK.\n\n' + await readFile(path.join(root, 'doc/licenses/Apache-2.0.txt'), 'utf8'));
const notices = sections.join('\n\n' + '='.repeat(72) + '\n\n').trimEnd() + '\n';
await writeFile(path.join(root, 'THIRD_PARTY_NOTICES.txt'), notices);
await mkdir(path.join(root, 'public'), { recursive: true });
await copyFile(path.join(root, 'LICENSE'), path.join(root, 'public/LICENSE'));
await writeFile(path.join(root, 'public/THIRD_PARTY_NOTICES.txt'), notices);
console.log('Project and third-party licenses prepared for web and Android packages.');
