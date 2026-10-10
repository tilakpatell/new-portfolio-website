// The surface catalogue's lines and the model credits, as the importers
// write them (scripts/battlefront-import.mjs, scripts/bf2017-import.mjs): one
// line a kind in a group's `MODELS`, replaced where the kind is already
// there, and one credit a kind in src/data/modelCredits.json, keys sorted.
import { readFile, writeFile } from 'node:fs/promises';

const KEY = /^[A-Za-z_$][\w$]*$/;
const quote = (s) => `'${s.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;

// A value as the catalogue files write one: single quotes, `{ a: 1 }`.
// (Built from the value, not by rewriting its JSON: a comma or quote inside
// a string stays as it is.)
function literal(v) {
  if (typeof v === 'string') return quote(v);
  if (Array.isArray(v)) return `[${v.map(literal).join(', ')}]`;
  if (v && typeof v === 'object') return `{ ${Object.entries(v).map(([k, x]) => `${KEY.test(k) ? k : quote(k)}: ${literal(x)}`).join(', ')} }`;
  return String(v);
}

export const catalogueLine = (kind, entry) => `  ${kind}: ${literal(entry)},`;

export async function writeCatalogueLine(file, kind, entry) {
  let s = await readFile(file, 'utf8');
  const line = catalogueLine(kind, entry);
  const had = new RegExp(`^  ${kind}: \\{.*$`, 'm');
  if (had.test(s)) s = s.replace(had, () => line);
  else if (/= \{\};/.test(s)) s = s.replace(/= \{\};/, () => `= {\n${line}\n};`);
  else s = s.replace(/\n\};\s*$/, () => `\n${line}\n};\n`);
  await writeFile(file, s);
}

export async function writeCredit(file, key, credit) {
  const credits = JSON.parse(await readFile(file, 'utf8'));
  credits[key] = credit;
  const sorted = Object.fromEntries(
    Object.keys(credits)
      .sort()
      .map((k) => [k, credits[k]]),
  );
  await writeFile(file, `${JSON.stringify(sorted, null, 2)}\n`);
}
