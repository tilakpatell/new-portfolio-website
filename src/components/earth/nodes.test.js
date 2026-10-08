import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { airMaterial, beamMaterial, classicOutput, cloudMaterial, globeMaterial, skyMaterial, trailMaterial } from './nodes';

// TSL builds without a GPU: what's checked is that each material is a node
// material with the GLSL original's flags, and that its uniforms are there
// under the names scene.js writes every frame (each `u.x.value` as it was
// `uniforms.x.value`)
const blank = new THREE.DataTexture(new Uint8Array([0, 0, 0, 255]), 1, 1);
const flat = new THREE.DataTexture(new Uint8Array([128, 128, 128, 255]), 1, 1);
const sunDir = new THREE.Vector3(0, 0, 1);
const keys = (u) => Object.keys(u).sort();

describe('earth nodes', () => {
  it('the globe: opaque, front side, and every uniform globeU had', () => {
    const { material, u } = globeMaterial({ blank, flat, sunDir });
    expect(material.isNodeMaterial).toBe(true);
    expect(material).toMatchObject({ transparent: false, side: THREE.FrontSide, depthWrite: true, toneMapped: true });
    expect(keys(u)).toEqual(['tClouds', 'tDay', 'tNight', 'tRelief', 'tWater', 'uCloud', 'uHasNight', 'uRelief', 'uSun']);
    expect(u.tDay.value).toBe(blank);
    expect(u.tRelief.value).toBe(flat);
    expect(u.uSun.value).toBe(sunDir); // (the scene moves the one vector)
    expect(u.uRelief.value).toBe(0.55);
    expect(u.uHasNight.value).toBe(0);
    const day = new THREE.Texture();
    u.tDay.value = day;
    expect(u.tDay.value).toBe(day);
    u.uCloud.value = 0.25;
    expect(u.uCloud.value).toBe(0.25);
  });

  it('the clouds: see-through, both sides, no depth written, the drift shared with the globe', () => {
    const globe = globeMaterial({ blank, flat, sunDir });
    const { material, u } = cloudMaterial({ blank, sunDir, uCloud: globe.u.uCloud });
    expect(material.isNodeMaterial).toBe(true);
    expect(material).toMatchObject({ transparent: true, depthWrite: false, side: THREE.DoubleSide, toneMapped: true });
    expect(keys(u)).toEqual(['tClouds', 'uCloud', 'uSun']);
    expect(u.uCloud).toBe(globe.u.uCloud);
    expect(u.uSun.value).toBe(sunDir);
  });

  it('the air: the inside of its sphere, added on, no depth written', () => {
    const { material, u } = airMaterial({ sunDir });
    expect(material).toMatchObject({ isNodeMaterial: true, side: THREE.BackSide, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: true });
    expect(keys(u)).toEqual(['uSun']);
    expect(u.uSun.value).toBe(sunDir);
  });

  it('a beacon: added on, both sides, its colour and opacity, not tone mapped (the GLSL never was)', () => {
    const { material, u } = beamMaterial('#5cb8ff');
    expect(material).toMatchObject({ isNodeMaterial: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, toneMapped: false });
    expect(keys(u)).toEqual(['uColor', 'uOpacity']);
    expect(u.uColor.value.equals(new THREE.Color('#5cb8ff'))).toBe(true);
    u.uColor.value.copy(new THREE.Color('#ffd27a'));
    u.uOpacity.value = 0.4;
    expect(u.uOpacity.value).toBe(0.4);
  });

  it('a contrail: see-through, both sides, its light, not tone mapped', () => {
    const { material, u } = trailMaterial();
    expect(material).toMatchObject({ isNodeMaterial: true, transparent: true, depthWrite: false, side: THREE.DoubleSide, toneMapped: false, blending: THREE.NormalBlending });
    expect(keys(u)).toEqual(['uLight']);
    expect(u.uLight.value).toBe(1);
    u.uLight.value = 0.5;
    expect(u.uLight.value).toBe(0.5);
  });

  it('the stars: the inside of a sphere round the camera, behind everything, not tone mapped (as three draws an sRGB background)', () => {
    const { material, u } = skyMaterial(blank);
    expect(material).toMatchObject({ isNodeMaterial: true, side: THREE.BackSide, depthWrite: false, depthTest: false, toneMapped: false, fog: false });
    expect(keys(u)).toEqual(['tSky', 'uIntensity']);
    expect(u.tSky.value).toBe(blank);
    u.uIntensity.value = 0.32;
    expect(u.uIntensity.value).toBe(0.32);
  });

  it('every material of its own writes the classic renderer’s output: tone mapped where it was, sRGB-encoded always', () => {
    const globe = globeMaterial({ blank, flat, sunDir });
    for (const { material } of [globe, cloudMaterial({ blank, sunDir, uCloud: globe.u.uCloud }), airMaterial({ sunDir }), beamMaterial('#fff'), trailMaterial(), skyMaterial(blank)]) {
      expect(material.outputNode?.isNode).toBe(true);
    }
  });

  it('classicOutput gives a three material the same output once, and keeps its toneMapped', () => {
    const lit = new THREE.SpriteMaterial();
    const plain = new THREE.MeshBasicMaterial({ toneMapped: false });
    expect(classicOutput(lit)).toBe(true);
    const node = lit.outputNode;
    expect(node?.isNode).toBe(true);
    expect(classicOutput(lit)).toBe(false); // (once: a material changed would be built again every frame)
    expect(lit.outputNode).toBe(node);
    classicOutput(plain);
    expect(plain.outputNode?.isNode).toBe(true);
    expect(plain.outputNode).not.toBe(node);
  });

  it('every material builds its graph (the colour node is there, so a typo throws here, not on a frame)', () => {
    const globe = globeMaterial({ blank, flat, sunDir });
    for (const { material } of [globe, cloudMaterial({ blank, sunDir, uCloud: globe.u.uCloud }), airMaterial({ sunDir }), beamMaterial('#fff'), trailMaterial(), skyMaterial(blank)]) {
      expect(material.colorNode?.isNode).toBe(true);
    }
  });
});
