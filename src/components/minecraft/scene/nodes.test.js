import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { blockMaterial, cloudMaterial, crackMaterial, domeMaterial, dropMaterial, setFrames, spriteMaterial, starsMaterial } from './nodes.js';

// TSL builds without a GPU: what's checked is that each material is a node
// material with its GLSL original's flags, and that its uniforms are there
// under the names the scene writes every frame (`m.u.x.value`, as it was
// `m.uniforms.x.value`)
const array = () => {
  const t = new THREE.DataArrayTexture(new Uint8Array(4 * 4), 1, 1, 4);
  t.colorSpace = THREE.NoColorSpace;
  return t;
};
const plain = () => new THREE.DataTexture(new Uint8Array(4), 1, 1);
const keys = (u) => Object.keys(u).sort();

describe('minecraft nodes, the blocks', () => {
  it('each pass with the GLSL’s flags: opaque front-sided, cutout and water both sides, water seen through', () => {
    const opaque = blockMaterial({ array: array(), pass: 'opaque' });
    const cutout = blockMaterial({ array: array(), pass: 'cutout' });
    const water = blockMaterial({ array: array(), pass: 'water' });
    for (const m of [opaque, cutout, water]) expect(m.isNodeMaterial).toBe(true);
    expect(opaque).toMatchObject({ side: THREE.FrontSide, transparent: false, depthWrite: true });
    expect(cutout).toMatchObject({ side: THREE.DoubleSide, transparent: false, depthWrite: true });
    expect(water).toMatchObject({ side: THREE.DoubleSide, transparent: true, depthWrite: false });
  });

  it('its uniforms under the names the scene writes, the atlas as given and its colour space left alone', () => {
    const a = array();
    const m = blockMaterial({ array: a, pass: 'opaque' });
    expect(keys(m.u)).toEqual(['anim', 'atlas', 'fogColour', 'fogFar', 'fogNear', 'sun', 'tints']);
    expect(m.u.atlas.value).toBe(a);
    expect(a.colorSpace).toBe(THREE.NoColorSpace); // (the arithmetic is on the bytes as painted)
    expect(m.u.sun.value).toBe(1);
    expect([m.u.fogNear.value, m.u.fogFar.value]).toEqual([100, 160]);
    m.u.fogColour.value.set(0.1, 0.2, 0.3);
    expect(m.u.fogColour.value.toArray()).toEqual([0.1, 0.2, 0.3]);
    expect(m.u.anim.array).toHaveLength(4);
    expect(m.u.anim.array[0].toArray()).toEqual([-1, 0, 0, 0]); // (a strip slot unused)
  });

  it('the tints: white, the pack’s greens when given, water, birch and spruce, in the mesher’s order', () => {
    const m = blockMaterial({ array: array(), pass: 'opaque', colours: { grass: [0, 255, 0] } });
    const t = m.u.tints.array.map((v) => v.toArray().slice(0, 3).map((x) => Math.round(x * 255)));
    expect(t).toEqual([[255, 255, 255], [0, 255, 0], [0x77, 0xab, 0x2f], [0x3f, 0x76, 0xe4], [0x80, 0xa7, 0x55], [0x61, 0x99, 0x61]]);
  });

  it('setFrames writes a strip’s layer, the frame showing, the next and the blend into its slot', () => {
    const m = blockMaterial({ array: array(), pass: 'water' });
    // (a four-frame strip at layer 7, its other frames from layer 20, two ticks a frame, blended)
    setFrames(m, [{ layer: 7, extra: 20, frames: 4, time: 2, interpolate: true }], 3);
    expect(m.u.anim.array[0].toArray()).toEqual([7, 20, 21, 0.5]);
    expect(m.u.anim.array[1].x).toBe(-1);
  });
});

describe('minecraft nodes, the sky, the drops and the crack', () => {
  it('the dome: inside out, behind everything, its colours and the sun’s way', () => {
    const fog = new THREE.Vector3();
    const { material, u } = domeMaterial({ fog });
    expect(material).toMatchObject({ isNodeMaterial: true, side: THREE.BackSide, depthWrite: false, depthTest: false });
    expect(keys(u)).toEqual(['fog', 'glow', 'sky', 'sunDir']);
    expect(u.fog.value).toBe(fog); // (the scene moves the one vector)
  });

  it('the stars: points two pixels across, added on, behind everything, their brightness', () => {
    const { material, u } = starsMaterial();
    expect(material.isPointsNodeMaterial).toBe(true);
    expect(material).toMatchObject({ blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false, transparent: true, sizeAttenuation: false });
    expect(material.sizeNode?.isNode).toBe(true);
    expect(keys(u)).toEqual(['strength']);
    expect(u.strength.value).toBe(0);
  });

  it('a sun or the moon: added on, behind everything, its picture, its part of it and its brightness', () => {
    const map = plain();
    const { material, u } = spriteMaterial(map);
    expect(material).toMatchObject({ isNodeMaterial: true, blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false, transparent: true });
    expect(keys(u)).toEqual(['frame', 'map', 'strength']);
    expect(u.map.value).toBe(map);
    expect(u.frame.value.toArray()).toEqual([0, 0, 1, 1]);
    u.frame.value.set(0.25, 0.5, 0.25, 0.5);
    expect(u.frame.value.x).toBe(0.25);
  });

  it('the clouds: see-through, both sides, no depth written, the drift, the fog, the tint and how far', () => {
    const fog = new THREE.Vector3();
    const { material, u } = cloudMaterial({ map: plain(), fog });
    expect(material).toMatchObject({ isNodeMaterial: true, transparent: true, depthWrite: false, side: THREE.DoubleSide });
    expect(keys(u)).toEqual(['far', 'fog', 'map', 'offset', 'tint']);
    expect(u.fog.value).toBe(fog);
    expect(u.far.value).toBe(300);
  });

  it('a drop: both sides, the atlas as given', () => {
    const a = array();
    const m = dropMaterial(a);
    expect(m).toMatchObject({ isNodeMaterial: true, side: THREE.DoubleSide });
    expect(m.u.atlas.value).toBe(a);
  });

  it('the crack: the game’s multiply blend, no depth written, pulled towards the eye, its layer', () => {
    const { material, u } = crackMaterial({ array: array(), layer: 3 });
    expect(material).toMatchObject({
      isNodeMaterial: true,
      blending: THREE.CustomBlending,
      blendSrc: THREE.DstColorFactor,
      blendDst: THREE.SrcColorFactor,
      blendEquation: THREE.AddEquation,
      transparent: true,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
    });
    expect(keys(u)).toEqual(['atlas', 'layer']);
    expect(u.layer.value).toBe(3);
  });

  it('every material builds its colour node (so a typo throws here, not on a frame)', () => {
    const fog = new THREE.Vector3();
    const ms = [blockMaterial({ array: array(), pass: 'cutout' }), domeMaterial({ fog }).material, starsMaterial().material, spriteMaterial(plain()).material, cloudMaterial({ map: plain(), fog }).material, dropMaterial(array()), crackMaterial({ array: array(), layer: 0 }).material];
    for (const m of ms) expect(m.colorNode?.isNode).toBe(true);
  });
});
