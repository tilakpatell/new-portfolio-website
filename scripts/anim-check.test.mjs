import { afterEach, describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { meshyRig, MESHY_BONES } from '../src/lib/three/meshyRig.fixture.js';
import { analyse, atBindPose, BIND_EPS, browserPath, emptyFails, figureName, heldPageScript, heldTalkLines, heldVerdict, inView, keyOf, LIMIT, lockstep, mul4, pageScript, parseArgs, phaseSpread, promptFor, routeOf, sampleHeld, skinDeviation, report, swingOf, TALK_WITHIN, talkCheck, talkVerdict, toeDrift, toesOf, worldTimes } from './anim-check.mjs';

// a toe's track, `fps` samples a second for `seconds`: at(t) → [x, y, z] or null (hidden)
const track = (seconds, fps, at) => {
  const out = [];
  for (let i = 0; i <= seconds * fps; i++) out.push({ t: i / fps, p: at(i / fps) });
  return out;
};
// a step a second: down (still, or sliding `slide` m/s back) for the first
// 0.6 s of it, then lifted 10 cm, carried to 0.8 m on from where it came
// down, and set down there
const stepping = (slide = 0) => (t) => {
  const k = Math.floor(t);
  const f = t - k;
  if (f < 0.6) return [0.8 * k - slide * f, 0, 0];
  const s = (f - 0.6) / 0.4;
  const from = 0.8 * k - slide * 0.6;
  const to = 0.8 * (k + 1);
  if (s < 0.1) return [from, s, 0];
  if (s > 0.9) return [to, 1 - s, 0];
  return [from + ((to - from) * (s - 0.1)) / 0.8, 0.1, 0];
};

describe('a planted toe’s drift', () => {
  it('reads nothing for a foot that steps and stays put while it’s down', () => {
    const d = toeDrift(track(4, 30, stepping()));
    expect(d.drift).toBeLessThan(0.01);
    expect(d.stances).toBeGreaterThanOrEqual(4);
  });

  it('reads a foot that slides while it’s down at the speed it slides', () => {
    // (a little under: the toe's also down a moment as it lifts and lands)
    expect(toeDrift(track(4, 30, stepping(0.3))).drift).toBeCloseTo(0.3, 1);
  });

  it('reads a figure gliding on still feet at the speed it glides', () => {
    expect(toeDrift(track(3, 30, (t) => [0.5 * t, 0, 0])).drift).toBeCloseTo(0.5, 5);
  });

  it('measures the same at a software renderer’s few frames a second', () => {
    expect(toeDrift(track(6, 5, (t) => [0, 0, -0.4 * t])).drift).toBeCloseTo(0.4, 5);
  });

  it('doesn’t count a figure moved while it was hidden, or put somewhere else', () => {
    const hidden = track(3, 30, (t) => (t > 1 && t < 1.5 ? null : t <= 1 ? [0, 0, 0] : [1, 0, 0]));
    expect(toeDrift(hidden).drift).toBeLessThan(1e-9);
    const moved = track(2, 30, (t) => (t < 1 ? [0, 0, 0] : [5, 0, 0]));
    expect(toeDrift(moved).drift).toBeLessThan(1e-9);
  });

  it('says nothing of a toe that was barely down', () => {
    expect(toeDrift(track(0.1, 30, (t) => [t, 0, 0])).drift).toBeNull();
    expect(toeDrift([]).drift).toBeNull();
  });

  it('takes the world’s up from the caller (a z-up world steps the same)', () => {
    const zUp = track(4, 30, (t) => {
      const [x, y] = stepping()(t);
      return [x, 0, y];
    });
    expect(toeDrift(zUp, { up: [0, 0, 1] }).drift).toBeLessThan(0.01);
    // (only the ground's plane counts: a foot going up a step isn't a slide)
    expect(toeDrift(track(2, 30, (t) => [0, 0, 0.01 * t]), { up: [0, 0, 1] }).drift).toBeLessThan(1e-9);
  });
});

describe('the world’s time', () => {
  it('shares the mixers’ time out over the frames by how long each took', () => {
    const { dt, from, total } = worldTimes([0, 0.5, 0.5, 1], [0.2, 0.2, 0.4, 0]);
    expect(from).toBe('mixers');
    expect(total).toBeCloseTo(0.2);
    expect(dt.map((x) => +x.toFixed(4))).toEqual([0, 0.05, 0.05, 0.1]);
  });

  it('falls back to the wall clock, a frame counting a tenth of a second at most', () => {
    expect(worldTimes([0, 0.5, 0.05], [])).toMatchObject({ dt: [0, 0.1, 0.05], from: 'wall' });
    expect(worldTimes([0, 0.05], [3], { clock: 'wall' }).from).toBe('wall');
  });
});

// a skinned figure on Meshy's skeleton, bound where it stands
function skinned(name = '') {
  const rig = meshyRig();
  const geo = new THREE.BoxGeometry(0.3, 1.8, 0.2);
  const n = geo.attributes.position.count;
  geo.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(new Array(n * 4).fill(0), 4));
  geo.setAttribute('skinWeight', new THREE.Float32BufferAttribute(new Array(n).fill([1, 0, 0, 0]).flat(), 4));
  const mesh = new THREE.SkinnedMesh(geo, new THREE.MeshBasicMaterial());
  mesh.name = 'Mesh_0';
  rig.model.name = name;
  rig.model.add(mesh);
  rig.model.updateMatrixWorld(true);
  mesh.bind(new THREE.Skeleton(Object.values(rig.bones)));
  return { ...rig, mesh };
}
const deviation = (mesh) => {
  let top = mesh;
  while (top.parent) top = top.parent;
  top.updateMatrixWorld(true);
  const sk = mesh.skeleton;
  return Math.max(...sk.bones.map((b, i) => skinDeviation(mesh.bindMatrixInverse.elements, b.matrixWorld.elements, sk.boneInverses[i].elements, mesh.bindMatrix.elements)));
};

describe('the bind pose', () => {
  it('is every bone where the skin was bound, wherever the figure is', () => {
    const { model, mesh } = skinned();
    expect(deviation(mesh)).toBeLessThan(1e-5);
    model.position.set(3, 0.5, -2);
    model.rotation.y = 1.1;
    expect(atBindPose(deviation(mesh))).toBe(true);
  });

  it('isn’t a figure its clip has moved', () => {
    const { model, mesh, clips } = skinned();
    const mixer = new THREE.AnimationMixer(model);
    mixer.clipAction(clips.walk).play();
    mixer.update(0.25);
    expect(deviation(mesh)).toBeGreaterThan(BIND_EPS);
    expect(atBindPose(deviation(mesh))).toBe(false);
  });

  it('isn’t anything it couldn’t measure', () => {
    expect(atBindPose(null)).toBe(false);
  });

  it('multiplies as three.js does', () => {
    const a = new THREE.Matrix4().makeRotationY(0.7).setPosition(1, 2, 3);
    const b = new THREE.Matrix4().makeRotationX(-0.3).scale(new THREE.Vector3(2, 2, 2));
    const want = new THREE.Matrix4().multiplyMatrices(a, b).elements;
    mul4(a.elements, b.elements).forEach((x, i) => expect(x).toBeCloseTo(want[i], 10));
  });
});

describe('what’s in view', () => {
  const cam = new THREE.PerspectiveCamera(60, 16 / 9, 0.1, 500);
  cam.position.set(0, 1.5, 6);
  cam.lookAt(0, 1, 0);
  cam.updateMatrixWorld();
  const vp = mul4(cam.projectionMatrix.elements, cam.matrixWorldInverse.elements);
  const eye = cam.matrixWorld.elements;
  it('is in front, on screen and near enough', () => {
    expect(inView(vp, eye, [0, 0, 0], 40)).toBe(true);
    expect(inView(vp, eye, [0, 0, 12], 40)).toBe(false); // behind
    expect(inView(vp, eye, [30, 0, 0], 40)).toBe(false); // off to the side
    expect(inView(vp, eye, [0, 0, -60], 40)).toBe(false); // too far
    expect(inView(vp, eye, [0, 0, -60])).toBe(true);
  });
});

describe('the idle phases', () => {
  it('finds figures on one clip at one phase, round the loop’s end too', () => {
    const { count, groups } = lockstep([
      { id: 1, clip: 'idle', phase: 0.2 },
      { id: 2, clip: 'idle', phase: 0.2 },
      { id: 3, clip: 'walk', phase: 0.2 },
      { id: 4, clip: 'idle', phase: 0.61 },
      { id: 5, clip: 'idle', phase: 0.9998 },
      { id: 6, clip: 'idle', phase: 0.0003 },
    ]);
    expect(count).toBe(4);
    expect(groups.map((g) => [g.clip, [...g.ids].sort()]).sort((a, b) => a[1][0] - b[1][0])).toEqual([
      ['idle', [1, 2]],
      ['idle', [5, 6]],
    ]);
  });

  it('measures how spread a clip’s phases are (1 in unison, 0 spread round)', () => {
    const at = (clip, phases) => phases.map((phase, id) => ({ id, clip, phase }));
    const s = phaseSpread([...at('idle', [0.3, 0.3, 0.3]), ...at('walk', [0, 0.25, 0.5, 0.75]), ...at('wave', [0.5])]);
    expect(s.map((x) => x.clip)).toEqual(['walk', 'idle']);
    expect(s.find((x) => x.clip === 'idle').r).toBeCloseTo(1, 6);
    expect(s.find((x) => x.clip === 'walk').r).toBeCloseTo(0, 6);
  });
});

describe('a figure’s feet and name', () => {
  it('finds the toes on Meshy’s and Mixamo’s skeletons, else the feet', () => {
    const meshy = MESHY_BONES.map(([n]) => n);
    expect(toesOf(meshy)).toEqual({ l: meshy.indexOf('LeftToeBase'), r: meshy.indexOf('RightToeBase'), by: 'toe' });
    expect(toesOf(['mixamorig:Hips', 'mixamorig:RightToeBase', 'mixamorig:LeftToeBase'])).toEqual({ l: 2, r: 1, by: 'toe' });
    expect(toesOf(['pelvis', 'foot_l', 'foot_r'])).toEqual({ l: 1, r: 2, by: 'foot' });
    expect(toesOf(['Hips', 'LeftToeBase'])).toBeNull();
    expect(toesOf(['Bone', 'Bone001'])).toBeNull();
  });

  it('names a figure by the nearest name that isn’t an exporter’s', () => {
    expect(figureName(['Mesh_0', 'Scene', 'rick', 'life'])).toBe('rick');
    expect(figureName(['Object_12', 'Armature', 'luke.glb', 'Sketchfab_model', 'trooper'])).toBe('trooper');
    expect(figureName(['', 'Group'])).toBe('figure');
  });
});

describe('the command line', () => {
  it('takes the route however it’s written, and its options', () => {
    expect(routeOf('#/c-137')).toBe('#/c-137');
    expect(routeOf('/galaxy/tatooine/surface')).toBe('#/galaxy/tatooine/surface');
    expect(routeOf('c-137/citadel')).toBe('#/c-137/citadel');
    const a = parseArgs(['--route', 'c-137', '--seconds', '3', '--port', '5188', '--do', 'click:Defend', '--do', 'x()', '--strict'], {});
    expect(a).toMatchObject({ route: '#/c-137', seconds: 3, port: 5188, do: ['click:Defend', 'x()'], strict: true, limit: LIMIT });
    expect(parseArgs([], { PORT: '5200' })).toMatchObject({ route: '#/c-137', port: 5200, seconds: 6 });
  });

  it('says what’s wrong with what it was given', () => {
    expect(() => parseArgs(['--seconds', 'soon'], {})).toThrow(/--seconds/);
    expect(() => parseArgs(['--speed', '2'], {})).toThrow(/--speed/);
    expect(() => parseArgs(['--route'], {})).toThrow(/--route/);
    // (Git Bash turns '/c-137' into a path under its own folder)
    expect(() => parseArgs(['--route', 'C:/Program Files/Git/c-137'], {})).toThrow(/#\/c-137/);
  });

  it('finds the browser it was told to, or the first there is', () => {
    const there = (...paths) => (p) => paths.includes(p);
    const edge = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
    expect(browserPath(null, { CHROME: 'edge' }, [], there(edge))).toBe(edge);
    expect(browserPath('/my/chrome', {}, [], there('/my/chrome'))).toBe('/my/chrome');
    expect(browserPath('/gone/chrome', {}, [], there(edge))).toBeNull();
    expect(browserPath(null, {}, ['/opt/pw-browsers/chromium-1194/chrome-linux/chrome'], there(edge, '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'))).toBe('/opt/pw-browsers/chromium-1194/chrome-linux/chrome');
    expect(browserPath(null, {}, [], there())).toBeNull();
  });
});

describe('the verdict', () => {
  // a figure's samples: frame k, its toes at x = v·k/30 (both still on the ground), in view or not
  const fig = (id, v, seen, extra = {}) => ({
    id,
    name: `f${id}`,
    by: 'toe',
    up: [0, 1, 0],
    dev: 0.3,
    act: null,
    s: Array.from({ length: 31 }, (_, k) => [k, (v * k) / 30, 0, 0, (v * k) / 30 + 0.3, 0, 0, seen ? 1 : 0]),
    ...extra,
  });
  const res = (figs) => ({ figs, wall: Array.from({ length: 31 }, (_, k) => (k ? 1 / 30 : 0)), totals: [1] });

  it('fails on a figure in view over the limit, not on one out of view', () => {
    const v = analyse(res([fig(0, 0.4, true), fig(1, 0.9, false), fig(2, 0.05, true)]));
    expect(v.over.map((r) => r.id)).toEqual([0]);
    expect(v.fail).toBe(true);
    expect(v.rows.find((r) => r.id === 1).drift).toBeCloseTo(0.9, 5);
    expect(analyse(res([fig(2, 0.05, true)])).fail).toBe(false);
  });

  it('counts the figures at the bind pose, and the ones in step', () => {
    const v = analyse(res([fig(0, 0, true, { dev: 0 }), fig(1, 0, true, { act: { clip: 'idle', phase: 0.5, loop: true } }), fig(2, 0, true, { act: { clip: 'idle', phase: 0.5, loop: true } })]));
    expect(v.bind.map((r) => r.id)).toEqual([0]);
    expect(v.locked.count).toBe(2);
    expect(v.fail).toBe(false);
  });
});

describe('the page’s half, on three.js’s own objects', () => {
  let rafs = [];
  let now = 0;
  afterEach(() => {
    for (const k of ['__THREE_DEVTOOLS__', '__threeScenes', '__animCheck', 'requestAnimationFrame']) delete globalThis[k];
    vi.restoreAllMocks();
  });

  it('lists the scenes drawn, finds the figures and measures them frame by frame', () => {
    rafs = [];
    now = 1000;
    globalThis.requestAnimationFrame = (cb) => rafs.push(cb);
    vi.spyOn(performance, 'now').mockImplementation(() => now);
    new Function(pageScript({ range: 40 }))();
    expect(globalThis.__THREE_DEVTOOLS__).toBeTruthy();

    const scene = new THREE.Scene();
    const at = (name, x, z) => {
      const f = skinned(name);
      f.model.position.set(x, 0, z);
      scene.add(f.model);
      return f;
    };
    const glider = at('glider', -2, 0); // its bind pose, carried along
    const treadmill = at('treadmill', 0, 0); // walking without going anywhere
    const twin = at('twin', 2, 0); // in step with the treadmill
    const apart = at('apart', 4, 0); // the same walk, out of step
    at('behind', 0, 20); // behind the camera
    const hidden = at('hidden', 1, 1);
    hidden.model.visible = false;
    // (an AnimationMixer tells the hook it's been made)
    const mixers = [treadmill, twin, apart].map((f) => new THREE.AnimationMixer(f.model));
    mixers.forEach((m, i) => m.clipAction([treadmill, twin, apart][i].clips.walk).play());
    mixers[2].update(0.37);
    const camera = new THREE.PerspectiveCamera(60, 16 / 9, 0.1, 500);
    camera.position.set(0, 1.6, 8);
    camera.lookAt(0, 1, 0);
    // a stand-in renderer: three's tells the hook it's been made, as this does
    const renderer = { isWebGLRenderer: true, render: (s, c) => (s.updateMatrixWorld(), c.updateMatrixWorld()) };
    globalThis.__THREE_DEVTOOLS__.dispatchEvent(new CustomEvent('observe', { detail: renderer }));
    const frame = () => {
      now += 1000 / 30;
      for (const m of mixers) m.update(1 / 30);
      glider.model.position.x += 0.5 / 30;
      renderer.render(scene, camera);
      const due = rafs;
      rafs = [];
      due.forEach((cb) => cb(now));
    };
    frame();
    expect(globalThis.__threeScenes.map((e) => e.scene.deref())).toEqual([scene]);
    // (the hidden one isn't drawn, though it's found, in case it shows)
    expect(globalThis.__animCheck.drawn()).toEqual({ scenes: 1, figures: 5 });

    expect(globalThis.__animCheck.start()).toBe(6);
    for (let i = 0; i < 60; i++) frame();
    expect(globalThis.__animCheck.sampling()).toBe(60);
    const v = analyse(globalThis.__animCheck.stop());
    const row = (name) => v.rows.find((r) => r.name === name);
    const lines = report(v, { route: '#/test', frames: 60, wall: 2 });
    expect(lines[0]).toMatch(/^#\/test: 6 figures in 1 scene, 4 in view; 60 frames/);
    expect(lines.find((l) => /treadmill#\d/.test(l))).toMatch(/walk 0\.03 .* OVER$/);
    expect(lines).toContain('  (1 more never shown)');

    expect(v.time.from).toBe('mixers');
    expect(v.time.total).toBeCloseTo(59 / 30, 6);
    expect(row('glider').drift).toBeCloseTo(0.5, 3);
    expect(row('glider').bind).toBe(true);
    expect(row('glider').inView).toBe(true);
    expect(row('treadmill').drift).toBeGreaterThan(LIMIT);
    expect(row('treadmill').bind).toBe(false);
    expect(row('treadmill').act).toMatchObject({ clip: 'walk', loop: true });
    expect(row('behind').inView).toBe(false);
    expect(row('behind').drift).toBeLessThan(1e-6);
    expect(row('hidden').drift).toBeNull();
    expect(v.over.map((r) => r.name).sort()).toEqual(['apart', 'glider', 'treadmill', 'twin']);
    expect(v.locked.groups.map((g) => g.ids.map((id) => v.rows.find((r) => r.id === id).name).sort())).toEqual([['treadmill', 'twin']]);
    expect(globalThis.__animCheck.sampling()).toBe(0);
  });

  it('wraps a renderer once, however often it’s told of it', () => {
    globalThis.requestAnimationFrame = () => 0;
    new Function(pageScript({ range: 40 }))();
    const draw = vi.fn();
    const renderer = { isWebGLRenderer: true, render: draw };
    for (let i = 0; i < 2; i++) globalThis.__THREE_DEVTOOLS__.dispatchEvent(new CustomEvent('observe', { detail: renderer }));
    renderer.render(new THREE.Scene(), new THREE.PerspectiveCamera());
    expect(draw).toHaveBeenCalledTimes(1);
    expect(globalThis.__threeScenes).toHaveLength(1);
  });
});

describe('--held: the things in hand', () => {
  const Q = (a) => [Math.sin(a / 2), 0, 0, Math.cos(a / 2)]; // a turn of `a` about x
  const frame = (o) => ({ id: 'a', kind: 'staff', carry: {}, grip: 0.005, axis: 0.05, up: 0.1, arm: Q(0), moving: false, ...o });

  it('passes a thing in the palm on its line, and names what’s wrong with one that isn’t', () => {
    expect(heldVerdict([frame(), frame({ grip: 0.02 })]).ok).toBe(true);
    const far = heldVerdict([frame(), frame({ grip: 0.045 })]);
    expect(far.ok).toBe(false);
    expect(far.worst.grip).toBeCloseTo(0.045, 6);
    expect(far.items[0].why[0]).toMatch(/grip 4\.5 cm/);
    expect(heldVerdict([frame({ axis: (20 * Math.PI) / 180 })]).items[0].why[0]).toMatch(/axis 20°/);
    // (in a world of centimetres, 2 is 2 cm)
    expect(heldVerdict([frame({ grip: 2 })], { scale: 100 }).ok).toBe(true);
    expect(heldVerdict([]).ok).toBe(true);
  });

  it('a still carry’s arm may swing only a little while walking; standing it’s not counted', () => {
    const still = { still: true };
    const walk = (amp) => [0, 1, 2, 3, 4, 5].map((i) => frame({ carry: still, moving: true, arm: Q(amp * Math.sin(i)) }));
    expect(swingOf([Q(-0.3), Q(0.3)])).toBeCloseTo(0.3, 6);
    expect(heldVerdict(walk(0.1)).ok).toBe(true);
    const swung = heldVerdict(walk(0.4));
    expect(swung.ok).toBe(false);
    expect(swung.worst.swing).toBeGreaterThan(0.25);
    expect(heldVerdict(walk(0.4).map((f) => ({ ...f, moving: false }))).ok).toBe(true);
  });

  it('an upright carry’s top within 25° of up; another kind’s top isn’t asked', () => {
    const tilt = (deg) => frame({ carry: { upright: true }, up: (deg * Math.PI) / 180 });
    expect(heldVerdict([tilt(20)]).ok).toBe(true);
    expect(heldVerdict([tilt(30)]).ok).toBe(false);
    expect(heldVerdict([frame({ up: 2 })]).ok).toBe(true);
  });

  it('reads a held thing’s grip and axis off the scene, as held.js put it', async () => {
    const { holdItem } = await import('../src/lib/three/held.js');
    const { withHands } = await import('../src/lib/three/meshyRig.fixture.js');
    const rig = withHands(meshyRig());
    const scene = new THREE.Scene();
    scene.add(rig.model);
    const staff = new THREE.Group();
    const grip = new THREE.Object3D();
    grip.name = 'grip';
    grip.position.y = 0.3;
    staff.add(grip);
    holdItem({ model: rig.model }, staff, 'staff');
    scene.updateMatrixWorld(true);
    const [s] = sampleHeld([scene]);
    expect(s.kind).toBe('staff');
    expect(s.grip).toBeLessThan(1e-6);
    expect(s.axis).toBeLessThan(1e-3);
    expect(s.arm).toHaveLength(4);
    staff.position.x += 5; // (in hand units: 5 cm)
    scene.updateMatrixWorld(true);
    expect(sampleHeld([scene])[0].grip).toBeCloseTo(0.05, 3);
    staff.visible = false;
    expect(sampleHeld([scene])).toEqual([]);
  });

  it('its page script runs as a script', () => {
    new Function(heldPageScript())();
    expect(typeof globalThis.__animHeld.start).toBe('function');
    globalThis.__animHeld.start();
    expect(globalThis.__animHeld.stop()).toEqual([]);
  });
});

describe('--talk: E and the body’s answer', () => {
  it('passes a prompt that promises the talk and a reaction within half a second', () => {
    const frames = [
      { t: 0.1, upper: null, look: true },
      { t: 0.2, upper: 'talk', look: true },
    ];
    expect(talkVerdict({ prompt: 'E Talk · Gandalf', frames })).toEqual({ ok: true, at: 0.2, why: null });
    expect(TALK_WITHIN).toBe(0.5);
  });

  it('fails no prompt, a prompt for something else, and an answer too late or without a look', () => {
    const on = [{ t: 0.2, upper: 'talk', look: true }];
    expect(talkVerdict({ prompt: null, frames: on }).why).toBe('no prompt');
    expect(talkVerdict({ prompt: 'E Go in · Door', frames: on }).why).toMatch(/E Go in/);
    expect(talkVerdict({ prompt: 'E Talk · Sam', frames: [{ t: 0.7, upper: 'talk', look: true }] }).ok).toBe(false);
    expect(talkVerdict({ prompt: 'E Talk · Sam', frames: [{ t: 0.2, upper: 'talk', look: false }] }).ok).toBe(false);
  });

  it('reads the key from the prompt: another world’s letter is as good as E', () => {
    const on = [{ t: 0.2, upper: 'talk', look: true }];
    expect(talkVerdict({ prompt: 'X Talk · Mr Poopybutthole', frames: on }).ok).toBe(true);
    expect(talkVerdict({ prompt: 'X Read · Sign', frames: on }).why).toMatch(/X Read/);
    expect(keyOf('X Talk · Mr Poopybutthole')).toEqual({ key: 'x', code: 'KeyX' });
    expect(keyOf('E Talk · Sam')).toEqual({ key: 'e', code: 'KeyE' });
    expect(keyOf('5 Talk')).toEqual({ key: '5', code: 'Digit5' });
    expect(keyOf('Enter Talk · Sam')).toEqual({ key: 'Enter', code: 'Enter' });
    expect(keyOf(null)).toBe(null);
  });

  it('reads the prompt that names the talker, else the first, and says which', () => {
    const prompts = ['E Go in · Door', 'E Talk · Sam', 'E Talk · Rosie'];
    expect(promptFor(prompts, 'Rosie')).toEqual({ prompt: 'E Talk · Rosie', theirs: true, of: 3 });
    expect(promptFor(prompts, 'Gaffer')).toEqual({ prompt: 'E Go in · Door', theirs: false, of: 3 });
    expect(promptFor([], 'Sam')).toEqual({ prompt: null, theirs: false, of: 0 });
  });

  it('visits each talker, presses the key its prompt names and reports the prompt it read', async () => {
    const pressed = [];
    const said = new Map();
    const g = globalThis;
    const saved = { window: g.window, document: g.document, KeyboardEvent: g.KeyboardEvent };
    g.KeyboardEvent = class {
      constructor(type, o) {
        Object.assign(this, o, { type });
      }
    };
    let now = 0;
    g.window = {
      __talkers: () => [
        { id: 'a', name: 'Rick', x: 3, z: 0, upper: () => (said.get('a') ? 'talk' : null), looking: () => said.has('a') },
        { id: 'b', name: 'Morty', x: 0, z: 4, upper: () => null, looking: () => false },
      ],
      __teleport: () => {},
      requestAnimationFrame: (f) => {
        now += 50;
        setTimeout(() => f(now), 0);
      },
      dispatchEvent: (e) => {
        if (e.type === 'keydown') {
          pressed.push(e.code);
          if (e.code === 'KeyX') said.set('a', true);
        }
      },
    };
    g.document = { querySelectorAll: () => ['Morty', 'Rick'].map((n) => ({ getAttribute: () => `X Talk · ${n}` })) };
    vi.spyOn(performance, 'now').mockImplementation(() => now);
    try {
      const page = { evaluate: (fn, arg) => fn(arg) };
      const out = await talkCheck(page);
      expect(pressed).toEqual(['KeyX', 'KeyX']);
      expect(out.talkers[0]).toMatchObject({ id: 'a', ok: true, prompt: 'X Talk · Rick', theirs: true });
      expect(out.talkers[1]).toMatchObject({ id: 'b', ok: false, prompt: 'X Talk · Morty', theirs: true });
      expect(heldTalkLines(null, out).at(-1)).toMatch(/FAIL Morty: .* \(read “X Talk · Morty”\)$/);
    } finally {
      Object.assign(g, saved);
    }
  });

  it('says --held and --talk were not run when they sampled nothing, and fails them unless --allow-empty', () => {
    expect(parseArgs(['--allow-empty'], {})).toMatchObject({ allowEmpty: true });
    expect(parseArgs([], {})).toMatchObject({ allowEmpty: false });
    const none = heldVerdict([]);
    expect(heldTalkLines(none, { talkers: [] })).toEqual(['held: not run (nothing held was sampled)', 'talk: not run (no talkers)']);
    const asked = { held: true, talk: true, allowEmpty: false };
    expect(emptyFails(asked, none, { skipped: 'no hooks' })).toEqual(['--held sampled nothing', '--talk visited no one']);
    expect(emptyFails({ ...asked, allowEmpty: true }, none, { skipped: 'no hooks' })).toEqual([]);
    expect(emptyFails({ held: false, talk: false }, null, null)).toEqual([]);
    const one = heldVerdict([{ id: 'a', kind: 'staff', carry: {}, grip: 0, axis: 0, up: 0, arm: null, moving: false }]);
    expect(emptyFails(asked, one, { talkers: [{ name: 'Sam', ok: true, at: 0.2 }] })).toEqual([]);
  });

  it('takes --held and --talk, and reports a route without talkers as not run', () => {
    expect(parseArgs(['--held', '--talk'], {})).toMatchObject({ held: true, talk: true });
    expect(parseArgs([], {})).toMatchObject({ held: false, talk: false });
    expect(heldTalkLines(null, { skipped: 'no hooks' })).toEqual(['talk: not run (no hooks)']);
    const lines = heldTalkLines(heldVerdict([{ id: 'a', kind: 'staff', carry: {}, grip: 0.05, axis: 0, up: 0, arm: null, moving: false }]), { talkers: [{ name: 'Sam', ok: true, at: 0.2 }] });
    expect(lines[1]).toMatch(/^ {2}OVER staff/);
    expect(lines.at(-1)).toBe('  ok   Sam: answered in 0.20 s');
  });
});
