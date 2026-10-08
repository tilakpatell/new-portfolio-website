// What the My worlds list does, kept apart from React so Node can test it:
// a new world's address from a seed, an export's file, an import's reading,
// and the words for when a world was played and how big its save is.

import { worldUrl } from './registry';

export const SEED_MAX = 32;

// Blank: a random whole number, as Minecraft picks one.
export function newWorldUrl(seedText, random = Math.random) {
  const typed = String(seedText ?? '')
    .trim()
    .slice(0, SEED_MAX);
  const seed = typed || Math.floor(random() * 2 ** 31) - 2 ** 30;
  return worldUrl({ kind: 'minecraft', seed });
}

// { world, save } → a file to download, named for the world's id
// (`minecraft:42` → tp-world-minecraft-42.json: no colons in a filename).
export function exportFile(file) {
  const id = String(file?.world?.id ?? 'world').replace(/[^\w.-]+/g, '-');
  return { filename: `tp-world-${id}.json`, text: JSON.stringify(file, null, 2) };
}

// A chosen file's text → the object to import, or an Error to show.
export function readImport(text) {
  if (!String(text ?? '').trim()) throw new Error('That file is empty.');
  let file;
  try {
    file = JSON.parse(text);
  } catch {
    throw new Error('That file isn’t a world file (it isn’t JSON).');
  }
  if (!file || typeof file !== 'object' || Array.isArray(file) || !file.world || typeof file.world !== 'object') throw new Error('That file isn’t a world file.');
  return file;
}

const MIN = 60e3;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

export function formatPlayed(ms, now = Date.now()) {
  if (ms == null || !Number.isFinite(ms)) return 'never';
  const ago = now - ms;
  if (ago < MIN) return 'just now';
  if (ago < HOUR) return `${Math.floor(ago / MIN)} min ago`;
  if (ago < DAY) return `${Math.floor(ago / HOUR)} h ago`;
  const days = Math.floor(ago / DAY);
  if (days === 1) return 'yesterday';
  if (days < 7) return `${days} days ago`;
  return new Date(ms).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function formatSize(bytes) {
  if (!bytes) return 'empty';
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${+kb.toFixed(1)} KB`;
  return `${+(kb / 1024).toFixed(1)} MB`;
}
