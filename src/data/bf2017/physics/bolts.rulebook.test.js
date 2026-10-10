// Lane P2's three rulebooks (built by scripts/bf2017-bolts-data.mjs): every
// number has a source, nothing of the sequel era got in, and the rows the
// site and the game reach for are there.
import { describe, expect, it } from 'vitest';
import bones from './bones.json';
import projectiles from './projectiles.json';
import ragdoll from './ragdoll.json';

// (scripts/lib/bf2017-physics-rules.mjs's checkSources, copied: src/data imports nothing from scripts)
const isNum = (v) => typeof v === 'number' && Number.isFinite(v);
function checkSources(json) {
  const bad = [];
  const walk = (v, at, hand) => {
    if (Array.isArray(v)) return v.forEach((x, i) => walk(x, `${at}[${i}]`, hand));
    if (!v || typeof v !== 'object') return;
    const here = hand || v.source === 'hand';
    for (const [k, x] of Object.entries(v)) {
      if (k.endsWith('_source')) continue;
      const sourced = here || v[`${k}_source`] !== undefined;
      if (isNum(x) && !sourced) bad.push(`${at}.${k}`);
      else if (Array.isArray(x) && x.every(isNum)) {
        if (!sourced && x.length) bad.push(`${at}.${k}`);
      } else walk(x, `${at}.${k}`, here);
    }
  };
  walk(json, '$', false);
  return bad;
}

const SEQUEL = /kyloren|(^|[_/])rey($|[_/])|(^|[_/])finn($|[_/])|phasma|firstorder|starkiller|takodana|jakku|resurgent|xwing_t70|tiefighterspecialforces|resistance|newera|crait|bb9e|astromechbb/i;

describe('lane P2’s physics rulebooks', () => {
  it('source every number', () => {
    expect(checkSources(projectiles)).toEqual([]);
    expect(checkSources(bones)).toEqual([]);
    expect(checkSources(ragdoll)).toEqual([]);
  });

  it('hold nothing of the sequel era', () => {
    for (const r of [...projectiles.rows, ...bones.sets, ...ragdoll.rows]) expect(r.name).not.toMatch(SEQUEL);
  });

  it('have the rifle’s bolt, the grenades and the stun shot', () => {
    const by = Object.fromEntries(projectiles.rows.map((r) => [r.id, r]));
    expect(by.blasterprojectile_blasterrifle_a295).toMatchObject({ kind: 'bolt', speed: 350, gravity: 0 });
    expect(by.impact_projectile.kind).toBe('grenade');
    expect(by.thermal_detonator_projectile.gravity).toBe(-9.8);
    expect(by.blasterprojectile_pistol_sidearm_stunaltfire.blast.radius).toBe(2);
    expect(new Set(projectiles.rows.map((r) => r.id)).size).toBe(projectiles.rows.length);
  });

  it('have the soldier’s capsules and every ragdoll’s fifteen bodies', () => {
    const soldier = bones.sets.find((s) => s.id === 'defaultsoldierbonecollision');
    expect(soldier.bones.find((b) => b.bone === 'Head').radius).toBe(0.16);
    const ids = new Set(ragdoll.rows.map((r) => r.id));
    for (const r of ragdoll.rows) {
      if (r.bodiesOf) expect(ids.has(r.bodiesOf)).toBe(true);
      else if (!r.partial) expect(r.bodies).toHaveLength(15);
      expect(r.maxImpulse).toBeGreaterThan(0);
    }
    const trooper = ragdoll.rows.find((r) => r.id === 'stormtroopershared');
    const bodies = trooper.bodies ?? ragdoll.rows.find((r) => r.id === trooper.bodiesOf).bodies;
    expect(bodies).toHaveLength(15);
    expect(ragdoll.rows.filter((r) => r.partial).length).toBeLessThanOrEqual(3);
  });
});
