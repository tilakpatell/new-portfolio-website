import { existsSync } from 'node:fs';
import { onSite } from '../../../../scripts/lib/asset-manifest.mjs';
import PUBLISHED from '../../../data/galaxyAssets.json';
import { describe, expect, it } from 'vitest';
import { CREW, fileOf } from './crew';
import { faceOf, filesOf } from './crewList';
import { SURFACE_MODELS } from './catalog';

const at = (path) => new URL(`../../../../public${path}`, import.meta.url);
// (in public/, or published to the bucket: a checkout without its files, as CI's, takes the manifest's word)
const has = (path) => onSite(path, { publicDir: at('').pathname, manifest: PUBLISHED });

describe('the surfaces’ crew', () => {
  it('has a model in the site for each of them', () => {
    for (const [kind, c] of Object.entries(CREW)) for (const file of filesOf(c)) expect(has(file), `${kind}: ${file}`).toBe(true);
  });

  it('gives a kind with other faces each of them in turn', () => {
    expect([0, 1, 2, 3].map((i) => fileOf(faceOf(CREW.jedi, i)))).toEqual(['/models/galaxy/crew/jedi.glb', '/models/galaxy/crew/jedi2.glb', '/models/galaxy/crew/jedi3.glb', '/models/galaxy/crew/jedi.glb']);
    expect(faceOf(CREW.han, 3)).toBe(CREW.han);
  });

  it('walks the 2017 game’s heroes on the game’s skeleton, each with its pack of the game’s clips', () => {
    for (const [kind, tall] of Object.entries({ luke: 1.72, leia: 1.5, han: 1.85, chewie: 2.28, bobafett: 1.83, vader: 2.02, obiwan: 1.82, anakin: 1.85, maul: 1.75, dooku: 1.93, palpatine: 1.73, lando: 1.78, bossk: 1.9 })) {
      expect(CREW[kind], kind).toEqual({ url: `/models/galaxy/bf2017/crew/${kind}.glb`, tall, rig: 'walrus', pack: kind });
      expect(has(`/models/galaxy/bf2017/crew/${kind}.lod1.glb`), `${kind}'s light cut`).toBe(true);
      expect(has(`/models/galaxy/bf2017/clips-${kind}.glb`), `${kind}'s pack`).toBe(true);
    }
  });

  it('walks the Battlefront’s soldiers on their rigged files, as tall as the catalogue has them, its statues left to stand in', () => {
    const troops = { clone: 1.83, battledroid: 1.91, superdroid: 1.93, stormtrooper: 1.83, snowtrooper: 1.83, hothtrooper: 1.78, sandtrooper: 1.83, scouttrooper: 1.83, shoretrooper: 1.83, deathtrooper: 1.83 };
    for (const [kind, tall] of Object.entries(troops)) {
      expect(CREW[kind], kind).toEqual({ url: `/models/galaxy/troops/${kind}.glb`, tall });
      expect(SURFACE_MODELS[kind]?.metres, kind).toBe(tall);
      expect(existsSync(at(`/models/galaxy/surface/${kind}.glb`)), `${kind}'s statue`).toBe(true);
    }
  });
});
