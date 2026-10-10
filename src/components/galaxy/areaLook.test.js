import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';
import { STORM, createAreaLook } from './areaLook';
import { lookOf } from './levelArea';
import { LIGHTS } from '../../data/bf2017/light';

const flush = () => new Promise((r) => setTimeout(r, 0));

describe('the storm’s look, from the game’s light record', () => {
  it('reads Kamino’s: the storm sun where the record puts it, its sky, its probe, its grade, its wind', () => {
    const look = lookOf(LIGHTS.kamino);
    // (the record's sun: 327° round, 33° up)
    expect(look.sun.dir[1]).toBeCloseTo(Math.sin((33.158 * Math.PI) / 180), 3);
    expect(look.probe).toBe('textures/galaxy/bf2017/light/kamino/stormy');
    expect(look.lut).toEqual({ url: 'textures/galaxy/bf2017/light/kamino/stormy.lut.png', size: 17 });
    expect(look.wind.strength).toBe(5);
    expect(look.sky).toMatch(/^#[0-9a-f]{6}$/);
  });
});

describe('the scene under an area’s light while you’re inside it', () => {
  const make = () => {
    const scene = new THREE.Scene();
    const keys = [new THREE.DirectionalLight('#ffffff', 2.2), new THREE.DirectionalLight('#ffffff', 0)];
    keys[0].position.set(100, 0, 0);
    const ambient = new THREE.AmbientLight('#9fb0d8', 0.32);
    const space = new THREE.Texture();
    scene.environment = space;
    const probe = new THREE.Texture();
    const post = { grading: vi.fn() };
    const look = createAreaLook({ scene, post, keys, ambient, url: (p) => `https://cdn${p}`, probes: { load: vi.fn(async () => probe) }, lut: vi.fn(async () => 'lut') });
    const group = new THREE.Group();
    group.position.set(10, 0, 0);
    const area = { look: lookOf(LIGHTS.kamino), flash: 0, strikeAt: [0, 0, 5], group };
    return { scene, keys, ambient, space, probe, post, look, area };
  };

  it('turns the galaxy’s own lights to the storm’s, its probe and grade on, and puts everything back on leaving', async () => {
    const k = make();
    const camera = { position: new THREE.Vector3(10, 0, 0) };
    k.look.apply(k.area, camera);
    await flush();
    expect(k.keys[0].intensity).toBe(STORM.sun);
    expect(k.keys[0].position.y).toBeGreaterThan(50);
    expect(k.ambient.intensity).toBe(STORM.ambient);
    expect(k.scene.environment).toBe(k.probe);
    expect(k.post.grading).toHaveBeenCalledWith({ lut: 'lut', size: 17 });
    // a strike: the second key from where it struck, as bright as the flash
    k.area.flash = 1;
    k.look.apply(k.area, camera);
    expect(k.keys[1].intensity).toBe(STORM.flash);
    expect(k.keys[1].position.z).toBeCloseTo(100, 5);
    // out of the area: the galaxy's light as it was
    k.look.apply(null, camera);
    expect(k.keys[0].intensity).toBe(2.2);
    expect(k.keys[0].position.x).toBe(100);
    expect(k.keys[1].intensity).toBe(0);
    expect(k.ambient.intensity).toBe(0.32);
    expect(k.scene.environment).toBe(k.space);
    expect(k.post.grading).toHaveBeenLastCalledWith(null);
    expect(k.look.on).toBe(false);
  });
});
