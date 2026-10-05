import { describe, expect, it } from 'vitest';
import { BUILD_SLOTS, MODULES, isModuleOpen, moduleById, modulesFor } from './parts';

const MOUNT_KEYS = ['pod', 'corner', 'pipe', 'gun', 'belly', 'emitter', 'badge', 'fin', 'ring'];

describe('the shipyard modules', () => {
  it('has the slots in build order', () => {
    expect(BUILD_SLOTS).toEqual(['hull', 'cockpit', 'wings', 'engines', 'tail', 'extras']);
  });

  it('offers at least three modules a slot, the first open to everyone', () => {
    for (const slot of BUILD_SLOTS) {
      const list = modulesFor(slot);
      expect(list.length).toBeGreaterThanOrEqual(3);
      expect(list[0].achievement).toBeNull();
      expect(isModuleOpen(list[0], [])).toBe(true);
    }
  });

  it('never repeats an id within a slot, and finds each by it', () => {
    for (const slot of BUILD_SLOTS) {
      const ids = modulesFor(slot).map((m) => m.id);
      expect(new Set(ids).size).toBe(ids.length);
      for (const id of ids) expect(moduleById(slot, id).id).toBe(id);
    }
    expect(moduleById('wings', 'nope')).toBeNull();
    expect(moduleById('nope', 'swept')).toBeNull();
  });

  it('gives every hull the sockets the rest snap to, and the hardpoints the hangar bolts its parts on', () => {
    for (const h of modulesFor('hull')) {
      const s = h.sockets;
      for (const k of ['cockpit', 'tail', 'top']) expect(s[k]).toHaveLength(3);
      expect(s.wing.length).toBeGreaterThanOrEqual(3);
      for (const n of [1, 2, 4]) expect(s.engine[n]).toHaveLength(n);
      for (const k of MOUNT_KEYS) expect(s.mounts[k], `${h.id} ${k}`).toBeDefined();
      expect(Boolean(s.mounts.plate) !== Boolean(s.mounts.belt)).toBe(true);
      expect(h.does.plant).toBeGreaterThanOrEqual(5);
      expect(h.does.plant).toBeLessThanOrEqual(10);
    }
  });

  it('gives every wing a tip, and every engine set a count of 1, 2 or 4', () => {
    for (const w of modulesFor('wings')) expect(w.sockets.tip).toHaveLength(3);
    for (const e of modulesFor('engines')) expect([1, 2, 4]).toContain(e.count);
  });

  it('keeps three modules for those who have earned them', () => {
    const locked = MODULES.filter((m) => m.achievement).map((m) => [m.slot, m.id, m.achievement]);
    expect(locked).toEqual(
      expect.arrayContaining([
        ['engines', 'ring', 'showmewhatyougot'],
        ['hull', 'saucer', 'offthegrid'],
        ['extras', 'dish', 'trench'],
      ]),
    );
    expect(locked).toHaveLength(3);
    const ring = moduleById('engines', 'ring');
    expect(isModuleOpen(ring, [])).toBe(false);
    expect(isModuleOpen(ring, ['showmewhatyougot'])).toBe(true);
    expect(ring.hint).toMatch(/\w/);
  });
});
