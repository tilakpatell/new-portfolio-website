import { describe, expect, it } from 'vitest';
import { BUDGETS, budget, classifyDevice, worldCheck } from './device';

const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';
const PIXEL = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Mobile Safari/537.36';
const IPAD_DESKTOP = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15';
const WINDOWS = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';

describe('telling what a device can afford', () => {
  it('gives a desktop with a graphics chip everything', () => {
    expect(classifyDevice({ ua: WINDOWS, memory: 16, cores: 12, renderer: 'ANGLE (NVIDIA, NVIDIA GeForce RTX 3060 Direct3D11)' })).toMatchObject({ tier: 'high', phone: false, why: [] });
  });

  it('starts a recent phone in the middle', () => {
    expect(classifyDevice({ ua: IPHONE, coarse: true, screen: 390, renderer: 'Apple GPU' })).toMatchObject({ tier: 'mid', phone: true, why: ['phone'] });
    expect(classifyDevice({ ua: PIXEL, coarse: true, screen: 412, memory: 8, cores: 8, renderer: 'Mali-G715' })).toMatchObject({ tier: 'mid', phone: true });
  });

  it('knows an iPad asking for the desktop site is a tablet', () => {
    expect(classifyDevice({ ua: IPAD_DESKTOP, touchPoints: 5, screen: 820 })).toMatchObject({ tier: 'mid', phone: true });
    expect(classifyDevice({ ua: IPAD_DESKTOP, touchPoints: 0, screen: 1440 })).toMatchObject({ tier: 'high', phone: false });
  });

  it('puts budget phones and their graphics chips low', () => {
    expect(classifyDevice({ ua: PIXEL, coarse: true, screen: 360, memory: 2, renderer: 'Adreno (TM) 610' })).toMatchObject({ tier: 'low', why: ['memory'] });
    for (const renderer of ['Mali-G52 MC2', 'Adreno (TM) 506', 'PowerVR Rogue GE8320', 'Mali-T830']) {
      expect(classifyDevice({ ua: PIXEL, coarse: true, screen: 360, memory: 4, renderer }).tier).toBe('low');
    }
    // the same chips' newer siblings are fine
    for (const renderer of ['Adreno (TM) 740', 'Mali-G78', 'Mali-G715']) {
      expect(classifyDevice({ ua: PIXEL, coarse: true, screen: 412, memory: 8, renderer }).tier).toBe('mid');
    }
  });

  it('puts software WebGL low wherever it runs', () => {
    expect(classifyDevice({ ua: WINDOWS, memory: 16, renderer: 'SwiftShader', software: true })).toMatchObject({ tier: 'low', why: ['software'] });
  });

  it('starts small or low-memory computers in the middle', () => {
    expect(classifyDevice({ ua: WINDOWS, memory: 4, cores: 4 })).toMatchObject({ tier: 'mid', why: ['memory'] });
    expect(classifyDevice({ ua: WINDOWS, memory: 8, cores: 2 })).toMatchObject({ tier: 'low', why: ['cores'] });
  });

  it('hears Data Saver and a 2G connection', () => {
    expect(classifyDevice({ ua: IPHONE, saveData: true }).saveData).toBe(true);
    expect(classifyDevice({ ua: PIXEL, net: 'slow-2g' }).saveData).toBe(true);
    expect(classifyDevice({ ua: PIXEL, net: '2g' }).saveData).toBe(true);
    expect(classifyDevice({ ua: PIXEL, net: '4g' }).saveData).toBe(false);
  });

  it('lets a pinned quality win', () => {
    expect(classifyDevice({ ua: WINDOWS, memory: 16, override: 'low' }).tier).toBe('low');
    expect(classifyDevice({ ua: IPHONE, override: 'high' }).tier).toBe('high');
    expect(classifyDevice({ ua: IPHONE, override: 'ultra' }).tier).toBe('mid');
  });
});

describe('budgets', () => {
  it('step down with the tier', () => {
    expect(budget('high').ratio).toBeGreaterThan(budget('mid').ratio);
    expect(budget('mid').ratio).toBeGreaterThan(budget('low').ratio);
    expect(budget('low')).toMatchObject({ shadows: false, bloom: 0, samples: 0, antialias: false });
    expect(budget('nonsense')).toBe(BUDGETS.high);
  });
});

describe('whether a world asks before it loads', () => {
  const desktop = classifyDevice({ ua: WINDOWS, memory: 16 });
  const phone = classifyDevice({ ua: IPHONE, coarse: true, screen: 390 });
  const weak = classifyDevice({ ua: PIXEL, coarse: true, memory: 2 });
  const saver = classifyDevice({ ua: WINDOWS, memory: 16, saveData: true });

  it('never asks a desktop', () => {
    expect(worldCheck(12, desktop)).toEqual({ ask: false, why: null });
  });

  it('lets a phone load light worlds and asks about heavy ones', () => {
    expect(worldCheck(2, phone).ask).toBe(false);
    expect(worldCheck(10, phone)).toEqual({ ask: true, why: 'phone' });
  });

  it('asks a weak device about anything but the lightest', () => {
    expect(worldCheck(2, weak)).toEqual({ ask: true, why: 'weak' });
    expect(worldCheck(0.5, weak).ask).toBe(false);
  });

  it('asks whenever the visitor is saving data', () => {
    expect(worldCheck(2, saver)).toEqual({ ask: true, why: 'data' });
  });

  it('asks when there is too little room left', () => {
    expect(worldCheck(6, desktop, 10)).toEqual({ ask: true, why: 'storage' });
    expect(worldCheck(6, desktop, 5000).ask).toBe(false);
  });
});
