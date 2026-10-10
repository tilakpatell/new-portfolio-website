import { afterEach, describe, expect, it } from 'vitest';
import CC0 from '../../../public/cc0/galaxy/index.json';
import GAME from '../../../public/textures/galaxy/bf2017/index.json';
import { coreFiles } from './core';
import { scanFiles, scanOf, scanSet, wearScanSet } from './scans';

afterEach(() => wearScanSet('cc0'));

describe('the surfaces’ scans, by the world’s set', () => {
  it('reads the site’s own scans until a world asks for another set', () => {
    expect(scanSet()).toBe('cc0');
    expect(scanOf('snow')).toEqual(CC0.snow);
    expect(scanFiles('snow').color).toBe('/cc0/galaxy/snow/color.webp');
  });

  it('reads the game’s for a Star Wars world on them (its look’s scanned: bf2017): their sizes, their files', () => {
    wearScanSet('bf2017');
    expect(scanSet()).toBe('bf2017');
    expect(scanOf('snow')).toEqual(GAME.snow);
    expect(scanOf('snow').metres).toBe(3);
    expect(scanFiles('snow')).toEqual({ color: '/textures/galaxy/bf2017/snow/color.webp', normal: '/textures/galaxy/bf2017/snow/normal.webp', arm: '/textures/galaxy/bf2017/snow/arm.webp' });
    // (no file of the scans' folder named while on the game's)
    for (const role of Object.keys(GAME)) for (const f of Object.values(scanFiles(role)).filter(Boolean)) expect(f, role).not.toMatch(/^\/cc0\//);
  });

  it('has every role the site’s scans have, so a world on the game’s set goes without none', () => {
    for (const role of Object.keys(CC0)) expect(GAME[role], role).toBeTruthy();
  });

  it('falls back to the site’s scans for a set it doesn’t know', () => {
    wearScanSet('nope');
    expect(scanSet()).toBe('cc0');
  });

  it('names a set’s files through core.js, by its folder and index', () => {
    expect(coreFiles('rock', { base: '/textures/galaxy/bf2017', index: GAME }).color).toBe('/textures/galaxy/bf2017/rock/color.webp');
    expect(coreFiles('rock', { base: '/textures/galaxy/bf2017', index: GAME }).arm).toBeNull();
  });
});
