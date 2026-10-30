import { mkdir, copyFile, readdir, rm } from 'node:fs/promises';
import path from 'node:path';
const root = process.cwd();
const out = path.join(root, 'public/game');
// This directory contains only generated runtime files; discard stale exports.
await rm(out, { recursive: true, force: true });
async function copy(source, name) {
  const target = path.join(out, name);
  await mkdir(path.dirname(target), { recursive: true });
  await copyFile(path.join(root, source), target);
}
await copy('assets/scene/blackjack-table-runtime.webp', 'table.webp');
await copy('assets/cards/card-back.png', 'back.png');
await copy('assets/sprites/bet-token-runtime.png', 'token.png');
for (const extension of ['ogg', 'mp3']) {
  await copy(`assets/audio/title-theme.${extension}`, `audio/title-theme.${extension}`);
}
for (const file of await readdir(path.join(root, 'assets/cards/faces'))) {
  if (file.endsWith('.png')) await copy('assets/cards/faces/' + file, 'cards/' + file);
}
for (const file of await readdir(path.join(root, 'assets/dealer/v3'))) {
  if (/^(frame|face)-\d+\.png$/.test(file)) await copy('assets/dealer/v3/' + file, 'dealer/v3/' + file);
}
console.log('Runtime assets prepared; generation archive excluded from build.');
