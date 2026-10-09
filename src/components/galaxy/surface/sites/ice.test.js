import { existsSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { siteOf } from '.';
import { CREW, filesOf } from '../crewList';
import { SURFACE_MODELS, modelUrlFor } from '../catalog';
import { WALKERS } from '../walkers';
import { RIDES } from '../rides';
import { ASSAULTS } from '../missions/assaults';
import { STAND_INS } from '../cast';
import { dressOf } from '../ground/troops';

const onDisk = (url) => existsSync(new URL(`../../../../../public${url}`, import.meta.url));
const filesFor = (kind) => (CREW[kind] ? filesOf(CREW[kind]) : SURFACE_MODELS[kind] ? [modelUrlFor(kind, 'high')] : []);
const hoth = siteOf('hoth');

describe('Hoth, every one of them a model', () => {
  it('takes models only, and dresses the war in snow kit', () => {
    expect(hoth.cast).toBe('models');
    expect(hoth.uniforms).toEqual({ stormtrooper: 'snowtrooper', rebel: 'hothtrooper' });
  });

  it('every kind that lives on Hoth, inside and out, in its war and its battle, has a model on disk', () => {
    const kinds = new Set([
      ...hoth.life.map((a) => a.kind),
      ...hoth.rides.map((r) => RIDES[r.kind]?.figure).filter(Boolean),
      ...[ASSAULTS.hoth.sides.attack, ASSAULTS.hoth.sides.defend].flatMap((s) => s.kinds.map(([k]) => k)),
      ...['stormtrooper', 'rebel', 'mercenary', 'clone', 'battledroid', 'probe'].map((k) => dressOf(k, hoth.uniforms)),
    ]);
    for (const kind of kinds) {
      if (WALKERS[kind]) continue;
      const files = filesFor(kind);
      expect(files.length, `${kind} has no model`).toBeGreaterThan(0);
      for (const f of files) expect(onDisk(f), `${kind}: ${f}`).toBe(true);
    }
  });

  it('no built people stand in the props: Luke hangs in the cave as a model, and goes with the saber', () => {
    const luke = hoth.life.find((a) => a.id === 'hungluke');
    expect(luke).toMatchObject({ kind: 'luke', still: true });
    expect(luke.hang).toBeGreaterThan(3);
    const step = hoth.quests.find((q) => q.id === 'luke').steps.find((s) => s.id === 'saber');
    expect(step.end).toContainEqual({ hide: 'hungluke' });
    expect(hoth.things_all.some((t) => t.kind === 'atatfar')).toBe(false);
    const flights = hoth.things_all.filter((t) => t.kind === 'speederflight');
    expect(flights.length).toBeGreaterThan(0);
    for (const t of flights) expect(t.opts.built).toBe(false);
  });

  it('every stand-in Hoth may need is a model', () => {
    for (const kind of new Set(hoth.life.map((a) => a.kind))) if (STAND_INS[kind]) expect(filesFor(STAND_INS[kind]).length, kind).toBeGreaterThan(0);
  });
  it('everyone walks inside the world’s edge (past it an actor can’t take a step)', () => {
    for (const a of hoth.life.filter((a) => a.path && !a.zone)) for (const [x, z] of a.path) expect(Math.hypot(x, z), `${a.kind} at ${x}, ${z}`).toBeLessThan(hoth.reach - 5);
  });
});
