import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import CREDITS from './modelCredits.json';

const at = (path) => new URL(`../../${path}`, import.meta.url);
// every .js and .jsx under src, as text
const sources = (dir = 'src') =>
  readdirSync(at(dir), { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? sources(`${dir}/${e.name}`) : /\.jsx?$/.test(e.name) && !e.name.includes('.test.') ? [readFileSync(at(`${dir}/${e.name}`), 'utf8')] : []));

describe('the 3D models that are other people’s', () => {
  const names = Object.keys(CREDITS);

  it('each say who made them, under which licence, and where they came from', () => {
    expect(names.length).toBeGreaterThan(0);
    for (const [name, m] of Object.entries(CREDITS)) {
      for (const key of ['title', 'author', 'as']) expect(m[key], `${name}: ${key}`).toBeTruthy();
      expect(m.source, name).toMatch(/^https:\/\/sketchfab\.com\/3d-models\//);
      expect(m.authorUrl, name).toMatch(/^https:\/\/sketchfab\.com\//);
      // attribution licences, share-alike and non-commercial ones too (the site sells nothing), but none that forbids changing it: they're all reduced for the web
      expect(m.license, name).toMatch(/^CC-BY-(NC-)?(SA-)?4\.0$/);
      expect(m.licenseUrl, name).toMatch(/creativecommons\.org\/licenses\//);
    }
  });

  it('are each in the site, and each used by a page that shows its credit', () => {
    const code = sources().join('\n');
    const shown = { universe: 'components/universe/UniversePanel.jsx', 'middle-earth': 'components/middleearth/MapHub.jsx', invincible: 'pages/Invincible.jsx', avengers: 'pages/Avengers.jsx', galaxy: 'components/galaxy/GalaxyPanel.jsx' };
    for (const [name, m] of Object.entries(CREDITS)) {
      // where it is: its own `file`, or under its name with the rest from Sketchfab
      const file = m.file ?? `/models/sketchfab/${name}.glb`;
      expect(existsSync(at(`public${file}`)), file).toBe(true);
      // by its own path, or by the folder and its name (the map's places are loaded by name)
      expect(code.includes(file) || (code.includes('/models/sketchfab/${name}.glb') && code.includes(`'${name}'`)), `${name} is used`).toBe(true);
      expect(shown[m.where], `${name}: ${m.where}`).toBeTruthy();
      expect(readFileSync(at(`src/${shown[m.where]}`), 'utf8'), m.where).toContain(`<ModelCredits where="${m.where}"`);
      // and every other page that shows it, its credit too
      for (const page of m.also ?? []) {
        expect(shown[page], `${name}: also ${page}`).toBeTruthy();
        expect(readFileSync(at(`src/${shown[page]}`), 'utf8'), page).toContain(`<ModelCredits where="${page}"`);
      }
    }
  });
});
