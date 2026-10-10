import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { halveLut, lutStrip, mergeVE, pickEntries, pickVariants, probeStats, readHdr, readVE, shrinkFace, toComponents, weatherKey, writeHdr } from './bf2017-light.mjs';

// Hoth's sky[], as its map (web/maps/levels/mp/hoth_01/hoth_01.json) lists it
const HOTH = [
  'Levels/Lighting/Hoth/Sunny_01/VE_Sky_Arctic_Sunny_01',
  'Levels/Lighting/Global/VE_SpotMeter_Hoth_01_Sunset',
  'Levels/Lighting/Hoth/Sunset_01/VE_PV_Hoth_Sunset_01',
  'Levels/Lighting/Global/VE_HighEnd_01',
  'FX/Gameplay/UI/VE_DeathScreen_Desaturation',
  'FX/VE/VE_OnDeathFlash',
  'Globals/VisualEnvironments/ObjectPreview/VE_DoF_Preview',
  'Levels/Frontend/Lighting/VE_SpawnScreen',
  'Levels/Lighting/Hoth/Interior_01/VE_PV_Hoth_Interior_01',
  'Lighting/VE/VE_No_Sun',
  'Levels/Lighting/Global/VE_Gamewide_01',
];
const FIXTURE = JSON.parse(readFileSync(new URL('../fixtures/bf2017/data/ve_sky_fixture.json', import.meta.url), 'utf8'));

describe('which VisualEnvironment is the level’s', () => {
  it('takes the VE_Sky_ as the main and the VE_PV_ as its weathers, nothing else', () => {
    expect(pickEntries(HOTH)).toEqual({
      main: 'Levels/Lighting/Hoth/Sunny_01/VE_Sky_Arctic_Sunny_01',
      overrides: ['Levels/Lighting/Hoth/Sunset_01/VE_PV_Hoth_Sunset_01', 'Levels/Lighting/Hoth/Interior_01/VE_PV_Hoth_Interior_01'],
    });
  });

  it('finds the day and the weathers on levels that name them otherwise', () => {
    const endor = ['Levels/Lighting/Endor/Sunny_01/VE_PV_Endor_Sunny_01', 'Levels/Lighting/Endor/night_01/VE_PV_Endor_Night_01', 'Levels/Lighting/Endor/Foggy_01/VE_PV_Endor_Foggy_01', 'Levels/Lighting/Endor/Foggy_01/VE_PV_Endor_Foggy_Caves_01'];
    expect(pickEntries(endor)).toEqual({ main: endor[0], overrides: endor.slice(1) });
    const kashyyyk = ['Levels/Lighting/Kashyyyk/Interior_01/VE_PV_Kashyyyk_01_Night_Interior_01', 'Levels/Lighting/Kashyyyk/Interior_01/VE_PV_Kashyyyk_01_Interior_01', 'Levels/Lighting/Kashyyyk/Overcast_01/VE_PV_Kashyyyk_01_Overcast_01', 'Levels/Lighting/Kashyyyk/Overcast_01/VE_PV_Kashyyyk_01_Night_01'];
    // (the day's room, not the night's)
    expect(pickEntries(kashyyyk)).toEqual({ main: kashyyyk[2], overrides: [kashyyyk[1], kashyyyk[3]] });
    const geonosis = ['S5_1/Temp/Levels/MP/Geonosis_01/Lighting/Geonosis/VE_Sky_Geonosis_Caves', 'S5_1/Temp/Levels/MP/Geonosis_01/Lighting/Geonosis/VE_Sky_Geonosis_Obj03_ThickDust', 'S5_1/Temp/Levels/MP/Geonosis_01/Lighting/Geonosis/VE_Sky_Geonosis_Cloudy_IntroTeam', 'S5_1/Temp/Levels/MP/Geonosis_01/Lighting/Geonosis/VE_Sky_Geonosis_Cloudy_02'];
    expect(pickEntries(geonosis)).toEqual({ main: geonosis[3], overrides: [geonosis[0]] });
    expect(pickEntries(['S2/Levels/CloudCity_01/VE_Sky_Clouds_Dusk_Interiors_01', 'S2/Levels/CloudCity_01/VE_Sky_Clouds_Dusk_01'])).toEqual({ main: 'S2/Levels/CloudCity_01/VE_Sky_Clouds_Dusk_01', overrides: ['S2/Levels/CloudCity_01/VE_Sky_Clouds_Dusk_Interiors_01'] });
  });

  it('gives no main when the list has no sky', () => {
    expect(pickEntries(['Levels/Lighting/Global/VE_HighEnd_01'])).toEqual({ main: null, overrides: [] });
    expect(pickEntries(undefined)).toEqual({ main: null, overrides: [] });
  });

  it('keys a weather by its folder, lower case, without its number', () => {
    expect(weatherKey('Levels/Lighting/Hoth/Sunny_01/VE_Sky_Arctic_Sunny_01')).toBe('sunny');
    expect(weatherKey('Levels/Lighting/Hoth/Interior_01/VE_PV_Hoth_Interior_01')).toBe('interior');
    expect(weatherKey('Levels/Lighting/Naboo/Dusk/VE_PV_Naboo_Dusk')).toBe('dusk');
    expect(weatherKey('Lighting/VE/VE_No_Sun')).toBeNull();
    expect(weatherKey('S9_3/Scarif/Levels/MP/Scarif_02/Lighting/VE_Sky_Beach_Sunset_01')).toBe('sunset');
    expect(weatherKey('Levels/Lighting/Tatooine/VE_PV_Tatooine_Interior_01')).toBe('interior');
  });
});

describe('a record read', () => {
  const ve = readVE(toComponents(FIXTURE));

  it('reads the sun, the sky, the fog, the exposure, the grade, the wind and the bounce Hoth sets', () => {
    expect(ve.sun).toEqual({ color: [1, 0.9559066, 0.917619944], lux: 128000, az: 265.61, el: 32.943, sky: [0, 0, 0], ground: [0, 0, 0] });
    expect(ve.sky).toMatchObject({ luminance: 35000, sunSize: 0.004, panorama: 'Levels/Lighting/Hoth/Sunny_01/T_Hoth_Sunny_02_C' });
    expect(ve.fog).toMatchObject({ start: 50, end: 10000, height: 320 });
    expect(ve.fog.curve).toHaveLength(4);
    expect(ve.tonemap).toEqual({ compensation: 1.5, minEV: 11, maxEV: 15, bloom: 0.1 });
    expect(ve.grading).toEqual({ lut: 'Levels/Lighting/Hoth/Sunny_01/T_CC_Hoth_Sunny_01' });
    expect(ve.wind).toEqual({ dir: 0, strength: 5 });
    expect(ve.enlighten.sky).toEqual([0.840373158, 1.57825577, 3]);
  });

  it('leaves out what the record does not set, so it lays over nothing', () => {
    // (Brightness is in the record at its default, not among its overrides)
    expect(ve.grading.brightness).toBeUndefined();
    // (the fog's colour is off: the fog takes the sky's)
    expect(ve.fog.color).toBeUndefined();
    expect(readVE({})).toEqual({});
  });

  it('lays a weather over the main sky, field by field', () => {
    const sunset = { sun: { color: [1, 0.3, 0.1], lux: 22500, el: 10.25 }, tonemap: { maxEV: 10.4 } };
    const m = mergeVE(ve, sunset);
    expect(m.sun).toMatchObject({ color: [1, 0.3, 0.1], lux: 22500, el: 10.25, az: 265.61 });
    expect(m.tonemap).toEqual({ compensation: 1.5, minEV: 11, maxEV: 10.4, bloom: 0.1 });
    expect(m.fog).toBe(ve.fog);
  });
});

describe('the probes and the grade', () => {
  it('picks the folder named for each weather, and the main the first outdoor one left', () => {
    const v = ['Cloudy_VFX', 'Prefabs/PF_Hoth_RebelBase_01_Lighting', 'Sunset_VFX'];
    expect(pickVariants(v, ['sunny', 'sunset', 'interior'], 'sunny')).toEqual({ sunny: ['Cloudy_VFX'], sunset: ['Sunset_VFX'] });
    expect(pickVariants(['Sunny_VFX', 'Sunset_VFX'], ['sunny', 'sunset'], 'sunny')).toEqual({ sunny: ['Sunny_VFX'], sunset: ['Sunset_VFX'] });
    // (Kashyyyk: an indoor folder that names the weather is still indoors)
    expect(pickVariants(['Night_Lighting', 'Overcast_Indoor_DRV', 'Overcast_Lighting', 'Prefabs'], ['overcast', 'night', 'interior'], 'overcast')).toEqual({ overcast: ['Overcast_Lighting'], night: ['Night_Lighting'] });
    // (Tatooine: the town's own probes at the top, the buildings' never)
    expect(pickVariants(['', 'AuctionHouse_01', 'Bazaar_Dome_01/PF_MosEisley_BazaarDome_01', 'Cantina_01', 'DockingBay_01', 'Night_Light'], ['sunny', 'interior'], 'sunny')).toEqual({ sunny: [''] });
  });

  it('reads a probe’s sky over its ground, and sees a ceiling as no sky', () => {
    const n = 8;
    const face = (v) => new Float32Array(n * n * 3).fill(v);
    const open = { px: face(2), nx: face(2), pz: face(2), nz: face(2), py: face(6), ny: face(3) };
    const s = probeStats(open, n);
    expect(s.zenith).toEqual([6, 6, 6]);
    expect(s.horizon).toEqual([2, 2, 2]);
    expect(s.ground).toEqual([3, 3, 3]);
    expect(s.open).toBeCloseTo(3);
    expect(probeStats({ ...open, py: face(0.2) }, n).open).toBeCloseTo(0.1);
  });

  it('writes a face that reads back within RGBE’s step', () => {
    const px = new Float32Array([0, 0, 0, 1, 0.5, 0.25, 1000, 20, 3, 0.01, 0.02, 0.03]);
    const back = readHdr(writeHdr({ w: 2, h: 2, px }));
    expect(back.w).toBe(2);
    // (one exponent a pixel: each channel within a step of its pixel's brightest)
    for (let i = 0; i < px.length; i++) {
      const top = Math.max(px[i - (i % 3)], px[i - (i % 3) + 1], px[i - (i % 3) + 2]);
      expect(Math.abs(back.px[i] - px[i])).toBeLessThanOrEqual(top / 128);
    }
    expect(back.px[0]).toBe(0);
  });

  it('halves a face by averaging', () => {
    const px = new Float32Array(4 * 4 * 3).map((_, i) => (i % 3 === 0 ? Math.floor(i / 3) : 0));
    const out = shrinkFace(px, 4, 2);
    // (texels 0, 1, 4, 5 → 2.5)
    expect(out[0]).toBeCloseTo(2.5);
    expect(out.length).toBe(12);
  });

  it('lays the game’s slices into one strip, green turned the right way up', () => {
    const n = 3;
    // the game's: blue the slice, green the row from the top (row 0 is green 1), red the column
    const slices = [0, 1, 2].map((b) => {
      const s = new Uint16Array(n * n * 3);
      for (let row = 0; row < n; row++) for (let r = 0; r < n; r++) s.set([r * 100, (n - 1 - row) * 100, b * 100], (row * n + r) * 3);
      return s;
    });
    const strip = lutStrip(slices, n);
    // the strip: x = b·n + r, y = g
    const at = (r, g, b) => [...strip.slice((g * n * n + b * n + r) * 3, (g * n * n + b * n + r) * 3 + 3)];
    expect(at(0, 0, 0)).toEqual([0, 0, 0]);
    expect(at(2, 0, 0)).toEqual([200, 0, 0]);
    expect(at(0, 2, 0)).toEqual([0, 200, 0]);
    expect(at(0, 0, 2)).toEqual([0, 0, 200]);
    // and a 3³ halved to a 2³: the cube's corners
    const half = halveLut(slices, n);
    const at2 = (r, g, b) => [...half.slice((g * 4 + b * 2 + r) * 3, (g * 4 + b * 2 + r) * 3 + 3)];
    expect(at2(1, 1, 1)).toEqual([200, 200, 200]);
    expect(at2(1, 0, 0)).toEqual([200, 0, 0]);
  });
});

describe('a probe for the site', () => {
  it('clips what is brighter than the cap, keeping its hue, and leaves the rest', async () => {
    const { clipFaces } = await import('./bf2017-light.mjs');
    const faces = { px: new Float32Array([100, 50, 25, 1, 1, 1]) };
    clipFaces(faces, 10);
    const lum = (r, g, b) => r * 0.2126 + g * 0.7152 + b * 0.0722;
    expect(lum(...faces.px.slice(0, 3))).toBeCloseTo(10);
    expect(faces.px[0] / faces.px[1]).toBeCloseTo(2);
    expect([...faces.px.slice(3)]).toEqual([1, 1, 1]);
  });
});
