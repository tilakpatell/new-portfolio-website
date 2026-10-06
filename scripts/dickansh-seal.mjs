// Seals the secret world's exhibits with its password, for
// src/components/dickansh/sealed.json (see src/components/dickansh/seal.js).
// The plain JSON stays out of the repo: keep it somewhere of your own.
//
//   node scripts/dickansh-seal.mjs <exhibits.json> "<password>"

import { readFile, writeFile } from 'node:fs/promises';
import { seal, unseal } from '../src/components/dickansh/seal.js';

const [from, password] = process.argv.slice(2);
if (!from || !password) {
  console.error('usage: node scripts/dickansh-seal.mjs <exhibits.json> "<password>"');
  process.exit(1);
}
const value = JSON.parse(await readFile(from, 'utf8'));
const box = await seal(value, password);
if (JSON.stringify(await unseal(box, password)) !== JSON.stringify(value)) throw new Error('sealed exhibits did not open again');
const to = new URL('../src/components/dickansh/sealed.json', import.meta.url);
await writeFile(to, `${JSON.stringify(box, null, 2)}\n`);
console.log(`sealed ${value.exhibits?.length ?? 0} exhibits, ${box.data.length} characters`);
