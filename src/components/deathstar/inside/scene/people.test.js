import * as THREE from 'three';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { FAR, LIVE, aimAngles, clipFor, createPeople, createTrack, liveCount, lodPick } from './people';

const STEP = 1 / 30;
const person = (id, kind, x, z, more = {}) => ({ id, kind, x, y: 0, z, yaw: 0, room: 'corr327', hp: 60, mode: 'routine', anim: 'idle', aim: null, ...more });
const kit = { mat: () => new THREE.MeshStandardMaterial() };

describe('how many people move near you', () => {
  it('animates 24 on a high tier, 14 on a middling one and 8 on a low one', () => {
    expect(LIVE).toMatchObject({ high: 24, mid: 14, low: 8 });
    expect(liveCount('high')).toBe(24);
    expect(liveCount('ultra')).toBe(24);
    expect(liveCount('mid')).toBe(14);
    expect(liveCount('low')).toBe(8);
    expect(liveCount('unknown')).toBe(8);
  });
});

describe('who moves, who stands still and who is hidden', () => {
  const crowd = Array.from({ length: 10 }, (_, i) => ({ id: `p${i}`, x: i * 5, y: 0, z: 0 }));

  it('animates the nearest few, poses the rest still and hides anyone past 60 m', () => {
    const pick = lodPick([...crowd, { id: 'far', x: FAR + 1, y: 0, z: 0 }], { x: 0, y: 1.6, z: 0 }, { count: 3 });
    expect(['p0', 'p1', 'p2'].map((id) => pick.get(id))).toEqual(['live', 'live', 'live']);
    expect(['p3', 'p9'].map((id) => pick.get(id))).toEqual(['still', 'still']);
    expect(pick.get('far')).toBe('hidden');
    expect(FAR).toBe(60);
  });

  it('picks by distance from wherever the camera stands', () => {
    const pick = lodPick(crowd, { x: 45, y: 0, z: 0 }, { count: 2 });
    expect(pick.get('p9')).toBe('live');
    expect(pick.get('p8')).toBe('live');
    expect(pick.get('p0')).toBe('still');
  });

  it('gives a body that has finished falling no turn at moving, but keeps it drawn', () => {
    const pick = lodPick([{ id: 'body', x: 1, y: 0, z: 0, settled: true }, ...crowd], { x: 0, y: 0, z: 0 }, { count: 2 });
    expect(pick.get('body')).toBe('still');
    expect(pick.get('p0')).toBe('live');
    expect(pick.get('p1')).toBe('live');
  });

  it('hides someone in a room that isn’t drawn', () => {
    const pick = lodPick([{ id: 'away', x: 1, y: 0, z: 0, shown: false }], { x: 0, y: 0, z: 0 }, { count: 2 });
    expect(pick.get('away')).toBe('hidden');
  });
});

describe('what a person is seen doing', () => {
  it('walks on its gait with its gun carried low while about its work', () => {
    expect(clipFor(person('a', 'stormtrooper', 0, 0, { anim: 'walk' }))).toEqual({ clip: null, loop: false, raised: false });
  });

  it('raises its gun in a fight, and fires on the shooting clip over and over while shooting', () => {
    expect(clipFor(person('a', 'stormtrooper', 0, 0, { mode: 'fight', anim: 'run' })).raised).toBe(true);
    expect(clipFor(person('a', 'stormtrooper', 0, 0, { mode: 'fight', anim: 'aim' }))).toEqual({ clip: null, loop: false, raised: true });
    expect(clipFor(person('a', 'stormtrooper', 0, 0, { mode: 'fight', anim: 'shoot' }))).toEqual({ clip: 'shoot', loop: true, raised: true });
  });

  it('flinches once when hit and kneels for as long as it kneels', () => {
    expect(clipFor(person('a', 'stormtrooper', 0, 0, { anim: 'hit' }))).toMatchObject({ clip: 'hit', loop: false });
    expect(clipFor(person('a', 'stormtrooper', 0, 0, { anim: 'kneel' }))).toMatchObject({ clip: 'kneel', loop: true });
  });

  it('falls when dead, the same fall for the same person every time, and is blown down when knocked over', () => {
    const fall = clipFor(person('tk-7', 'stormtrooper', 0, 0, { mode: 'dead', anim: 'die' }));
    expect(['die', 'dieFwd']).toContain(fall.clip);
    expect(fall.loop).toBe(false);
    expect(clipFor(person('tk-7', 'stormtrooper', 0, 0, { mode: 'dead', anim: 'die' }))).toEqual(fall);
    const falls = new Set(Array.from({ length: 20 }, (_, i) => clipFor(person(`tk-${i}`, 'stormtrooper', 0, 0, { mode: 'dead' })).clip));
    expect(falls.size).toBe(2);
    expect(clipFor(person('a', 'stormtrooper', 0, 0, { mode: 'down', anim: 'hit' })).clip).toBe('dieBlown');
  });
});

describe('where a person aims, from where it faces', () => {
  it('is straight ahead for a mark in front at its own height', () => {
    const a = aimAngles({ x: 0, y: 1.4, z: 0 }, 0, { x: 0, y: 1.4, z: -10 });
    expect(a.yaw).toBeCloseTo(0);
    expect(a.pitch).toBeCloseTo(0);
  });

  it('turns right (+) for a mark to its right and tilts up for one above', () => {
    expect(aimAngles({ x: 0, y: 1.4, z: 0 }, 0, { x: 10, y: 1.4, z: 0 }).yaw).toBeCloseTo(Math.PI / 2);
    expect(aimAngles({ x: 0, y: 1.4, z: 0 }, Math.PI / 2, { x: 10, y: 1.4, z: 0 }).yaw).toBeCloseTo(0);
    expect(aimAngles({ x: 0, y: 1.4, z: 0 }, 0, { x: 0, y: 11.4, z: -10 }).pitch).toBeCloseTo(Math.PI / 4);
  });
});

describe('a person drawn between the game’s steps', () => {
  it('stands between its last two steps by how far the frame is through the next', () => {
    const track = createTrack();
    track.push({ x: 0, y: 0, z: 0, yaw: 0 }, 0);
    track.push({ x: 0, y: 0, z: -0.05, yaw: 0 }, STEP);
    expect(track.at(0.5).z).toBeCloseTo(-0.025);
    expect(track.speed()).toBeCloseTo(1.5);
  });

  it('settles where it stopped instead of swinging between its last two steps', () => {
    const track = createTrack();
    track.push({ x: 0, y: 0, z: 0, yaw: 0 }, 0);
    track.push({ x: 0, y: 0, z: -0.05, yaw: 0 }, STEP);
    for (let i = 0; i < 4; i++) track.push({ x: 0, y: 0, z: -0.05, yaw: 0 }, STEP);
    expect(track.at(0).z).toBeCloseTo(-0.05);
    expect(track.speed()).toBe(0);
  });

  it('turns the short way round between two headings', () => {
    const track = createTrack();
    track.push({ x: 0, y: 0, z: 0, yaw: Math.PI - 0.1 }, 0);
    track.push({ x: 0, y: 0, z: 0.01, yaw: -Math.PI + 0.1 }, STEP);
    expect(Math.abs(track.at(0.5).yaw)).toBeCloseTo(Math.PI);
  });

  it('is drawn where it lands after a ride or a teleport, not swept across', () => {
    const track = createTrack();
    track.push({ x: 0, y: 0, z: 0, yaw: 0 }, 0);
    track.push({ x: 0, y: 12, z: 0, yaw: 0 }, STEP);
    expect(track.at(0).y).toBe(12);
  });
});

describe('the people aboard, drawn', () => {
  afterEach(() => vi.restoreAllMocks());

  const crewOf = (...people) => ({ people: new Map(people.map((p) => [p.id, p])) });
  const shown = (scene, name) => {
    const found = [];
    scene.traverse((o) => o.name === name && found.push(o));
    return found;
  };

  it('builds Chewbacca, the IT-O and the dianoga in code, each standing where the crew has it, facing its way', () => {
    const scene = new THREE.Scene();
    const people = createPeople(scene, kit, { tier: 'high' });
    people.sync(crewOf(person('chewie', 'chewie', 2, -3, { yaw: Math.PI / 2 }), person('ito', 'ito', -1, 0), person('dianoga', 'dianoga', 5, 5)), 1, { x: 0, y: 1.6, z: 0 });
    const [chewie] = shown(scene, 'person-chewie');
    expect(chewie.position.toArray()).toEqual([2, 0, -3]);
    expect(chewie.rotation.y).toBeCloseTo(-Math.PI / 2);
    expect(shown(scene, 'person-ito')).toHaveLength(1);
    expect(shown(scene, 'person-dianoga')).toHaveLength(1);
    people.dispose();
  });

  it('makes Chewbacca his full height, the IT-O a small sphere at a man’s eye height, and the dianoga’s eye up out of the water', () => {
    const scene = new THREE.Scene();
    const people = createPeople(scene, kit, { tier: 'high' });
    people.sync(crewOf(person('chewie', 'chewie', 0, 0), person('ito', 'ito', 10, 0), person('dianoga', 'dianoga', 20, 0)), 1, { x: 0, y: 1.6, z: 0 });
    const box = (name) => new THREE.Box3().setFromObject(shown(scene, name)[0]);
    const chewie = box('person-chewie');
    expect(chewie.max.y).toBeCloseTo(2.28, 1);
    expect(chewie.min.y).toBeCloseTo(0, 1);
    const ito = box('person-ito');
    expect(ito.min.y).toBeGreaterThan(1);
    expect(ito.max.y).toBeLessThan(2);
    expect(ito.max.x - ito.min.x).toBeLessThan(0.8);
    const [eye] = shown(scene, 'dianoga-eye');
    expect(eye.getWorldPosition(new THREE.Vector3()).y).toBeGreaterThan(1.4);
    people.dispose();
  });

  it('hides someone past 60 m and shows them again as you come near', () => {
    const scene = new THREE.Scene();
    const people = createPeople(scene, kit, { tier: 'low' });
    const crew = crewOf(person('chewie', 'chewie', 70, 0));
    people.sync(crew, 1, { x: 0, y: 1.6, z: 0 });
    const [chewie] = shown(scene, 'person-chewie');
    expect(chewie.visible).toBe(false);
    people.sync(crew, 1, { x: 30, y: 1.6, z: 0 });
    expect(chewie.visible).toBe(true);
    people.dispose();
  });

  it('leaves a body where it fell, and lets it go once its room is freed', () => {
    const scene = new THREE.Scene();
    const people = createPeople(scene, kit, { tier: 'low' });
    const crew = crewOf(person('chewie', 'chewie', 4, 0, { mode: 'dead', anim: 'die', hp: 0 }));
    people.sync(crew, 1, { x: 0, y: 1.6, z: 0 }, () => true);
    expect(shown(scene, 'person-chewie')).toHaveLength(1);
    people.sync(crew, 1, { x: 0, y: 1.6, z: 0 }, () => false);
    expect(shown(scene, 'person-chewie')).toHaveLength(0);
    people.sync(crew, 1, { x: 0, y: 1.6, z: 0 }, () => true);
    expect(shown(scene, 'person-chewie')).toHaveLength(0);
    people.dispose();
  });

  it('takes out of the scene anyone the crew no longer has', () => {
    const scene = new THREE.Scene();
    const people = createPeople(scene, kit, { tier: 'low' });
    people.sync(crewOf(person('ito', 'ito', 1, 0)), 1, { x: 0, y: 0, z: 0 });
    expect(shown(scene, 'person-ito')).toHaveLength(1);
    people.sync(crewOf(), 1, { x: 0, y: 0, z: 0 });
    expect(shown(scene, 'person-ito')).toHaveLength(0);
    people.dispose();
  });

  it('puts a trooper’s own E-11 in his hands, its muzzle where a shot leaves from', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const scene = new THREE.Scene();
    const people = createPeople(scene, kit, { tier: 'high' });
    const crew = crewOf(person('tk', 'stormtrooper', 0, -4, { mode: 'fight', anim: 'aim', aim: { x: 0, y: 1.4, z: -20 } }));
    await vi.waitFor(() => {
      people.sync(crew, 1, { x: 0, y: 1.6, z: 0 });
      expect(shown(scene, 'person-stormtrooper')).toHaveLength(1);
    });
    people.sync(crew, 1, { x: 0, y: 1.6, z: 0 });
    expect(shown(scene, 'blaster-e11')).toHaveLength(1);
    const muzzle = people.muzzle('tk', new THREE.Vector3());
    expect(muzzle.z).toBeLessThan(-4);
    expect(muzzle.y).toBeGreaterThan(0.6);
    people.dispose();
  });
});
