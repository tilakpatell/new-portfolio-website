import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { revealAll, texturesUnder, uploadTextures } from './renderer';

const mesh = (visible = true) => {
  const m = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshBasicMaterial());
  m.visible = visible;
  return m;
};

describe('everything drawn once, hidden things too', () => {
  it('shows what was hidden, culled or not, and puts it back', () => {
    const scene = new THREE.Scene();
    const shown = mesh();
    const hidden = mesh(false);
    const group = new THREE.Group();
    group.visible = false;
    const inside = mesh();
    group.add(inside);
    scene.add(shown, hidden, group);

    const undo = revealAll(scene);
    expect([shown.visible, hidden.visible, group.visible, inside.visible]).toEqual([true, true, true, true]);
    expect([shown.frustumCulled, hidden.frustumCulled, inside.frustumCulled]).toEqual([false, false, false]);

    undo();
    expect([shown.visible, hidden.visible, group.visible, inside.visible]).toEqual([true, false, false, true]);
    expect([shown.frustumCulled, hidden.frustumCulled, inside.frustumCulled]).toEqual([true, true, true]);
  });

  it('leaves the lights as they are (a hidden one lit would make shaders of its own)', () => {
    const scene = new THREE.Scene();
    const on = new THREE.PointLight();
    const off = new THREE.PointLight();
    off.visible = false;
    const group = new THREE.Group();
    group.visible = false;
    const underHidden = new THREE.PointLight(); // (visible itself, but in something hidden: not lighting anything)
    group.add(underHidden);
    scene.add(on, off, group);

    const undo = revealAll(scene);
    expect([on.visible, off.visible, underHidden.visible]).toEqual([true, false, false]);
    undo();
    expect([on.visible, off.visible, group.visible, underHidden.visible]).toEqual([true, false, false, true]);
  });

  it('takes more than one root', () => {
    const a = new THREE.Scene();
    const b = new THREE.Scene();
    const ha = mesh(false);
    const hb = mesh(false);
    a.add(ha);
    b.add(hb);
    const undo = revealAll(a, b);
    expect([ha.visible, hb.visible]).toEqual([true, true]);
    undo();
    expect([ha.visible, hb.visible]).toEqual([false, false]);
  });
});

describe("a model's pictures sent ahead", () => {
  // a renderer that notes what it was asked to send
  const fake = (fail = false) => {
    const sent = [];
    return {
      sent,
      initTexture(t) {
        if (fail) throw new Error('context lost');
        sent.push(t.name);
      },
    };
  };
  const tex = (name, image = { width: 4, height: 4 }) => Object.assign(new THREE.Texture(image), { name });

  it('sends every texture a mesh under it uses, once', () => {
    const root = new THREE.Group();
    const shared = tex('shared');
    const a = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshStandardMaterial({ map: tex('colour'), normalMap: tex('normal') }));
    const b = new THREE.Mesh(new THREE.BoxGeometry(), [new THREE.MeshBasicMaterial({ map: shared }), new THREE.MeshBasicMaterial({ map: shared })]);
    const c = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.ShaderMaterial({ uniforms: { uMap: { value: tex('uniform') } } }));
    a.add(b);
    root.add(a, c);
    const r = fake();
    uploadTextures(r, root);
    expect(r.sent.sort()).toEqual(['colour', 'normal', 'shared', 'uniform']);
  });

  it("skips a picture that hasn't arrived yet", () => {
    const root = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshBasicMaterial({ map: tex('later', null) }));
    const r = fake();
    uploadTextures(r, root);
    expect(r.sent).toEqual([]);
  });

  it('never throws (it goes up on its first frame instead)', () => {
    const root = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshBasicMaterial({ map: tex('x') }));
    expect(() => uploadTextures(fake(true), root)).not.toThrow();
  });
});

describe('the pictures under a scene, listed', () => {
  it('lists each texture once, ready ones only, so they can go up a few at a time', () => {
    const shared = Object.assign(new THREE.Texture({ width: 4, height: 4 }), { name: 'shared' });
    const later = Object.assign(new THREE.Texture(null), { name: 'later' });
    const root = new THREE.Group();
    root.add(new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshBasicMaterial({ map: shared })));
    root.add(new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshBasicMaterial({ map: shared, alphaMap: later })));
    expect(texturesUnder(root).map((t) => t.name)).toEqual(['shared']);
  });
});
