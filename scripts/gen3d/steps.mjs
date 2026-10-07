// A pipeline step made again only when what it's made from has changed:
// its output kept with a key (a digest of its inputs) beside it.

import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';

// A step's output reused when it was made from the same inputs (`key`, kept
// beside it as FILE.key); else made by `fn` and its key written.
export async function once(file, key, fn, { fresh = false } = {}) {
  const stamp = `${file}.key`;
  if (!fresh && existsSync(file) && existsSync(stamp) && readFileSync(stamp, 'utf8') === key) return { reused: true };
  const r = await fn();
  writeFileSync(stamp, key);
  return { reused: false, ...r };
}
export const digest = (...parts) => {
  const h = createHash('sha1');
  for (const p of parts) h.update(Buffer.isBuffer(p) ? p : String(p ?? '')).update('|');
  return h.digest('hex');
};
