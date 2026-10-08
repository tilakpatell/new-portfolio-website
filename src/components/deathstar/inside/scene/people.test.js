import * as THREE from 'three';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
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

  it('gives a body still going down a turn at moving before anyone living, however far off it lies', () => {
    const pick = lodPick([...crowd, { id: 'falling', x: 40, y: 0, z: 0, falling: true }], { x: 0, y: 0, z: 0 }, { count: 2 });
    expect(pick.get('falling')).toBe('live');
    expect(pick.get('p0')).toBe('live');
    expect(pick.get('p1')).toBe('still');
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
  // Node can’t fetch a model’s relative URL at all, and three’s FileLoader, thrown by it mid-request,
  // leaves any later load of the same file waiting for ever: every model is answered as a browser
  // would answer a missing one, so each figure stands in as a capsule however often its file is asked for
  beforeEach(() => {
    const Real = globalThis.Request;
    vi.stubGlobal('Request', class extends Real {
      constructor(url, init) {
        super(new URL(url, 'http://localhost/'), init);
      }
    });
    vi.stubGlobal('fetch', async () => new Response(null, { status: 404 }));
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  const crewOf = (...people) => ({ people: new Map(people.map((p) => [p.id, p])) });
  const shown = (scene, name) => {
    const found = [];
    scene.traverse((o) => o.name === name && found.push(o));
    return found;
  };
  const box = (o) => new THREE.Box3().setFromObject(o);
  const eye = { x: 0, y: 1.6, z: 0 };
  const frame = { dt: STEP };
  // figures are made two a frame: enough frames for everyone near to have one
  const syncs = (people, crew, n = 6, at = eye, rooms = frame) => {
    for (let i = 0; i < n; i++) people.sync(crew, 1, at, rooms);
  };

  it('builds Chewbacca, the IT-O and the dianoga in code, each standing where the crew has it, facing its way', () => {
    const scene = new THREE.Scene();
    const people = createPeople(scene, kit, { tier: 'high' });
    syncs(people, crewOf(person('chewie', 'chewie', 2, -3, { yaw: Math.PI / 2 }), person('ito', 'ito', -1, 0), person('dianoga', 'dianoga', 5, 5)));
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
    syncs(people, crewOf(person('chewie', 'chewie', 0, 0), person('ito', 'ito', 10, 0), person('dianoga', 'dianoga', 20, 0)));
    const chewie = box(shown(scene, 'person-chewie')[0]);
    expect(chewie.max.y).toBeCloseTo(2.28, 1);
    expect(chewie.min.y).toBeCloseTo(0, 1);
    const ito = box(shown(scene, 'person-ito')[0]);
    expect(ito.min.y).toBeGreaterThan(1);
    expect(ito.max.y).toBeLessThan(2);
    expect(ito.max.x - ito.min.x).toBeLessThan(0.8);
    const [eyeball] = shown(scene, 'dianoga-eye');
    expect(eyeball.getWorldPosition(new THREE.Vector3()).y).toBeGreaterThan(1.4);
    people.dispose();
  });

  it('makes figures only for people within 60 m in a room that stands, two a frame, nearest first', () => {
    const scene = new THREE.Scene();
    const people = createPeople(scene, kit, { tier: 'high' });
    const near = [5, 1, 4, 2, 3].map((x) => person(`ito-${x}`, 'ito', x, 0));
    const crew = crewOf(...near, person('far', 'ito', 70, 0), person('freed', 'ito', 1, 1, { room: 'gone' }));
    const rooms = { built: (id) => id !== 'gone', shown: () => true, dt: STEP };
    const made = () => shown(scene, 'person-ito').map((o) => o.position.x);
    people.sync(crew, 1, eye, rooms);
    expect(made().sort()).toEqual([1, 2]);
    people.sync(crew, 1, eye, rooms);
    expect(made()).toHaveLength(4);
    syncs(people, crew, 10, eye, rooms);
    expect(made().sort()).toEqual([1, 2, 3, 4, 5]);
    people.dispose();
  });

  it('poses someone with no turn at moving the first time they are drawn, not leaving them as they were made', () => {
    const scene = new THREE.Scene();
    const people = createPeople(scene, kit, { tier: 'low' });
    const crowd = Array.from({ length: 8 }, (_, i) => person(`ito-${i}`, 'ito', i + 1, 0));
    syncs(people, crewOf(...crowd, person('last', 'ito', 20, 0)));
    const last = shown(scene, 'person-ito').find((o) => o.position.x === 20);
    // the IT-O as made sits on the deck; posed, it hovers at a man’s eyes
    expect(box(last).min.y).toBeGreaterThan(1);
    people.dispose();
  });

  it('lays a body down at once when it falls with no turn at moving, not leaving it standing', () => {
    const scene = new THREE.Scene();
    const people = createPeople(scene, kit, { tier: 'low' });
    const crowd = [...Array.from({ length: 8 }, (_, i) => person(`ito-${i}`, 'ito', i + 1, 0)), person('chewie', 'chewie', 20, 0)];
    syncs(people, crewOf(...crowd));
    // all nine killed at once: eight falls take the eight turns, the farthest (Chewbacca) has none
    syncs(people, crewOf(...crowd.map((p) => ({ ...p, mode: 'dead', anim: 'die', hp: 0 }))), 1);
    expect(box(shown(scene, 'person-chewie')[0]).max.y).toBeLessThan(1);
    people.dispose();
  });

  it('gives a body still going down a turn at moving before anyone living nearer, so its fall plays out', () => {
    const scene = new THREE.Scene();
    const people = createPeople(scene, kit, { tier: 'low' });
    const crowd = Array.from({ length: 8 }, (_, i) => person(`ito-${i}`, 'ito', i + 1, 0));
    const victim = person('victim', 'ito', 30, 0);
    syncs(people, crewOf(...crowd, victim));
    syncs(people, crewOf(...crowd, { ...victim, mode: 'dead', anim: 'die', hp: 0 }), 5);
    // a fifth of a second into its fall: on its way down, neither hovering still nor already on the deck
    const b = box(shown(scene, 'person-ito').find((o) => o.position.x === 30));
    const middle = (b.min.y + b.max.y) / 2;
    expect(middle).toBeLessThan(1.3);
    expect(middle).toBeGreaterThan(0.5);
    people.dispose();
  });

  it('hides someone past 60 m and shows them again as you come near', () => {
    const scene = new THREE.Scene();
    const people = createPeople(scene, kit, { tier: 'low' });
    const crew = crewOf(person('chewie', 'chewie', 40, 0));
    syncs(people, crew, 1);
    const [chewie] = shown(scene, 'person-chewie');
    syncs(people, crew, 1, { x: -30, y: 1.6, z: 0 });
    expect(chewie.visible).toBe(false);
    syncs(people, crew, 1, { x: 30, y: 1.6, z: 0 });
    expect(chewie.visible).toBe(true);
    expect(shown(scene, 'person-chewie')).toEqual([chewie]);
    people.dispose();
  });

  it('keeps a body where it fell while its room stands out of sight, and shows the same body when the room is seen again', () => {
    const scene = new THREE.Scene();
    const people = createPeople(scene, kit, { tier: 'low' });
    const crew = crewOf(person('chewie', 'chewie', 4, 0, { mode: 'dead', anim: 'die', hp: 0 }));
    syncs(people, crew, 2, eye, { shown: () => true, built: () => true, dt: STEP });
    const [body] = shown(scene, 'person-chewie');
    syncs(people, crew, 2, eye, { shown: () => false, built: () => true, dt: STEP });
    expect(shown(scene, 'person-chewie')).toEqual([body]);
    expect(body.visible).toBe(false);
    syncs(people, crew, 2, eye, { shown: () => true, built: () => true, dt: STEP });
    expect(shown(scene, 'person-chewie')).toEqual([body]);
    expect(body.visible).toBe(true);
    people.dispose();
  });

  it('lets a body go once its room is freed, and doesn’t draw it again when the room is built anew', () => {
    const scene = new THREE.Scene();
    const people = createPeople(scene, kit, { tier: 'low' });
    const crew = crewOf(person('chewie', 'chewie', 4, 0, { mode: 'dead', anim: 'die', hp: 0 }));
    syncs(people, crew, 2, eye, { shown: () => true, built: () => true, dt: STEP });
    expect(shown(scene, 'person-chewie')).toHaveLength(1);
    syncs(people, crew, 1, eye, { shown: () => false, built: () => false, dt: STEP });
    expect(shown(scene, 'person-chewie')).toHaveLength(0);
    syncs(people, crew, 4, eye, { shown: () => true, built: () => true, dt: STEP });
    expect(shown(scene, 'person-chewie')).toHaveLength(0);
    people.dispose();
  });

  it('draws a body that fell where no room stood once its room is built, already lying where it fell', () => {
    const scene = new THREE.Scene();
    const people = createPeople(scene, kit, { tier: 'low' });
    const crew = crewOf(person('chewie', 'chewie', 4, 0, { mode: 'dead', anim: 'die', hp: 0 }));
    syncs(people, crew, 3, eye, { shown: () => false, built: () => false, dt: STEP });
    expect(shown(scene, 'person-chewie')).toHaveLength(0);
    syncs(people, crew, 1, eye, { shown: () => true, built: () => true, dt: STEP });
    const [body] = shown(scene, 'person-chewie');
    expect(body.visible).toBe(true);
    expect(box(body).max.y).toBeLessThan(1);
    people.dispose();
  });

  it('takes out of the scene anyone the crew no longer has', () => {
    const scene = new THREE.Scene();
    const people = createPeople(scene, kit, { tier: 'low' });
    syncs(people, crewOf(person('ito', 'ito', 1, 0)), 1);
    expect(shown(scene, 'person-ito')).toHaveLength(1);
    syncs(people, crewOf(), 1);
    expect(shown(scene, 'person-ito')).toHaveLength(0);
    people.dispose();
  });

  it('frees the dianoga’s skeleton with it', () => {
    const freed = vi.spyOn(THREE.Skeleton.prototype, 'dispose');
    const people = createPeople(new THREE.Scene(), kit, { tier: 'low' });
    syncs(people, crewOf(person('dianoga', 'dianoga', 3, 0)), 1);
    syncs(people, crewOf(), 1);
    expect(freed).toHaveBeenCalledTimes(1);
    people.dispose();
  });

  it('puts one helmet shape, made once, on every Death Star trooper, kept until the last of them goes', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const scene = new THREE.Scene();
    const people = createPeople(scene, kit, { tier: 'high' });
    const crew = crewOf(person('ds-1', 'dstrooper', 1, -4), person('ds-2', 'dstrooper', -1, -4));
    await vi.waitFor(() => {
      syncs(people, crew, 1);
      expect(shown(scene, 'helmet')).toHaveLength(2);
    });
    const [a, b] = shown(scene, 'helmet');
    expect(a.geometry).toBe(b.geometry);
    let freed = false;
    a.geometry.addEventListener('dispose', () => (freed = true));
    syncs(people, crewOf(person('ds-2', 'dstrooper', -1, -4)), 1);
    expect(shown(scene, 'helmet')).toHaveLength(1);
    expect(freed).toBe(false);
    people.dispose();
    expect(freed).toBe(true);
  });

  it('puts a trooper’s own E-11 in his hands, its muzzle where a shot leaves from, each handed to the house look as it goes in', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const scene = new THREE.Scene();
    const adopted = [];
    const people = createPeople(scene, kit, { tier: 'high', adopt: (o) => adopted.push(o.name) });
    const crew = crewOf(person('tk', 'stormtrooper', 0, -4, { mode: 'fight', anim: 'aim', aim: { x: 0, y: 1.4, z: -20 } }));
    await vi.waitFor(() => {
      syncs(people, crew, 1);
      expect(shown(scene, 'person-stormtrooper')).toHaveLength(1);
    });
    syncs(people, crew, 1);
    expect(shown(scene, 'blaster-e11')).toHaveLength(1);
    expect(adopted).toEqual(['person-stormtrooper', 'blaster-e11']);
    const muzzle = people.muzzle('tk', new THREE.Vector3());
    expect(muzzle.z).toBeLessThan(-4);
    expect(muzzle.y).toBeGreaterThan(0.6);
    people.dispose();
  });
});
