import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { createWarmup } from './warmup';

// A stand-in renderer: compile() makes a program per material that is ready
// once `finish(m)` says so (or at once, for anything in `cached`).
function fakeRenderer({ parallel = true } = {}) {
  const props = new WeakMap();
  const done = new WeakSet();
  const cached = new WeakSet();
  const targets = [];
  let target = null;
  const r = {
    extensions: { has: (name) => parallel && name === 'KHR_parallel_shader_compile' },
    properties: { get: (m) => (props.has(m) ? props.get(m) : props.set(m, {}).get(m)) },
    getRenderTarget: () => target,
    setRenderTarget: (t) => {
      target = t;
    },
    compiled: [],
    compile(root, camera, scene = root) {
      targets.push(target);
      const mats = new Set();
      root.traverse((o) => {
        if (!o.material) return;
        mats.add(o.material);
        r.compiled.push(o.material);
        r.properties.get(o.material).currentProgram = { isReady: () => !parallel || done.has(o.material) || cached.has(o.material) };
      });
      expect(scene.isScene).toBe(true);
      return mats;
    },
    finish: (m) => done.add(m),
    cache: (m) => cached.add(m),
    targets,
  };
  return r;
}

const mesh = () => new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshBasicMaterial());

describe('warmup', () => {
  it('holds back what is new until its shaders are made, then draws it', () => {
    const r = fakeRenderer();
    const w = createWarmup(r);
    const scene = new THREE.Scene();
    const a = mesh();
    scene.add(a);
    w.gate(scene, null, 'rt');
    expect(a.visible).toBe(false);
    expect(r.targets).toEqual(['rt']); // made for where it's drawn
    expect(r.getRenderTarget()).toBe(null); // and the target put back
    w.open();
    expect(a.visible).toBe(true);
    w.gate(scene, null, 'rt'); // still compiling: held again, not compiled again
    expect(a.visible).toBe(false);
    expect(r.compiled).toHaveLength(1);
    w.open();
    r.finish(a.material);
    w.gate(scene, null, 'rt');
    expect(a.visible).toBe(true);
    w.open();
    expect(a.visible).toBe(true);
  });

  it('draws a copy of something already made straight away', () => {
    const r = fakeRenderer();
    const w = createWarmup(r);
    const scene = new THREE.Scene();
    const a = mesh();
    scene.add(a);
    r.cache(a.material);
    w.gate(scene, null, null);
    expect(a.visible).toBe(true);
  });

  it('leaves hidden things alone, and puts back only what it hid', () => {
    const r = fakeRenderer();
    const w = createWarmup(r);
    const scene = new THREE.Scene();
    const a = mesh();
    const off = mesh();
    off.visible = false;
    scene.add(a, off);
    w.gate(scene, null, null);
    w.open();
    expect(off.visible).toBe(false);
    expect(r.compiled).not.toContain(off.material);
  });

  it('gates two scenes in one frame', () => {
    const r = fakeRenderer();
    const w = createWarmup(r);
    const one = new THREE.Scene();
    const two = new THREE.Scene();
    const a = mesh();
    const b = mesh();
    one.add(a);
    two.add(b);
    w.gate(one, null, null);
    w.gate(two, null, null);
    expect([a.visible, b.visible]).toEqual([false, false]);
    w.open();
    expect([a.visible, b.visible]).toEqual([true, true]);
  });

  it('all() resolves once everything is made', async () => {
    const r = fakeRenderer();
    const w = createWarmup(r);
    const scene = new THREE.Scene();
    const a = mesh();
    const hidden = mesh();
    hidden.visible = false; // made too: it will show later
    scene.add(a, hidden);
    let resolved = false;
    const p = w.all(scene, null, 'rt').then(() => (resolved = true));
    expect(w.pending).toBe(2);
    await new Promise((res) => setTimeout(res, 40));
    expect(resolved).toBe(false);
    r.finish(a.material);
    r.finish(hidden.material);
    await p;
    expect(w.pending).toBe(0);
    w.gate(scene, null, 'rt');
    expect(a.visible).toBe(true);
  });

  it('without parallel compiling, holds nothing back', async () => {
    const r = fakeRenderer({ parallel: false });
    const w = createWarmup(r);
    const scene = new THREE.Scene();
    const a = mesh();
    scene.add(a);
    w.gate(scene, null, null);
    expect(a.visible).toBe(true);
    await w.all(scene, null, null);
    expect(w.pending).toBe(0);
  });
});
