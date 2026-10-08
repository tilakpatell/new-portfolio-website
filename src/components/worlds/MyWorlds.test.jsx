import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { IDBFactory } from 'fake-indexeddb';
import { createStore } from '../../runtime/store';
import { createRegistry } from './registry';
import { SEED_MAX, exportFile, formatPlayed, formatSize, newWorldUrl, readImport } from './worldFiles';
import MyWorlds from './MyWorlds';

const MIN = 60e3;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;
const NOW = Date.UTC(2026, 9, 7, 12);

describe('a new world', () => {
  it('takes the seed typed, trimmed', () => {
    expect(newWorldUrl('  hello  ')).toBe('/dot-matrix/minecraft?world=hello');
  });
  it('keeps a seed to its first 32 characters', () => {
    const url = newWorldUrl('x'.repeat(50));
    expect(url).toBe(`/dot-matrix/minecraft?world=${'x'.repeat(SEED_MAX)}`);
  });
  it('escapes a seed for the address', () => {
    expect(newWorldUrl('a b&c')).toBe('/dot-matrix/minecraft?world=a%20b%26c');
  });
  it('is a random whole number, as Minecraft picks one, when the seed is blank', () => {
    expect(newWorldUrl('', () => 0)).toBe(`/dot-matrix/minecraft?world=${-(2 ** 30)}`);
    expect(newWorldUrl('   ', () => 0.5)).toBe(`/dot-matrix/minecraft?world=${2 ** 30 - 2 ** 30}`);
    expect(newWorldUrl(undefined, () => 0.75)).toBe(`/dot-matrix/minecraft?world=${2 ** 29}`);
    const seed = Number(new URL(newWorldUrl(''), 'http://x').searchParams.get('world'));
    expect(Number.isInteger(seed)).toBe(true);
    expect(seed).toBeGreaterThanOrEqual(-(2 ** 30));
    expect(seed).toBeLessThan(2 ** 30);
  });
});

describe('an exported world', () => {
  const file = { world: { id: 'minecraft:42', kind: 'minecraft', seed: 42, name: 'Home' }, save: { edits: [1, 2] } };
  it('is named for its id, with no colon in the filename', () => {
    expect(exportFile(file).filename).toBe('tp-world-minecraft-42.json');
  });
  it('drops anything a filename should not have', () => {
    expect(exportFile({ world: { id: 'pocket:a/b?c' }, save: null }).filename).toBe('tp-world-pocket-a-b-c.json');
  });
  it('is the world and its save as JSON that reads back', () => {
    const { text } = exportFile(file);
    expect(JSON.parse(text)).toEqual(file);
    expect(readImport(text)).toEqual(file);
  });
});

describe('an imported file', () => {
  it('is read as JSON', () => {
    expect(readImport('{"world":{"kind":"minecraft","seed":1}}')).toEqual({ world: { kind: 'minecraft', seed: 1 } });
  });
  it('says plainly when it is not JSON', () => {
    expect(() => readImport('not json')).toThrow(/isn’t a world file/);
  });
  it('says plainly when it has no world in it', () => {
    for (const t of ['null', '42', '"hi"', '[]', '{}', '{"world":3}']) expect(() => readImport(t), t).toThrow(/isn’t a world file/);
  });
  it('says plainly when it is empty', () => {
    expect(() => readImport('')).toThrow(/empty/);
  });
});

describe('when a world was played', () => {
  it('is just now within the minute', () => {
    expect(formatPlayed(NOW, NOW)).toBe('just now');
    expect(formatPlayed(NOW - 59e3, NOW)).toBe('just now');
    expect(formatPlayed(NOW + 5e3, NOW)).toBe('just now');
  });
  it('is minutes within the hour', () => {
    expect(formatPlayed(NOW - 5 * MIN, NOW)).toBe('5 min ago');
    expect(formatPlayed(NOW - 59 * MIN, NOW)).toBe('59 min ago');
  });
  it('is hours within the day', () => {
    expect(formatPlayed(NOW - 3 * HOUR, NOW)).toBe('3 h ago');
  });
  it('is days within the week', () => {
    expect(formatPlayed(NOW - DAY, NOW)).toBe('yesterday');
    expect(formatPlayed(NOW - 2 * DAY, NOW)).toBe('2 days ago');
    expect(formatPlayed(NOW - 6 * DAY, NOW)).toBe('6 days ago');
  });
  it('is a date after that', () => {
    const s = formatPlayed(Date.UTC(2026, 0, 3, 12), NOW);
    expect(s).toMatch(/2026/);
    expect(s).toMatch(/Jan/);
  });
  it('is never for a world with no time', () => {
    expect(formatPlayed(null, NOW)).toBe('never');
  });
});

describe('a save’s size', () => {
  it('is in bytes, KB or MB', () => {
    expect(formatSize(0)).toBe('empty');
    expect(formatSize(null)).toBe('empty');
    expect(formatSize(512)).toBe('512 B');
    expect(formatSize(2048)).toBe('2 KB');
    expect(formatSize(1536)).toBe('1.5 KB');
    expect(formatSize(3.25 * 1024 * 1024)).toBe('3.3 MB');
  });
});

const page = (props) =>
  renderToStaticMarkup(
    <MemoryRouter>
      <MyWorlds {...props} />
    </MemoryRouter>,
  );
const registry = () => createRegistry(createStore({ indexedDB: new IDBFactory() }));
const row = (over) => ({ id: 'minecraft:42', kind: 'minecraft', seed: 42, name: 'Home base', route: '/dot-matrix/minecraft?world=42', created: NOW, played: NOW - 5 * MIN, size: 2048, thumb: null, ...over });

describe('my worlds', () => {
  it('lists each world with its name, kind, when it was played and its size', () => {
    const html = page({ registry: registry(), initial: [row(), row({ id: 'pocket:7', kind: 'pocket', seed: 7, name: 'Pocket', route: '/universe?seed=7', played: NOW - 2 * DAY, size: 0 })], now: NOW });
    expect(html).toContain('<h2');
    expect(html).toContain('My worlds');
    expect(html).toMatch(/<ul[^>]*>.*<li/);
    expect(html).toContain('Home base');
    expect(html).toContain('Minecraft');
    expect(html).toContain('5 min ago');
    expect(html).toContain('2 KB');
    expect(html).toContain('Pocket universe');
    expect(html).toContain('2 days ago');
  });
  it('continues a world at its address', () => {
    const html = page({ registry: registry(), initial: [row()], now: NOW });
    expect(html).toContain('href="/dot-matrix/minecraft?world=42"');
    expect(html).toContain('Continue');
  });
  it('offers to rename, delete and export each, labelled with the world', () => {
    const html = page({ registry: registry(), initial: [row()], now: NOW });
    for (const a of ['Rename', 'Delete', 'Export']) {
      expect(html).toContain(`>${a}</button>`);
      expect(html).toContain(`aria-label="${a} Home base"`);
    }
  });
  it('makes a new world from a seed, or imports one', () => {
    const html = page({ registry: registry(), initial: [], now: NOW });
    expect(html).toContain('New world');
    expect(html).toContain('placeholder="Seed (blank: random)"');
    expect(html).toContain('>Create</button>');
    expect(html).toContain('type="file"');
    expect(html).toContain('accept="application/json,.json"');
    expect(html).toContain('Import');
    expect(html).toContain('aria-live="polite"');
  });
  it('says so when there are no worlds yet', () => {
    const html = page({ registry: registry(), initial: [], now: NOW });
    expect(html).toContain('No worlds yet');
    expect(html).not.toContain('<li');
  });
  it('says it is looking before the first load', () => {
    expect(page({ registry: registry(), now: NOW })).toContain('Looking for your worlds');
  });
});
