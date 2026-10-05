import { describe, expect, it } from 'vitest';
import { FAN_THEMES, THEME_ORDER } from '../../theme/themes';
import { ACHIEVEMENTS } from '../Achievements';
import { PAINTS, STOCK, isOpen, paintById, paintsFor, parsePaint } from './paint';

const HEX = /^#[0-9a-f]{6}$/;

describe('the paint jobs', () => {
  it('are the factory’s, then every company’s colors, then every fan scheme’s, each once', () => {
    expect(PAINTS[0].id).toBe(STOCK);
    expect(PAINTS.filter((p) => p.group === 'company').map((p) => p.id)).toEqual(THEME_ORDER);
    expect(PAINTS.filter((p) => p.group === 'fan').map((p) => p.id)).toEqual(FAN_THEMES.map((f) => f.id));
    expect(new Set(PAINTS.map((p) => p.id)).size).toBe(PAINTS.length);
  });

  it('each has a hull, a trim, a glow and a bolt color, and a name', () => {
    for (const p of PAINTS.filter((q) => q.id !== STOCK)) {
      for (const k of ['hull', 'trim', 'glow', 'bolt']) expect(p[k], `${p.id} ${k}`).toMatch(HEX);
      expect(p.name, p.id).toBeTruthy();
      expect(p.hull, `${p.id}: a trim that shows`).not.toBe(p.trim);
    }
  });

  it('each but the factory’s is unlocked by an achievement there is, with a hint', () => {
    for (const p of PAINTS.filter((q) => q.id !== STOCK)) {
      expect(ACHIEVEMENTS[p.achievement], p.id).toBeTruthy();
      expect(p.hint, p.id).toBeTruthy();
    }
    expect(paintById(STOCK).achievement).toBeNull();
  });

  it('come in with the achievement that unlocks their scheme on the site', () => {
    for (const f of FAN_THEMES) expect(paintById(f.id).achievement, f.id).toBe(f.achievement);
    expect(paintsFor('cartographer').map((p) => p.id)).toEqual(THEME_ORDER);
    expect(paintsFor('rollout').map((p) => p.id)).toEqual(['optimus', 'megatron', 'bumblebee', 'shockwave', 'soundwave']);
    expect(paintsFor('resume')).toEqual([]);
  });
});

describe('picking and keeping a paint', () => {
  it('knows the factory’s is always open, and the rest only once earned', () => {
    expect(isOpen(paintById(STOCK), [])).toBe(true);
    expect(isOpen(paintById('aws'), [])).toBe(false);
    expect(isOpen(paintById('aws'), ['cartographer'])).toBe(true);
    expect(isOpen(paintById('sith'), ['cartographer'])).toBe(false);
    expect(isOpen(paintById('sith'), ['order66'])).toBe(true);
  });

  it('believes only paint ids it has', () => {
    expect(parsePaint('aws')).toBe('aws');
    expect(parsePaint(STOCK)).toBe(STOCK);
    for (const junk of ['AWS', '#ff9900', '__proto__', 'constructor', 'toString', '', null, undefined, 7, {}, ['aws']]) expect(parsePaint(junk)).toBeNull();
    expect(paintById('nonsense').id).toBe(STOCK);
  });
});
