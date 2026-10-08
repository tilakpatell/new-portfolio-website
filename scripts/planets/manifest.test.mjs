import { describe, expect, it } from 'vitest';
import { LADDER, fileOf, format, kindOf, onLadder, recordSave, widths } from './manifest.mjs';

describe('the size ladder', () => {
  it('is 512, 1024, 2048 and a 4096 KTX2', () => {
    expect(LADDER).toEqual({ sm: 512, std: 1024, hq: 2048, xl: 4096 });
    expect(['sm', 'std', 'hq', 'xl'].map((r) => fileOf('middleearth', r))).toEqual(['middleearth-sm.webp', 'middleearth.webp', 'middleearth-hq.webp', 'middleearth-xl.ktx2']);
  });
  it('gives each rung its width, whatever the baker worked at', () => {
    expect(widths(['xl', 'hq', 'std', 'sm'], 4096)).toEqual([['xl', 4096], ['hq', 2048], ['std', 1024], ['sm', 512]]);
    expect(widths(['std', 'sm'], 2048)).toEqual([['std', 1024], ['sm', 512]]);
  });
  it('makes the std 2048 where the manifest flags it (Earth, Cybertron)', () => {
    expect(widths(['std', 'sm'], 4096, { std2048: true })).toEqual([['std', 2048], ['sm', 512]]);
    // (and an -hq no finer than that std is a mistake)
    expect(() => widths(['hq'], 4096, { std2048: true })).toThrow(/no finer/);
  });
  it('never upscales: no rung wider than the map was worked at, so an -xl only from 4096', () => {
    expect(() => widths(['xl'], 2048)).toThrow(/never upscaled/);
    expect(() => widths(['hq'], 1024)).toThrow(/never upscaled/);
    expect(() => widths(['big'], 4096)).toThrow(/no rung/);
  });
});

describe('the manifest', () => {
  it('records a save: its sizes, whether there is an -xl, its kind and colour space', () => {
    const m = recordSave({}, 'middleearth', { xl: [4096, 2048], std: [1024, 512], sm: [512, 256] });
    expect(m).toEqual({ middleearth: { sizes: { sm: [512, 256], std: [1024, 512], xl: [4096, 2048] }, xl: 'ktx2', kind: 'colour', srgb: true } });
    expect(recordSave({}, 'office-rough', { std: [1024, 512] })['office-rough']).toEqual({ sizes: { std: [1024, 512] }, xl: null, kind: 'rough', srgb: false });
  });
  it('merges a second save of the same map (Middle-earth’s steeper -hq relief)', () => {
    let m = recordSave({}, 'middleearth-normal', { hq: [2048, 1024] });
    m = recordSave(m, 'middleearth-normal', { std: [1024, 512], sm: [512, 256] });
    expect(m['middleearth-normal'].sizes).toEqual({ sm: [512, 256], std: [1024, 512], hq: [2048, 1024] });
    // (and a re-bake's new size for a rung takes the old one's place)
    m = recordSave(m, 'middleearth-normal', { sm: [256, 128] });
    expect(m['middleearth-normal'].sizes.sm).toEqual([256, 128]);
  });
  it('keeps a map’s colour space and flag from before, and the other maps as they were', () => {
    let m = recordSave({}, 'transformers-glow', { std: [2048, 1024] }, { srgb: false, std2048: true });
    m = recordSave(m, 'transformers-glow', { sm: [512, 256] });
    m = recordSave(m, 'music', { std: [1024, 512] });
    expect(m['transformers-glow']).toEqual({ sizes: { sm: [512, 256], std: [2048, 1024] }, xl: null, kind: 'glow', srgb: false, std2048: true });
    expect(Object.keys(m)).toEqual(['transformers-glow', 'music']);
  });
  it('replaces a map recorded from disk: its files are the whole truth', () => {
    let m = recordSave({}, 'earth', { std: [2048, 1024], hq: [4096, 2048] }, { std2048: true });
    m = recordSave(m, 'earth', { std: [2048, 1024], sm: [1024, 512] }, { replace: true });
    expect(m.earth.sizes).toEqual({ sm: [1024, 512], std: [2048, 1024] });
    expect(m.earth.std2048).toBe(true);
  });
  it('knows a map’s kind by its name', () => {
    expect(['earth', 'earth-night', 'earth-clouds', 'earth-rough', 'paper-normal', 'sky-glow', 'transformers-glow'].map(kindOf)).toEqual(['colour', 'night', 'clouds', 'rough', 'normal', 'glow', 'glow']);
  });
  it('says which rungs are off the ladder', () => {
    expect(onLadder({ sizes: { sm: [512, 256], std: [1024, 512], hq: [2048, 1024], xl: [4096, 2048] } })).toEqual([]);
    expect(onLadder({ sizes: { sm: [512, 256], std: [2048, 1024] }, std2048: true })).toEqual([]);
    // (Earth's, as the Python makes it: a 1024 -sm, a 4096 -hq; the plates, square)
    expect(onLadder({ sizes: { sm: [1024, 512], std: [2048, 1024], hq: [4096, 2048] }, std2048: true })).toEqual(['sm', 'hq']);
    expect(onLadder({ sizes: { std: [512, 512] } })).toEqual(['std']);
  });
  it('is written sorted, an entry a line, whatever order the bake ran in', () => {
    const a = recordSave(recordSave({}, 'office', { std: [1024, 512] }), 'earth', { std: [2048, 1024] });
    const b = recordSave(recordSave({}, 'earth', { std: [2048, 1024] }), 'office', { std: [1024, 512] });
    expect(format(a)).toBe(format(b));
    expect(format(a).split('\n')).toEqual(['{', '  "earth": {"sizes":{"std":[2048,1024]},"xl":null,"kind":"colour","srgb":true},', '  "office": {"sizes":{"std":[1024,512]},"xl":null,"kind":"colour","srgb":true}', '}', '']);
    expect(JSON.parse(format(a))).toEqual(a);
  });
});
