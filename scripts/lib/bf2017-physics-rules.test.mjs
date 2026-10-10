import { mkdtempSync, readFileSync, rmSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { HAND_JUMP, checkSources, loadAsset, refused, soldierRow, soldierRulebook } from './bf2017-physics-rules.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', 'fixtures', 'bf2017');
const SOLDIER = 'Gameplay/Characters/DefaultSoldierPhysics';
const HERO = 'Gameplay/Characters/Heroes/DefaultHeroPhysics';

describe('the soldier’s physics row', () => {
  const row = soldierRow(loadAsset(ROOT, SOLDIER));

  it('reads the body', () => {
    expect(row.id).toBe('DefaultSoldierPhysics');
    expect(row.mass).toBe(100);
    expect(row.radius).toBe(0.3);
    expect(row.ascend).toBe(45);
    expect(row.slide).toBe(45);
    expect(row.jumpPenalty).toMatchObject({ time: 0.1, factor: 0.2 });
    expect(row.rays).toMatchObject({ groundStart: 1.2, groundEnd: -1, airEnd: -4 });
    expect(row.radius_source).toBe(`${SOLDIER}#CharacterPhysicsData.PhysicalRadius`);
  });

  it('reads the poses', () => {
    expect(row.poses.stand).toMatchObject({ height: 1.7, step: 0.4, eye: [-0.15, 1.55, 0], transitions: { crouch: 0.2, prone: 0.7 } });
    expect(row.poses.crouch).toMatchObject({ height: 1.15, step: 0.3, transitions: { stand: 0.2 } });
    expect(row.poses.stand.height_source).toBe(`${SOLDIER}#CharacterPhysicsData.Poses[0].Height`);
  });

  it('walks on the ground state’s numbers, not the animation-controlled one’s', () => {
    const stand = row.states.onGround.poses.stand;
    expect(stand).toMatchObject({ velocity: 3.8, back: 0.8, left: 0.9, sprintMultiplier: 1.57, accelGain: 0.4, decelGain: -15 });
    expect(row.states.onGround.poses.crouch).toMatchObject({ velocity: 2.5, sprintMultiplier: 0 });
    expect(stand.velocity_source).toBe(`${SOLDIER}#OnGroundStateData.PoseInfo[0].Velocity`);
    expect(row.states.animation.poses.stand.velocity).toBe(5);
  });

  it('reads the other states', () => {
    expect(row.states.sliding.gravityScale).toBe(0.34);
    expect(row.states.inAir.freeFallVelocity).toBe(200);
    expect(row.states.onGround.fallWithGravityDistanceFromGround).toBe(0.8);
    expect(row.states.swimming).toMatchObject({ enter: 1.4, exit: 0.8, bodyUnderWater: 1.4 });
    expect(row.states.jump.jumpHeight).toBe(1.1);
    expect(row.states.jump.fallback).toBeUndefined();
  });

  it('gives every number its source', () => {
    expect(checkSources(row)).toEqual([]);
    const bare = structuredClone(row);
    delete bare.poses.stand.step_source;
    expect(checkSources(bare)).toEqual(['$.poses.stand.step']);
  });

  it('a record with no jump height takes the site’s jump, marked hand', () => {
    const hero = soldierRow(loadAsset(ROOT, HERO));
    expect(hero.states.jump.jumpHeight).toBe(0);
    expect(hero.states.jump.fallback).toEqual({ speed: HAND_JUMP, source: 'hand' });
    expect(checkSources(hero)).toEqual([]);
  });
});

describe('the soldier rulebook', () => {
  it('reads the records it finds, lists the missing and refuses the sequel era', () => {
    const book = soldierRulebook(ROOT, [SOLDIER, HERO, 'Gameplay/Characters/Nope', 'Gameplay/Kits/Hero/KyloRen/KyloPhysics']);
    expect(Object.keys(book.rows)).toEqual(['DefaultSoldierPhysics', 'DefaultHeroPhysics']);
    expect(book.default).toBe('DefaultSoldierPhysics');
    expect(book.missing).toEqual(['Gameplay/Characters/Nope']);
    expect(book.refused).toEqual(['Gameplay/Kits/Hero/KyloRen/KyloPhysics']);
    expect(refused('Gameplay/Characters/Heroes/BBHeroPhysics')).toBe(false);
  });

  it('reads a gzipped record as it reads a plain one', () => {
    const dir = mkdtempSync(join(tmpdir(), 'bf2017-rules-'));
    try {
      const at = join(dir, 'data', `${SOLDIER}.json.gz`);
      mkdirSync(dirname(at), { recursive: true });
      writeFileSync(at, gzipSync(readFileSync(join(ROOT, 'data', `${SOLDIER}.json`))));
      expect(soldierRulebook(dir, [SOLDIER]).rows.DefaultSoldierPhysics.radius).toBe(0.3);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
