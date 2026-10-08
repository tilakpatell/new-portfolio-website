import * as THREE from 'three';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PACK } from '../pack';
import { BATTLE, VIEW_KINDS, angleOf, apparent, battlePlan, boltAt, createView, crossed, exteriorUrl, fighterPose, paintSize, skyPlan } from './views';

const len = (v) => Math.hypot(v[0], v[1], v[2]);
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const deg = (r) => (r * 180) / Math.PI;
// the angle between two directions, in degrees
const between = (a, b) => deg(Math.acos((a[0] * b[0] + a[1] * b[1] + a[2] * b[2]) / (len(a) * len(b))));
const bodyOf = (kind, id) => skyPlan(kind).bodies.find((b) => b.id === id);
const at = (p) => [p.x, p.y, p.z];
// every time in a loop, a tenth of a second apart
const times = (loop) => Array.from({ length: Math.round(loop * 10) }, (_, i) => i / 10);

describe('how big a thing looks', () => {
  it('measures a sphere’s width as an angle across', () => {
    expect(angleOf(1, 2)).toBeCloseTo(60);
    expect(angleOf(6250, 25000)).toBeCloseTo(28.96, 1);
  });

  it('draws a thing nearer and smaller so that it looks just as big', () => {
    expect(apparent(6250, 25000, 1000)).toBeCloseTo(250);
    expect(angleOf(apparent(6250, 25000, 1000), 1000)).toBeCloseTo(angleOf(6250, 25000));
  });
});

describe('the sky out of each window', () => {
  it('knows every kind of window', () => {
    expect(VIEW_KINDS).toEqual(['space', 'alderaan', 'yavin', 'endor', 'endor-battle', 'ds1-exterior', 'ds2-exterior']);
    for (const kind of VIEW_KINDS) expect(skyPlan(kind)).toBeTruthy();
  });

  it('shows Alderaan big in the overbridge window, a quarter to a half of the view across', () => {
    const a = bodyOf('alderaan', 'alderaan');
    expect(angleOf(a.radius, a.distance)).toBeGreaterThan(18);
    expect(angleOf(a.radius, a.distance)).toBeLessThan(35);
  });

  it('puts Yavin 4 beside its gas giant, clear of it and much smaller', () => {
    const giant = bodyOf('yavin', 'yavin');
    const moon = bodyOf('yavin', 'yavin-4');
    const apart = between(giant.position, moon.position);
    expect(apart).toBeGreaterThan((angleOf(giant.radius, giant.distance) + angleOf(moon.radius, moon.distance)) / 2);
    expect(angleOf(moon.radius, moon.distance)).toBeLessThan(angleOf(giant.radius, giant.distance) / 2);
  });

  it('shows Endor’s forest moon, which the second station keeps close to, bigger than the gas giant beyond it', () => {
    const giant = bodyOf('endor', 'endor');
    const moon = bodyOf('endor', 'forest-moon');
    expect(angleOf(moon.radius, moon.distance)).toBeGreaterThan(2 * angleOf(giant.radius, giant.distance));
    expect(bodyOf('endor-battle', 'forest-moon')).toBeTruthy();
    expect(bodyOf('ds2-exterior', 'forest-moon')).toBeTruthy();
  });

  it('draws every body at its true apparent size, whatever distance it is drawn at', () => {
    for (const kind of VIEW_KINDS) {
      for (const b of skyPlan(kind).bodies) {
        expect(angleOf(b.r, len(b.position))).toBeCloseTo(angleOf(b.radius, b.distance), 6);
      }
    }
  });

  it('draws a nearer body over a farther one', () => {
    expect(bodyOf('yavin', 'yavin-4').order).toBeGreaterThan(bodyOf('yavin', 'yavin').order);
    expect(bodyOf('endor', 'forest-moon').order).toBeGreaterThan(bodyOf('endor', 'endor').order);
  });

  it('lights every window by a sun from one direction', () => {
    for (const kind of VIEW_KINDS) expect(len(skyPlan(kind).sun)).toBeCloseTo(1);
  });

  it('shows each station whole and in front of the window, at its own true size', () => {
    const one = skyPlan('ds1-exterior').station;
    const two = skyPlan('ds2-exterior').station;
    expect(one.id).toBe('ds1');
    expect(two.id).toBe('ds2');
    for (const s of [one, two]) {
      expect(s.position[2]).toBeLessThan(0);
      expect(angleOf(s.r, len(s.position))).toBeCloseTo(angleOf(s.radius, s.distance), 6);
      expect(angleOf(s.radius, s.distance)).toBeGreaterThan(15);
      expect(angleOf(s.radius, s.distance)).toBeLessThan(45);
      // the far side still inside the camera’s reach (2000 m) from anywhere in a room
      expect(len(s.position) + s.r).toBeLessThan(1800);
    }
  });
});

describe('which model each station is drawn from', () => {
  it('takes the 4096-texel cut only on the strongest graphics', () => {
    expect(exteriorUrl('ds1', 'ultra')).toBe('/models/universe/death-star.hq.glb');
    expect(exteriorUrl('ds2', 'ultra')).toBe('/models/galaxy/deathstar2.hq.glb');
    for (const level of ['high', 'mid', 'low']) {
      expect(exteriorUrl('ds1', level)).toBe('/models/universe/death-star.glb');
      expect(exteriorUrl('ds2', level)).toBe('/models/galaxy/deathstar2.glb');
    }
  });
});

describe('the size a planet is painted at', () => {
  it('paints twice as wide as tall, finer on stronger devices', () => {
    const sizes = ['low', 'mid', 'high', 'ultra'].map(paintSize);
    for (const s of sizes) expect(s.w).toBe(s.h * 2);
    for (let i = 1; i < sizes.length; i++) expect(sizes[i].w).toBeGreaterThanOrEqual(sizes[i - 1].w);
    expect(sizes[0].w).toBeLessThan(sizes[2].w);
  });

  it('never paints wider than 1024 texels, which already takes most of a second', () => {
    expect(paintSize('ultra').w).toBeLessThanOrEqual(1024);
  });
});

describe('the battle out of the throne room’s window', () => {
  const plan = battlePlan('high');

  it('flies a fleet of each side and a dogfight of X-wings and TIEs', () => {
    const models = new Set(plan.capitals.map((c) => c.model));
    expect(models).toEqual(new Set(['moncal', 'destroyer', 'executor']));
    expect(plan.fighters.some((f) => f.model === 'xwing')).toBe(true);
    expect(plan.fighters.some((f) => f.model === 'tie')).toBe(true);
  });

  it('flies fewer fighters on a phone than on a desktop', () => {
    expect(battlePlan('mid').fighters.length).toBeLessThan(plan.fighters.length);
    expect(battlePlan('low').fighters.length).toBeLessThanOrEqual(battlePlan('mid').fighters.length);
  });

  it('is the same battle every time it is drawn', () => {
    expect(battlePlan('high')).toEqual(plan);
  });

  it('shows the Executor as the biggest ship in the fleet, and every one smaller in the window than the forest moon', () => {
    const angle = (c) => deg(2 * Math.atan(c.length / 2 / len(c.position)));
    const executor = plan.capitals.find((c) => c.model === 'executor');
    for (const c of plan.capitals) if (c !== executor) expect(angle(c)).toBeLessThan(angle(executor));
    const moon = bodyOf('endor-battle', 'forest-moon');
    expect(angle(executor)).toBeLessThan(angleOf(moon.radius, moon.distance));
  });

  it('keeps every capital ship out beyond the window and inside the camera’s reach', () => {
    for (const c of plan.capitals) {
      expect(c.position[2]).toBeLessThan(-300);
      expect(len(c.position) + c.length).toBeLessThan(1800);
    }
  });

  it('flies every fighter at a fighter’s pace', () => {
    for (const f of plan.fighters) {
      for (const t of times(plan.loop)) {
        const a = fighterPose(f, t);
        const b = fighterPose(f, t + 0.01);
        const speed = len(sub(at(b), at(a))) / 0.01;
        expect(speed).toBeGreaterThan(25);
        expect(speed).toBeLessThan(220);
      }
    }
  });

  it('keeps the dogfight out beyond the window', () => {
    for (const f of plan.fighters) {
      for (const t of times(plan.loop)) {
        const p = at(fighterPose(f, t));
        expect(len(p)).toBeGreaterThan(80);
        expect(len(p)).toBeLessThan(600);
        expect(p[2]).toBeLessThan(-50);
      }
    }
  });

  it('keeps a chaser on its quarry’s tail', () => {
    const chasers = plan.fighters.filter((f) => f.chases >= 0);
    expect(chasers.length).toBeGreaterThan(2);
    for (const f of chasers) {
      const quarry = plan.fighters[f.chases];
      expect(quarry.model).not.toBe(f.model);
      for (const t of times(plan.loop)) {
        const gap = len(sub(at(fighterPose(f, t)), at(fighterPose(quarry, t))));
        expect(gap).toBeGreaterThan(15);
        expect(gap).toBeLessThan(250);
      }
    }
  });

  it('turns a fighter’s nose the way it is flying', () => {
    const f = plan.fighters[0];
    const a = fighterPose(f, 3);
    const b = fighterPose(f, 3.01);
    expect(between([a.dx, a.dy, a.dz], sub(at(b), at(a)))).toBeLessThan(2);
  });

  it('comes round again each loop, every fighter where it was a loop before', () => {
    for (const f of plan.fighters) {
      for (const t of [0.5, 7.3, 21.1]) {
        const a = fighterPose(f, t);
        const b = fighterPose(f, t + plan.loop);
        expect(len(sub(at(a), at(b)))).toBeLessThan(1e-6);
        expect(b.show).toBeCloseTo(a.show);
      }
    }
  });

  it('takes a fighter that is shot down away, then brings another round in its place', () => {
    const lost = plan.fighters.filter((f) => f.down != null);
    expect(lost.length).toBeGreaterThan(0);
    for (const f of lost) {
      expect(fighterPose(f, f.down - 0.1).show).toBe(1);
      expect(fighterPose(f, f.down + 0.1).show).toBe(0);
      expect(fighterPose(f, f.down + BATTLE.gone + BATTLE.grow + 0.1).show).toBe(1);
    }
  });

  it('blows a fighter up where it is shot down', () => {
    for (const f of plan.fighters.filter((x) => x.down != null)) {
      const blast = plan.blasts.find((b) => b.fighter === plan.fighters.indexOf(f));
      expect(blast.at).toBeCloseTo(f.down);
    }
  });

  it('fires on a fighter just before it is shot down', () => {
    plan.fighters.forEach((f, i) => {
      if (f.down == null) return;
      const last = plan.shots.filter((s) => s.kind === 'fighter' && s.target === i && f.down - s.at > 0 && f.down - s.at < 0.5);
      expect(last.length).toBeGreaterThan(0);
    });
  });

  it('never fires at a fighter that isn’t there', () => {
    for (const s of plan.shots.filter((x) => x.target != null && x.kind === 'fighter')) {
      const quarry = plan.fighters[s.target];
      expect(fighterPose(quarry, s.at).show).toBe(1);
      expect(fighterPose(plan.fighters[s.from], s.at).show).toBe(1);
    }
  });

  it('fires the capital ships’ turbolasers across at the other side', () => {
    const big = plan.shots.filter((s) => s.kind === 'capital');
    expect(big.length).toBeGreaterThan(5);
    for (const s of big) expect(plan.capitals[s.from].side).not.toBe(plan.capitals[s.target].side);
  });
});

describe('a bolt in flight', () => {
  const plan = battlePlan('high');
  const shot = plan.shots.find((s) => s.kind === 'capital');

  it('is not there before it is fired, nor once it has struck', () => {
    expect(boltAt(plan, shot, shot.at - 0.05)).toBeNull();
    const b = boltAt(plan, shot, shot.at + 0.01);
    expect(b).not.toBeNull();
    expect(boltAt(plan, shot, shot.at + b.life + 0.05)).toBeNull();
  });

  it('flies from the gun that fired it to the ship it was fired at', () => {
    const early = boltAt(plan, shot, shot.at + 0.01);
    const late = boltAt(plan, shot, shot.at + early.life - 0.01);
    const target = plan.capitals[shot.target].position;
    expect(len(sub(at(late), target))).toBeLessThan(len(sub(at(early), target)));
    expect(len(sub(at(late), target))).toBeLessThan(plan.capitals[shot.target].length);
  });

  it('flies the same way round each loop', () => {
    const a = boltAt(plan, shot, shot.at + 0.2);
    const b = boltAt(plan, shot, shot.at + 0.2 + plan.loop);
    expect(len(sub(at(a), at(b)))).toBeLessThan(1e-6);
  });

  it('is red from the Rebels and green from the Empire', () => {
    for (const s of plan.shots) {
      const side = s.kind === 'capital' ? plan.capitals[s.from].side : plan.fighters[s.from].side;
      const b = boltAt(plan, s, s.at + 0.02);
      expect(b.hue).toBe(side === 'rebel' ? 'red' : 'green');
    }
  });
});

describe('what happens between two frames', () => {
  it('catches a moment that falls between them', () => {
    expect(crossed(5, 4.9, 5.1, 40)).toBe(true);
    expect(crossed(5, 5.1, 5.2, 40)).toBe(false);
    expect(crossed(5, 4.8, 4.9, 40)).toBe(false);
  });

  it('catches it again each loop, and across the loop’s seam', () => {
    expect(crossed(5, 44.9, 45.1, 40)).toBe(true);
    expect(crossed(0.05, 39.95, 40.1, 40)).toBe(true);
    expect(crossed(39.98, 39.95, 40.1, 40)).toBe(true);
  });

  it('catches each moment once a loop, however the frames fall', () => {
    let seen = 0;
    let t = 0;
    for (let i = 0; i < 1000; i++) {
      const dt = 0.011 + (i % 7) * 0.013;
      if (crossed(12.34, t, t + dt, 40)) seen++;
      t += dt;
    }
    expect(seen).toBe(Math.floor((t - 12.34) / 40) + 1);
  });
});

// ── the views as drawn ──

// what the renderer would draw: one call a visible mesh, points or line (an
// instanced mesh with nothing in it draws nothing)
function draws(object) {
  let n = 0;
  object.traverseVisible((o) => {
    if (!(o.isMesh || o.isPoints || o.isLine || o.isSprite)) return;
    if (o.isInstancedMesh && o.count === 0) return;
    n += 1;
  });
  return n;
}

// everything a view made that has to be freed, and whether it was
function freed(object) {
  const things = new Set();
  object.traverse((o) => {
    if (o.geometry) things.add(o.geometry);
    for (const m of [o.material].flat()) {
      if (!m) continue;
      things.add(m);
      for (const v of Object.values(m.uniforms ?? {})) if (v?.value?.isTexture) things.add(v.value);
      for (const k of ['map', 'normalMap', 'roughnessMap']) if (m[k]) things.add(m[k]);
    }
  });
  const gone = new Set();
  for (const t of things) t.addEventListener('dispose', () => gone.add(t));
  return { things, gone };
}

// a canvas that paints into nothing, so planets can be painted in Node
const fakeCanvas = () => ({ width: 0, height: 0, getContext: () => ({ createImageData: (w, h) => ({ width: w, height: h, data: new Uint8ClampedArray(w * h * 4) }), putImageData() {} }) });

// a stand-in for planetPaint.js: blank maps, painted at once
const fakePaint = { planet: () => ({ color: fakeCanvas(), normal: fakeCanvas(), rough: fakeCanvas(), clouds: fakeCanvas() }), giant: () => fakeCanvas() };

// a stand-in for loadGltf: a little coloured box for every model asked for
function fakeLoad() {
  const asked = [];
  const load = (url) => {
    asked.push(url);
    const geo = new THREE.BoxGeometry(1, 0.5, 2);
    geo.setAttribute('color', new THREE.Float32BufferAttribute(new Array(geo.attributes.position.count * 3).fill(0.6), 3));
    const scene = new THREE.Group();
    scene.add(new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true })));
    return Promise.resolve({ scene, animations: [], gltf: {} });
  };
  return { load, asked };
}

describe('a window onto space', () => {
  it('draws its stars, their band and the sun in a few draws, and frees them all when it goes', () => {
    const view = createView('space', { tier: 'mid' });
    const room = new THREE.Group();
    room.add(view.object);
    view.update(1, 1 / 60);
    expect(draws(view.object)).toBeGreaterThan(0);
    expect(draws(view.object)).toBeLessThanOrEqual(4);
    const { things, gone } = freed(view.object);
    view.dispose();
    expect(gone.size).toBe(things.size);
    expect(view.object.parent).toBeNull();
  });

  it('keeps its sky round wherever the window is when drawn, even with no update between', () => {
    const view = createView('space', { tier: 'low' });
    const room = new THREE.Group();
    room.position.set(120, 8, -40);
    room.add(view.object);
    const stars = view.object.getObjectByName('stars');
    // (as the renderer does, just before it draws them)
    stars.onBeforeRender();
    expect(stars.material.uniforms.uOrigin.value.toArray()).toEqual([120, 8, -40]);
    view.dispose();
  });

  it('keeps its sky out of the room’s look and off the room’s depth, drawn after the room', () => {
    const view = createView('space', { tier: 'low' });
    view.object.traverse((o) => {
      if (!o.material) return;
      expect(o.renderOrder).toBeGreaterThan(0);
      expect(o.material.depthWrite).toBe(false);
    });
    view.dispose();
  });
});

describe('a window onto a planet', () => {
  beforeEach(() => vi.stubGlobal('document', { createElement: fakeCanvas }));
  afterEach(() => vi.unstubAllGlobals());

  for (const kind of ['alderaan', 'yavin', 'endor']) {
    it(`draws ${kind} under thirty draws and frees its painted maps when it goes`, () => {
      const view = createView(kind, { tier: 'low' });
      view.update(2, 1 / 60);
      expect(draws(view.object)).toBeLessThanOrEqual(30);
      const { things, gone } = freed(view.object);
      expect([...things].some((t) => t.isTexture)).toBe(true);
      view.dispose();
      expect(gone.size).toBe(things.size);
    });
  }

  it('turns its sun with the window, so the light comes from the same side of the planet however the room faces', () => {
    const view = createView('alderaan', { tier: 'low' });
    const planet = view.object.getObjectByName('alderaan');
    const before = planet.material.uniforms.uSun.value.clone();
    view.object.rotation.y = Math.PI / 2;
    view.object.updateMatrixWorld(true);
    view.update(2, 1 / 60);
    const after = planet.material.uniforms.uSun.value;
    expect(after.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), -Math.PI / 2).distanceTo(before)).toBeLessThan(1e-6);
    view.dispose();
  });
});

describe('the battle as it is drawn', () => {
  it('loads every kind of ship once, each as one instanced draw', async () => {
    const { load, asked } = fakeLoad();
    const view = createView('endor-battle', { tier: 'low', load, paint: fakePaint });
    await view.ready;
    expect(asked.length).toBe(5);
    expect(new Set(asked).size).toBe(5);
    let instanced = 0;
    view.object.traverse((o) => o.isInstancedMesh && o.name.startsWith('fleet') && instanced++);
    expect(instanced).toBe(5);
    view.dispose();
  });

  it('never takes more than thirty draws, all the way round its loop', async () => {
    for (const tier of ['low', 'mid', 'ultra']) {
      const { load } = fakeLoad();
      const view = createView('endor-battle', { tier, load, paint: fakePaint });
      await view.ready;
      let most = 0;
      for (let t = 0; t < BATTLE.loop; t += 1 / 15) {
        view.update(t, 1 / 15);
        most = Math.max(most, draws(view.object));
      }
      expect(most).toBeLessThanOrEqual(30);
      view.dispose();
    }
  });

  it('flies the fighters about between frames', async () => {
    const { load } = fakeLoad();
    const view = createView('endor-battle', { tier: 'low', load, paint: fakePaint });
    await view.ready;
    const fighters = view.object.getObjectByName('fleet:xwing');
    const m = new THREE.Matrix4();
    view.update(1, 1 / 30);
    fighters.getMatrixAt(0, m);
    const a = new THREE.Vector3().setFromMatrixPosition(m);
    view.update(1.5, 0.5);
    fighters.getMatrixAt(0, m);
    expect(new THREE.Vector3().setFromMatrixPosition(m).distanceTo(a)).toBeGreaterThan(5);
    view.dispose();
  });

  it('draws on without the ships when they cannot be had', async () => {
    const view = createView('endor-battle', { tier: 'low', load: () => Promise.resolve(null), paint: fakePaint });
    await view.ready;
    expect(() => view.update(3, 1 / 30)).not.toThrow();
    expect(draws(view.object)).toBeGreaterThan(0);
    view.dispose();
  });

  it('adds nothing once it has been put away, however late the ships come', async () => {
    let arrive;
    const late = new Promise((resolve) => (arrive = resolve));
    const { load } = fakeLoad();
    const view = createView('endor-battle', { tier: 'low', load: (url) => late.then(() => load(url)), paint: fakePaint });
    view.dispose();
    arrive();
    await view.ready;
    let ships = 0;
    view.object.traverse((o) => o.name.startsWith('fleet') && ships++);
    expect(ships).toBe(0);
  });
});

describe('the station from outside', () => {
  it('asks for the 4096-texel station only on the strongest graphics', async () => {
    for (const [kind, tier, url] of [
      ['ds1-exterior', 'ultra', '/models/universe/death-star.hq.glb'],
      ['ds1-exterior', 'mid', '/models/universe/death-star.glb'],
      ['ds2-exterior', 'ultra', '/models/galaxy/deathstar2.hq.glb'],
      ['ds2-exterior', 'low', '/models/galaxy/deathstar2.glb'],
    ]) {
      const { load, asked } = fakeLoad();
      const view = createView(kind, { tier, load, paint: fakePaint });
      await view.ready;
      expect(asked).toEqual([url]);
      expect(draws(view.object)).toBeLessThanOrEqual(30);
      view.dispose();
    }
  });

  it('lights the station by the view’s own sun, kept out of the room’s look', async () => {
    const { load } = fakeLoad();
    const view = createView('ds1-exterior', { tier: 'mid', load, paint: fakePaint });
    await view.ready;
    const hull = view.object.getObjectByName('station');
    let lit = 0;
    hull.traverse((o) => {
      if (!o.isMesh) return;
      expect(o.material.userData.noHouse).toBe(true);
      expect(o.material.customProgramCacheKey()).toContain('view-sun');
      lit++;
    });
    expect(lit).toBeGreaterThan(0);
    view.dispose();
  });
});

describe('what the install fetches', () => {
  it('lists every model a view can load', () => {
    const urls = new Set();
    for (const kind of VIEW_KINDS) {
      for (const tier of ['low', 'ultra']) {
        const { load, asked } = fakeLoad();
        createView(kind, { tier, load, paint: fakePaint }).dispose();
        for (const u of asked) urls.add(u);
      }
    }
    expect(urls.size).toBeGreaterThan(5);
    for (const u of urls) expect(PACK.urls).toContain(u);
  });
});
