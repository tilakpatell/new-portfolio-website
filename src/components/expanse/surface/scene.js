// What the Expanse surface draws, on the runtime's renderer: the cells'
// ground (lib/three/land.js over the land map), their water (river.js),
// the grass (grass.js, flattened by the tracks), the trees (puffs.js), the
// rocks and crates, the falling leaves, the wind lines, the wheel tracks,
// one sun with its shadow camera on the view's area, a two-colour sky that
// is also the house look's fog, and the buggy. The module (./module.js)
// says what comes and goes; this only builds and draws it.
//
// The land is in world metres inside one group placed at minus the floating
// origin, so an origin shift moves one transform; everything that follows
// the view (grass, leaves, wind lines, tracks, the camera) is in the
// scene's own frame and is shifted by `shift`.
//
// draw: the tracks into their target; on high and ultra the opaque frame
// into a half-size target (the water hidden) for the water's shallows; then
// the frame. lowerQuality drops the water's blur, then the shadows, then
// half the trees.
//
//   createScene({ renderer, spec, tier, radius }) → { scene, camera, view,
//     map, water, grass, puffs, tracks, buggy, land (the group), build(key,
//     cell, mesh, step), remesh(key, mesh), unbuild(key), crates, rocks,
//     setOrigin([x, y, z]), shift([sx, sy, sz]), follow(focus, speed, dt),
//     draw(), resize(w, h), lowerQuality(level), dispose() }

import * as THREE from 'three';
import { houseOn } from '../../../lib/three/house.js';
import { pool } from '../../../lib/three/pool.js';
import { createLandMap } from '../../../lib/three/landmap.js';
import { createLandMaterial } from '../../../lib/three/land.js';
import { createWaterSurface } from '../../../lib/three/river.js';
import { createGrass } from '../../../lib/three/grass.js';
import { createWind } from '../../../lib/three/wind.js';
import { createTracks } from '../../../lib/three/tracks.js';
import { createPuffs } from '../../../lib/three/puffs.js';
import { createLeaves } from '../../../lib/three/leaves.js';
import { createWindLines } from '../../../lib/three/windLines.js';
import { createChaseView } from '../../../lib/three/view.js';
import { createBuggy } from './buggy.js';

const CELL = 64;
const GRASS = { ultra: 280, high: 220, mid: 160, low: 110 };
const LEAVES = { ultra: 512, high: 256, mid: 128, low: 64 };
const SHADOW = { ultra: 2048, high: 2048, mid: 1024, low: 0 };
const TREES = { ultra: 1600, high: 1200, mid: 700, low: 400 };
const KIT = 2400; // rock and crate slots each
const VIEW = 22; // the camera's orbit, standing

const hex = (c) => new THREE.Color(c[0], c[1], c[2]);

export function createScene({ renderer, spec, tier = 'high', radius = 6, small = false }) {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(25, 16 / 9, 0.5, 4000);
  const p = spec.palette;
  // the sky: the haze at the horizon and the blue overhead (the fog is the sky)
  const skyLow = new THREE.Color(0xf3e3c3);
  const skyHigh = new THREE.Color(0x5d9be0);
  scene.background = skyLow.clone();
  scene.fog = new THREE.Fog(skyLow.getHex(), 60, 400);

  const sunDir = new THREE.Vector3().setFromSphericalCoords(1, Math.PI / 2 - spec.sun.elevation, spec.sun.azimuth);
  const sun = new THREE.DirectionalLight(hex(spec.sun.colour), 2.6);
  const hemi = new THREE.HemisphereLight(skyHigh.getHex(), 0x6b5a3a, 1.1);
  scene.add(sun, sun.target, hemi);
  const shadowSize = SHADOW[tier] ?? 0;
  if (shadowSize) {
    sun.castShadow = true;
    sun.shadow.mapSize.set(shadowSize, shadowSize);
    sun.shadow.bias = -0.0005;
    sun.shadow.normalBias = 0.04;
  }

  const wind = createWind({ strength: spec.wind.strength, angle: spec.wind.angle });
  const map = createLandMap({ radius, palette: p, sea: spec.sea });
  const tracks = createTracks();
  const landMaterial = createLandMaterial({ map, tracks });
  const water = createWaterSurface({ map, wind, tier });
  // (his orbit runs 15 to 30 m: at 15 the buggy fills the screen, so a little out)
  const view = createChaseView({ camera, small, tier, radius: VIEW });
  const grass = createGrass({ ground: map.ground, wind, tracks, side: GRASS[tier] ?? 160, size: Math.round(view.area.radius * 2) });
  const puffs = createPuffs({ species: { a: 0xb4b536, b: 0xd8cf3b, bark: 0x6b4a32 }, count: TREES[tier] ?? 700, wind, facing: camera.position.clone().setFromSphericalCoords(1, 0.31 * Math.PI, Math.PI / 4).toArray(), sun: sunDir.toArray() });
  const rocks = pool(new THREE.IcosahedronGeometry(1, 0), new THREE.MeshLambertMaterial({ color: hex(p.rock) }), KIT, 'rocks');
  const crates = pool(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshLambertMaterial({ color: 0xb98a4e }), KIT, 'crates');
  const buggy = createBuggy({ palette: { body: 0xd8572a, cab: 0xf2e6c9, dark: 0x2a2a2a } });

  // the land, in world metres, at minus the origin
  const land = new THREE.Group();
  land.name = 'land';
  land.add(water.group, puffs.crowns, puffs.trunks, rocks.mesh, crates.mesh);
  const groundMeshes = new Map();
  scene.add(land, grass.mesh, buggy.group);
  // (the leaves' floor is the module's to give: the cells are its)
  let floorAt = () => ({ y: 0, water: false });
  const leaves = createLeaves({ count: LEAVES[tier] ?? 128, wind, floorAt: (x, z) => floorAt(x, z) });
  const lines = createWindLines({ wind });
  scene.add(leaves.mesh, lines.group);

  // the house look over everything, the cells' shared material included
  const stand = new THREE.Mesh(new THREE.BufferGeometry(), landMaterial);
  stand.visible = false;
  land.add(stand);
  const was = { toneMapping: renderer.toneMapping, exposure: renderer.toneMappingExposure, shadows: renderer.shadowMap?.enabled, type: renderer.shadowMap?.type };
  if (renderer.shadowMap) {
    renderer.shadowMap.enabled = Boolean(shadowSize);
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  }
  const house = houseOn({ renderer, scene, sun, hemi, look: { fogLow: skyLow.getHex(), fogHigh: skyHigh.getHex() } });
  // (the water's own see-through and the trees' cut-outs keep three's light: the look is for the opaque)

  // the opaque frame, half size, for the water's shallows on high and ultra
  let opaque = water.blur ? new THREE.WebGLRenderTarget(2, 2, { type: THREE.HalfFloatType }) : null;
  let blur = water.blur;
  let origin = [0, 0, 0];

  function geometryOf(mesh) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(mesh.positions, 3));
    g.setAttribute('normal', new THREE.BufferAttribute(mesh.normals, 3));
    g.setIndex(new THREE.BufferAttribute(mesh.indices, 1));
    g.computeBoundingSphere();
    return g;
  }

  const api = {
    scene,
    camera,
    view,
    map,
    water,
    grass,
    puffs,
    tracks,
    buggy,
    land,
    rocks,
    crates,
    wind,
    leaves,
    lines,
    house,
    sun,
    build(key, cell, mesh) {
      const g = new THREE.Mesh(geometryOf(mesh), landMaterial);
      g.position.set(cell.cx * CELL, 0, cell.cz * CELL);
      g.receiveShadow = true;
      g.name = `cell ${key}`;
      land.add(g);
      groundMeshes.set(key, g);
      map.set(cell.cx, cell.cz, cell);
      water.set(cell.cx, cell.cz, cell);
    },
    remesh(key, mesh) {
      const g = groundMeshes.get(key);
      if (!g) return;
      g.geometry.dispose();
      g.geometry = geometryOf(mesh);
    },
    unbuild(key, cell) {
      const g = groundMeshes.get(key);
      if (g) {
        land.remove(g);
        g.geometry.dispose();
        groundMeshes.delete(key);
      }
      if (cell) {
        map.drop(cell.cx, cell.cz);
        water.drop(cell.cx, cell.cz);
      }
    },
    cells: () => groundMeshes.size,
    setOrigin(at) {
      origin = at.slice();
      land.position.set(-origin[0], -origin[1], -origin[2]);
      map.offset(origin[0], origin[2]);
    },
    // a floating-origin shift: what follows the view moves with it
    shift([sx, , sz]) {
      api.setOrigin([origin[0] + sx, origin[1], origin[2] + sz]);
      view.shift(sx, sz);
      leaves.shift(sx, sz);
      lines.shift(sx, sz);
    },
    setFloor(fn) {
      floorAt = fn;
    },
    // a frame's following: the camera, the sun's shadow box, the fog, the
    // grass's patch and the map's window
    follow(focus, speed, dt, car = null) {
      view.update(dt, focus, speed);
      wind.update(dt);
      const [ax, az] = view.area.centre;
      const r = view.area.radius;
      grass.update({ x: ax, z: az });
      sun.position.set(ax + sunDir.x * 80, sunDir.y * 80 + focus.y, az + sunDir.z * 80);
      sun.target.position.set(ax, focus.y, az);
      if (sun.castShadow) {
        const c = sun.shadow.camera;
        c.left = c.bottom = -r;
        c.right = c.top = r;
        c.near = 1;
        c.far = 240;
        c.updateProjectionMatrix();
      }
      const near = view.area.near;
      const far = view.area.far;
      scene.fog.near = near + 0.315 * (far - near) + 60;
      scene.fog.far = near + 1.25 * (far - near) + 300;
      leaves.update(dt, { x: focus.x, z: focus.z }, car);
      lines.update(dt, { x: focus.x, z: focus.z });
      house.follow();
    },
    draw() {
      tracks.render(renderer, { x: view.focus.x, z: view.focus.z });
      if (blur && opaque) {
        const size = renderer.getDrawingBufferSize?.(new THREE.Vector2()) ?? new THREE.Vector2(2, 2);
        const w = Math.max(2, Math.floor(size.x / 2));
        const h = Math.max(2, Math.floor(size.y / 2));
        if (opaque.width !== w || opaque.height !== h) opaque.setSize(w, h);
        water.group.visible = false;
        renderer.setRenderTarget(opaque);
        renderer.render(scene, camera);
        renderer.setRenderTarget(null);
        water.group.visible = true;
        water.setOpaque(opaque.texture, size.x, size.y);
      }
      renderer.render(scene, camera);
    },
    resize(w, h) {
      view.resize(w, h);
    },
    // drop the water's blur, then the shadows, then half the trees
    lowerQuality(level) {
      if (level >= 1 && blur) {
        blur = false;
        water.setOpaque(null);
      }
      if (level >= 2 && sun.castShadow) sun.castShadow = false;
      if (level >= 3) puffs.crowns.count = Math.ceil(puffs.crowns.instanceMatrix.count / 2);
    },
    dispose() {
      for (const key of [...groundMeshes.keys()]) api.unbuild(key);
      stand.geometry.dispose();
      landMaterial.dispose();
      water.dispose();
      grass.dispose();
      puffs.dispose();
      rocks.dispose();
      crates.dispose();
      buggy.dispose();
      leaves.dispose();
      lines.dispose();
      tracks.dispose();
      map.dispose();
      wind.dispose();
      opaque?.dispose();
      opaque = null;
      sun.shadow.map?.dispose();
      // (the renderer as it was: the next world has it)
      renderer.toneMapping = was.toneMapping;
      renderer.toneMappingExposure = was.exposure;
      if (renderer.shadowMap) {
        renderer.shadowMap.enabled = was.shadows;
        renderer.shadowMap.type = was.type;
      }
    },
  };
  return api;
}
