import * as THREE from 'three';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CLIPS } from '../../../../lib/three/clipLibrary';
import { actOf, aimAngles, createPeople, createTrack, fallClip, hitClip, motionFrom } from './people';

const STEP = 1 / 30;
const person = (id, kind, x, z, more = {}) => ({ id, kind, x, y: 0, z, yaw: 0, room: 'corr327', hp: 60, mode: 'routine', anim: 'idle', aim: null, ...more });
const kit = { mat: () => new THREE.MeshStandardMaterial() };

describe('what a person is seen doing', () => {
  const tk = (more) => person('a', 'stormtrooper', 0, 0, more);
  it('walks on its gait with its gun carried low while about its work', () => {
    expect(actOf(tk({ anim: 'walk' }))).toEqual({ base: null, full: null, upper: null, raised: false, dead: false });
  });

  it('holds its gun out at the aim in a fight, walking or not, and fires it over and over while shooting', () => {
    expect(actOf(tk({ mode: 'fight', anim: 'run' }))).toMatchObject({ base: null, upper: 'aim.pistol', raised: true });
    expect(actOf(tk({ mode: 'fight', anim: 'aim' }))).toMatchObject({ upper: 'aim.pistol', raised: true });
    expect(actOf(tk({ mode: 'fight', anim: 'shoot' }))).toMatchObject({ upper: 'shoot.pistol', raised: true });
    // (nothing in the hands: nothing held out)
    expect(actOf(tk({ mode: 'fight', anim: 'aim' }), { armed: false }).upper).toBeNull();
  });

  it('cuts a duellist’s strokes in turn, light and heavy, holds its guard and reaches out with the Force', () => {
    const vader = (more) => person('v', 'vader', 0, 0, more);
    expect(actOf(vader({ anim: 'strike', strokes: 1 })).full).toBe('sword.light.b');
    expect(actOf(vader({ anim: 'strike', strokes: 2 })).full).toBe('sword.light.c');
    expect(actOf(vader({ anim: 'heavy', strokes: 3 })).full).toBe('sword.heavy.a');
    expect(actOf(vader({ anim: 'guard' })).base).toBe('stance');
    expect(actOf(vader({ anim: 'cast' })).full).toBe('cast');
    expect(actOf(person('e', 'emperor', 0, 0, { anim: 'lightning' })).base).toBe('cast.double');
  });

  it('sits on the floor, lies there, and limps along held up, as the rules pose it', () => {
    expect(actOf(tk({ anim: 'ground' })).base).toBe('sit.ground');
    expect(actOf(tk({ anim: 'lie' })).base).toBe('lie');
    expect(actOf(tk({ anim: 'limp' })).base).toBe('walk.injured');
  });

  it('stands at attention at a post, works a console, talks with its hands, sits in a seat', () => {
    expect(actOf(tk({ anim: 'attention' })).base).toBe('idle.calm');
    expect(actOf(tk({ anim: 'work' })).base).toBe('counter.idle');
    expect(actOf(tk({ anim: 'talk' })).base).toBe('talk');
    expect(actOf(tk({ anim: 'sit' })).base).toBe('sit.idle');
    // (on the move, the walk takes over from any pose)
    expect(actOf(tk({ anim: 'walk' })).base).toBeNull();
  });

  it('takes a sabre fighter’s stance in a fight, and holds out no gun', () => {
    expect(actOf(person('v', 'vader', 0, 0, { mode: 'fight', anim: 'idle' }), { blade: true, armed: false })).toMatchObject({ base: 'stance', upper: null });
  });

  it('flinches once when hit, and is thrown down and kneels when knocked over', () => {
    expect(actOf(tk({ anim: 'hit' })).full).toBe('hit');
    expect(actOf(tk({ mode: 'down', anim: 'hit' }))).toMatchObject({ full: 'hit.knock', base: 'kneel' });
    expect(actOf(tk({ mode: 'down', anim: 'kneel' }))).toMatchObject({ full: null, base: 'kneel' });
  });

  it('is dead, and nothing else, once dead', () => {
    expect(actOf(tk({ mode: 'dead', anim: 'die' }))).toEqual({ base: null, full: null, upper: null, raised: false, dead: true });
  });

  it('plays only clips the library has', () => {
    const named = new Set();
    for (const anim of ['walk', 'idle', 'attention', 'work', 'talk', 'sit', 'kneel', 'hit', 'shoot', 'aim'])
      for (const mode of ['routine', 'fight', 'down']) {
        const a = actOf(tk({ mode, anim }));
        for (const n of [a.base, a.full === 'hit' ? null : a.full, a.upper]) if (n) named.add(n);
      }
    named.add('stance');
    for (const n of named) expect(CLIPS[n], n).toBeDefined();
  });
});

describe('how a hit is taken', () => {
  // facing yaw 0 is facing −z
  it('reels from the chest (or the head, hit high) when hit from in front, a shoulder from the side, doubled up from behind', () => {
    expect(hitClip({ x: 0, y: 0, z: 1 }, 0)).toBe('hit.chest');
    expect(hitClip({ x: 0, y: 0, z: 1 }, 0, true)).toBe('hit.head');
    expect(hitClip({ x: 0, y: 0, z: -1 }, 0)).toBe('hit.stomach');
    // a bolt going to their right came in on their left
    expect(hitClip({ x: 1, y: 0, z: 0 }, 0)).toBe('hit.shoulder.l');
    expect(hitClip({ x: -1, y: 0, z: 0 }, 0)).toBe('hit.shoulder.r');
    expect(hitClip(null, 0)).toBe('hit.trooper');
    for (const n of ['hit.chest', 'hit.head', 'hit.stomach', 'hit.shoulder.l', 'hit.shoulder.r', 'hit.trooper']) expect(CLIPS[n], n).toBeDefined();
  });

  it('falls back from a shot in front and forward from one behind, and the same way every time with no shot known', () => {
    expect(fallClip({ x: 0, y: 0, z: 1 }, 0)).toBe('die.back');
    expect(fallClip({ x: 0, y: 0, z: -1 }, 0)).toBe('die.fwd');
    expect(fallClip(null, 0, 'tk-7')).toBe(fallClip(null, 0, 'tk-7'));
    expect(new Set(Array.from({ length: 20 }, (_, i) => fallClip(null, 0, `tk-${i}`))).size).toBe(2);
  });
});

describe('how a person moves under its clips', () => {
  it('goes ahead, aside and round as the track has it, from where it faces', () => {
    const t = createTrack();
    t.push({ x: 0, y: 0, z: 0, yaw: 0 }, STEP);
    t.push({ x: 0, y: 0, z: -0.05, yaw: 0 }, STEP);
    // 0.05 m a step towards −z, which it faces: 1.5 m/s ahead
    expect(motionFrom(t, 0).speed).toBeCloseTo(1.5);
    expect(motionFrom(t, 0).side).toBeCloseTo(0);
    // facing +x, the same way is to its left
    expect(motionFrom(t, Math.PI / 2).side).toBeCloseTo(-1.5);
    t.push({ x: 0, y: 0, z: -0.1, yaw: 0.1 }, STEP);
    // turning towards +x is turning right: a negative turn to locomotion
    expect(motionFrom(t, 0.1).turn).toBeLessThan(0);
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

  it('builds the IT-O and the dianoga in code, each standing where the crew has it, facing its way', () => {
    const scene = new THREE.Scene();
    const people = createPeople(scene, kit, { tier: 'high' });
    syncs(people, crewOf(person('ito', 'ito', 2, -3, { yaw: Math.PI / 2 }), person('dianoga', 'dianoga', 5, 5)));
    const [ito] = shown(scene, 'person-ito');
    expect(ito.position.toArray()).toEqual([2, 0, -3]);
    expect(ito.rotation.y).toBeCloseTo(-Math.PI / 2);
    expect(shown(scene, 'person-dianoga')).toHaveLength(1);
    people.dispose();
  });

  it('loads Chewbacca from his model as it loads the crew, not building him in code, and stands him his full height where the crew has him', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const scene = new THREE.Scene();
    const people = createPeople(scene, kit, { tier: 'high' });
    const crew = crewOf(person('chewie', 'chewie', 2, -3, { yaw: Math.PI / 2 }));
    syncs(people, crew, 1);
    // a figure built in code is in the scene on its first frame; a model only once it has loaded
    expect(shown(scene, 'person-chewie')).toHaveLength(0);
    await vi.waitFor(() => {
      syncs(people, crew, 1);
      expect(shown(scene, 'person-chewie')).toHaveLength(1);
    });
    const [chewie] = shown(scene, 'person-chewie');
    expect(chewie.position.toArray()).toEqual([2, 0, -3]);
    expect(chewie.rotation.y).toBeCloseTo(-Math.PI / 2);
    expect(box(chewie).max.y).toBeCloseTo(2.28, 1);
    expect(box(chewie).min.y).toBeCloseTo(0, 1);
    people.dispose();
  });

  it('makes the IT-O a small sphere at a man’s eye height, and the dianoga’s eye up out of the water', () => {
    const scene = new THREE.Scene();
    const people = createPeople(scene, kit, { tier: 'high' });
    syncs(people, crewOf(person('ito', 'ito', 10, 0), person('dianoga', 'dianoga', 20, 0)));
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
    const crowd = Array.from({ length: 9 }, (_, i) => person(`ito-${i}`, 'ito', i < 8 ? i + 1 : 20, 0));
    syncs(people, crewOf(...crowd));
    // all nine killed at once: eight falls take the eight turns, the farthest has none
    syncs(people, crewOf(...crowd.map((p) => ({ ...p, mode: 'dead', anim: 'die', hp: 0 }))), 1);
    expect(box(shown(scene, 'person-ito').find((o) => o.position.x === 20)).max.y).toBeLessThan(1);
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
    const crew = crewOf(person('ito', 'ito', 40, 0));
    syncs(people, crew, 1);
    const [ito] = shown(scene, 'person-ito');
    syncs(people, crew, 1, { x: -30, y: 1.6, z: 0 });
    expect(ito.visible).toBe(false);
    syncs(people, crew, 1, { x: 30, y: 1.6, z: 0 });
    expect(ito.visible).toBe(true);
    expect(shown(scene, 'person-ito')).toEqual([ito]);
    people.dispose();
  });

  it('keeps a body where it fell while its room stands out of sight, and shows the same body when the room is seen again', () => {
    const scene = new THREE.Scene();
    const people = createPeople(scene, kit, { tier: 'low' });
    const crew = crewOf(person('ito', 'ito', 4, 0, { mode: 'dead', anim: 'die', hp: 0 }));
    syncs(people, crew, 2, eye, { shown: () => true, built: () => true, dt: STEP });
    const [body] = shown(scene, 'person-ito');
    syncs(people, crew, 2, eye, { shown: () => false, built: () => true, dt: STEP });
    expect(shown(scene, 'person-ito')).toEqual([body]);
    expect(body.visible).toBe(false);
    syncs(people, crew, 2, eye, { shown: () => true, built: () => true, dt: STEP });
    expect(shown(scene, 'person-ito')).toEqual([body]);
    expect(body.visible).toBe(true);
    people.dispose();
  });

  it('lays down a body whose fall ran its course out of sight, however it was going when the room went out of view', () => {
    const scene = new THREE.Scene();
    const people = createPeople(scene, kit, { tier: 'low' });
    const inView = { shown: () => true, built: () => true, dt: STEP };
    const outOfView = { shown: () => false, built: () => true, dt: STEP };
    const alive = [person('seen', 'ito', 4, 0), person('unseen', 'ito', -4, 0)];
    const dead = alive.map((p) => ({ ...p, mode: 'dead', anim: 'die', hp: 0 }));
    syncs(people, crewOf(...alive), 3, eye, inView);
    // one downed in view and a third of a second into its fall when a door shuts on it, the other downed behind it
    syncs(people, crewOf(dead[0], alive[1]), 9, eye, inView);
    syncs(people, crewOf(...dead), 90, eye, outOfView);
    syncs(people, crewOf(...dead), 1, eye, inView);
    const bodies = shown(scene, 'person-ito');
    expect(bodies).toHaveLength(2);
    for (const body of bodies) expect(box(body).max.y).toBeLessThan(1);
    syncs(people, crewOf(...dead), 30, eye, inView);
    for (const body of bodies) expect(box(body).max.y).toBeLessThan(1);
    people.dispose();
  });

  it('lets a body go once its room is freed, and doesn’t draw it again when the room is built anew', () => {
    const scene = new THREE.Scene();
    const people = createPeople(scene, kit, { tier: 'low' });
    const crew = crewOf(person('ito', 'ito', 4, 0, { mode: 'dead', anim: 'die', hp: 0 }));
    syncs(people, crew, 2, eye, { shown: () => true, built: () => true, dt: STEP });
    expect(shown(scene, 'person-ito')).toHaveLength(1);
    syncs(people, crew, 1, eye, { shown: () => false, built: () => false, dt: STEP });
    expect(shown(scene, 'person-ito')).toHaveLength(0);
    syncs(people, crew, 4, eye, { shown: () => true, built: () => true, dt: STEP });
    expect(shown(scene, 'person-ito')).toHaveLength(0);
    people.dispose();
  });

  it('draws a body that fell where no room stood once its room is built, already lying where it fell', () => {
    const scene = new THREE.Scene();
    const people = createPeople(scene, kit, { tier: 'low' });
    const crew = crewOf(person('ito', 'ito', 4, 0, { mode: 'dead', anim: 'die', hp: 0 }));
    syncs(people, crew, 3, eye, { shown: () => false, built: () => false, dt: STEP });
    expect(shown(scene, 'person-ito')).toHaveLength(0);
    syncs(people, crew, 1, eye, { shown: () => true, built: () => true, dt: STEP });
    const [body] = shown(scene, 'person-ito');
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
