import { describe, expect, it } from 'vitest';
import { PACKS } from './assets-fetch.mjs';
import { creditFor } from './b1-import.mjs';

describe('the B1 battle droid’s credit', () => {
  it('is leoxx300’s, as the assets repo lists it, for the troops’ battle droid', () => {
    expect(creditFor(PACKS.starwars.models.b1)).toEqual({
      title: 'B1 Battle Droid',
      author: 'leoxx300',
      authorUrl: 'https://sketchfab.com/leoxx300',
      license: 'CC-BY-4.0',
      licenseUrl: 'http://creativecommons.org/licenses/by/4.0/',
      source: 'https://sketchfab.com/3d-models/b1-battle-droid-star-wars-f0ca5d7dd5b64869907c6e781d7c660a',
      where: 'galaxy-surface',
      as: 'the battle droids',
      file: '/models/galaxy/troops/battledroid.glb',
      also: ['galaxy'],
    });
  });
});
