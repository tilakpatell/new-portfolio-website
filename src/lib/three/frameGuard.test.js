import { afterEach, describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { guard } from './frameGuard';
import { fakeRenderer, frames } from './fakeRenderer.fixture';

// The Task 2 stand-in, drawing the way three.js does: render walks the
// scene's visible meshes and calls the instance's renderBufferDirect for
// each (twice, with a version bump before each, for a transparent
// double-sided material), plus a shadow draw (scene null) for each mesh that
// casts one. A draw of a material with no program compiles it there and
// then, as three does, and counts it in info.programs.
const drawingRenderer = (opts) => {
  const r = fakeRenderer(opts);
  r.drawn = [];
  r.shadowDrawn = [];
  r.info = { programs: [] };
  r.renderBufferDirect = (camera, scene, geometry, material, object) => {
    if (scene === null) {
      r.shadowDrawn.push(material);
      return;
    }
    const p = r.properties.get(material);
    if (!p.currentProgram) {
      p.currentProgram = { isReady: () => true };
      r.info.programs.push(p.currentProgram);
    }
    r.drawn.push([material, object]);
  };
  r.render = (scene, camera) => {
    const meshes = [];
    if (scene.isScene) scene.traverseVisible((o) => o.isMesh && meshes.push(o));
    else meshes.push(scene);
    for (const o of meshes) if (o.castShadow) r.renderBufferDirect(camera, null, o.geometry, new THREE.MeshDepthMaterial(), o, null);
    for (const o of meshes) {
      const m = o.material;
      if (m.transparent && m.side === THREE.DoubleSide) {
        m.needsUpdate = true;
        r.renderBufferDirect(camera, scene, o.geometry, m, o, null);
        m.needsUpdate = true;
        r.renderBufferDirect(camera, scene, o.geometry, m, o, null);
      } else r.renderBufferDirect(camera, scene, o.geometry, m, o, null);
    }
  };
  return r;
};

const picture = (w, h, extra = {}) => Object.assign(new THREE.Texture({ width: w, height: h }), { version: 1 }, extra);
// (one macrotask: every microtask the pump and its fence chain up has run)
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));
const drawnCount = (r, m) => r.drawn.filter((d) => d[0] === m).length;

const world = (...materials) => {
  const scene = new THREE.Scene();
  const meshes = materials.map((m) => new THREE.Mesh(new THREE.BoxGeometry(), m));
  scene.add(...meshes);
  return { scene, meshes, camera: new THREE.PerspectiveCamera() };
};

afterEach(() => vi.restoreAllMocks());

describe('guard', () => {
  it('skips a never-compiled material, then draws it once its program is ready after the fence', async () => {
    const r = drawingRenderer({ signalAfter: 2 });
    const g = guard(r, { frame: frames() });
    const m = new THREE.MeshBasicMaterial({ map: picture(64, 64) });
    const { scene, camera } = world(m);
    r.render(scene, camera);
    expect(drawnCount(r, m)).toBe(0);
    expect(g.pending()).toBe(1);
    await settle();
    // compiled and fenced off the frame, with its picture sent first
    expect(r.compiled).toEqual([m]);
    expect(r.uploads).toEqual([m.map]);
    expect(r.gl.fences).toBe(1);
    expect(r.gl.log.indexOf('signal')).toBeLessThan(r.gl.log.indexOf('ready?'));
    expect(g.pending()).toBe(0);
    r.render(scene, camera);
    expect(drawnCount(r, m)).toBe(1);
    expect(r.info.programs.length).toBe(0); // never compiled mid-frame
    g.dispose();
  });

  it('waits a frame more for a program that has not linked by the fence', async () => {
    const r = drawingRenderer({ readyAfter: 1 });
    const g = guard(r, { frame: frames() });
    const m = new THREE.MeshBasicMaterial();
    const { scene, camera } = world(m);
    r.render(scene, camera);
    await settle();
    r.render(scene, camera);
    expect(drawnCount(r, m)).toBe(0);
    await settle();
    r.render(scene, camera);
    expect(drawnCount(r, m)).toBe(1);
    g.dispose();
  });

  it('draws a material compiled already, with its pictures up, at once and never queues it', async () => {
    const r = drawingRenderer();
    const g = guard(r, { frame: frames() });
    const m = new THREE.MeshStandardMaterial({ map: picture(8, 8) });
    r.properties.get(m).currentProgram = { isReady: () => true };
    r.initTexture(m.map);
    const { scene, camera } = world(m);
    r.render(scene, camera);
    expect(drawnCount(r, m)).toBe(1);
    expect(g.pending()).toBe(0);
    await settle();
    expect(r.compiled).toEqual([]);
    expect(r.gl.fences).toBe(0);
    g.dispose();
  });

  it('holds back a compiled material whose picture has never been sent', async () => {
    const r = drawingRenderer();
    const g = guard(r, { frame: frames() });
    const tex = picture(8, 8);
    const m = new THREE.ShaderMaterial({ uniforms: { tex: { value: tex } } });
    r.properties.get(m).currentProgram = { isReady: () => true };
    const { scene, camera } = world(m);
    r.render(scene, camera);
    expect(drawnCount(r, m)).toBe(0);
    await settle();
    expect(r.uploads).toEqual([tex]);
    r.render(scene, camera);
    expect(drawnCount(r, m)).toBe(1);
    g.dispose();
  });

  it('lets shadow draws (scene null) through always', () => {
    const r = drawingRenderer();
    const g = guard(r, { frame: frames() });
    const { scene, camera, meshes } = world(new THREE.MeshBasicMaterial());
    meshes[0].castShadow = true;
    r.render(scene, camera);
    expect(r.shadowDrawn.length).toBe(1);
    expect(r.drawn.length).toBe(0);
    g.dispose();
  });

  it('draws a transparent double-sided material every frame once ready, though its version bumps every draw', async () => {
    const r = drawingRenderer();
    const g = guard(r, { frame: frames() });
    const m = new THREE.MeshBasicMaterial({ transparent: true, side: THREE.DoubleSide });
    const { scene, camera } = world(m);
    r.render(scene, camera);
    expect(g.pending()).toBe(1);
    await settle();
    for (let i = 0; i < 3; i++) {
      const before = m.version;
      r.render(scene, camera);
      expect(m.version).toBeGreaterThan(before);
      await settle();
    }
    expect(drawnCount(r, m)).toBe(6);
    expect(r.compiled).toEqual([m]);
    g.dispose();
  });

  it('never gates on a canvas picture already up, bumped every frame', async () => {
    const r = drawingRenderer();
    const g = guard(r, { frame: frames() });
    const canvas = Object.assign(new THREE.CanvasTexture({ width: 32, height: 32 }), {});
    const m = new THREE.MeshBasicMaterial({ map: canvas });
    r.properties.get(m).currentProgram = { isReady: () => true };
    r.initTexture(canvas);
    const { scene, camera } = world(m);
    for (let i = 0; i < 3; i++) {
      canvas.needsUpdate = true;
      r.render(scene, camera);
      await settle();
    }
    expect(drawnCount(r, m)).toBe(3);
    expect(g.pending()).toBe(0);
    g.dispose();
  });

  it('runs adopt hooks for a queued object before compiling it', async () => {
    const r = drawingRenderer();
    const order = [];
    const compile = r.compile;
    r.compile = (root, camera, scene) => {
      root.traverse((o) => order.push(['compile', o]));
      return compile(root, camera, scene);
    };
    const g = guard(r, { frame: frames(), adopt: (o) => order.push(['option', o]) });
    const off = g.adopt((o) => order.push(['hook', o]));
    const { scene, camera, meshes } = world(new THREE.MeshBasicMaterial());
    r.render(scene, camera);
    await settle();
    expect(order).toEqual([
      ['option', meshes[0]],
      ['hook', meshes[0]],
      ['compile', meshes[0]],
    ]);
    // and a hook taken off runs no more
    off();
    const late = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshBasicMaterial());
    scene.add(late);
    r.render(scene, camera);
    await settle();
    expect(order.filter((e) => e[0] === 'hook').length).toBe(1);
    g.dispose();
  });

  it('does not hide a material forever when its compile throws', async () => {
    const r = drawingRenderer();
    r.compile = () => {
      throw new Error('bad shader');
    };
    const g = guard(r, { frame: frames() });
    const m = new THREE.MeshBasicMaterial();
    const { scene, camera } = world(m);
    r.render(scene, camera);
    await settle();
    r.render(scene, camera);
    expect(drawnCount(r, m)).toBe(1);
    g.dispose();
  });

  it('leaves a render of a non-Scene alone: its draws pass, and nothing is pumped', async () => {
    const r = drawingRenderer();
    const g = guard(r, { frame: frames() });
    const quad = new THREE.Mesh(new THREE.PlaneGeometry(), new THREE.ShaderMaterial());
    r.render(quad, new THREE.OrthographicCamera());
    expect(drawnCount(r, quad.material)).toBe(1);
    expect(g.pending()).toBe(0);
    g.dispose();
  });

  it('does not pump a waiting queue from a render of a non-Scene', async () => {
    // (a program that hasn't linked by its fence waits for the next pump)
    const r = drawingRenderer({ readyAfter: 1 });
    const g = guard(r, { frame: frames() });
    const { scene, camera } = world(new THREE.MeshBasicMaterial());
    r.render(scene, camera);
    await settle();
    expect(g.pending()).toBe(1);
    const fences = r.gl.fences;
    const spy = vi.spyOn(globalThis, 'queueMicrotask');
    r.render(new THREE.Mesh(new THREE.PlaneGeometry(), new THREE.ShaderMaterial()), new THREE.OrthographicCamera());
    await settle();
    expect(spy).not.toHaveBeenCalled();
    expect(r.gl.fences).toBe(fences);
    expect(g.pending()).toBe(1);
    // and the next Scene render does
    r.render(scene, camera);
    await settle();
    expect(g.pending()).toBe(0);
    g.dispose();
  });

  it('sends pictures up to uploadMB a frame, at least one, biggest last', async () => {
    const r = drawingRenderer();
    const g = guard(r, { frame: frames(), uploadMB: 4 });
    const big = picture(1024, 1024); // 4MB
    const small = picture(512, 512); // 1MB
    const huge = picture(2048, 2048); // 16MB
    const m = new THREE.MeshStandardMaterial({ map: big, normalMap: small, roughnessMap: huge });
    const { scene, camera } = world(m);
    r.render(scene, camera);
    await settle();
    expect(r.uploads).toEqual([small]);
    r.render(scene, camera);
    expect(drawnCount(r, m)).toBe(0);
    await settle();
    expect(r.uploads).toEqual([small, big]);
    r.render(scene, camera);
    await settle();
    expect(r.uploads).toEqual([small, big, huge]);
    r.render(scene, camera);
    expect(drawnCount(r, m)).toBe(1);
    g.dispose();
  });

  it('checks a swapped material afresh', async () => {
    const r = drawingRenderer();
    const g = guard(r, { frame: frames() });
    const a = new THREE.MeshBasicMaterial();
    const { scene, camera, meshes } = world(a);
    r.render(scene, camera);
    await settle();
    r.render(scene, camera);
    expect(drawnCount(r, a)).toBe(1);
    const b = new THREE.MeshBasicMaterial();
    meshes[0].material = b;
    r.render(scene, camera);
    expect(drawnCount(r, b)).toBe(0);
    expect(g.pending()).toBe(1);
    g.dispose();
  });

  it('is one guard per renderer, passes everything when disabled, and dispose puts the renderer back', async () => {
    const r = drawingRenderer();
    const draw = r.renderBufferDirect;
    const render = r.render;
    const g = guard(r, { frame: frames() });
    expect(guard(r)).toBe(g);
    expect(r.renderBufferDirect).not.toBe(draw);
    const m = new THREE.MeshBasicMaterial();
    const { scene, camera } = world(m);
    g.enabled = false;
    r.render(scene, camera);
    expect(drawnCount(r, m)).toBe(1);
    g.enabled = true;
    g.dispose();
    expect(r.renderBufferDirect).toBe(draw);
    expect(r.render).toBe(render);
    expect(guard(r, { frame: frames() })).not.toBe(g);
  });

  it('goes quietly when the context is lost mid-pump', async () => {
    const r = drawingRenderer({ signalAfter: Infinity, lostAfterPolls: 1 });
    const g = guard(r, { frame: frames() });
    const m = new THREE.MeshBasicMaterial();
    const { scene, camera } = world(m);
    r.render(scene, camera);
    await settle();
    expect(r.gl.log).not.toContain('ready?');
    expect(g.pending()).toBe(1);
    g.dispose();
  });

  it('logs, in development, a frame that compiled shaders mid-draw', () => {
    const r = drawingRenderer();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const g = guard(r, { frame: frames() });
    g.enabled = false;
    const { scene, camera } = world(new THREE.MeshBasicMaterial(), new THREE.MeshLambertMaterial());
    r.render(scene, camera);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0][0]).toMatch(/^\[frameGuard\] 2 shader\(s\) compiled mid-frame \(\d+(\.\d+)?ms\)$/);
    r.render(scene, camera);
    expect(warn).toHaveBeenCalledTimes(1);
    g.dispose();
  });
});
