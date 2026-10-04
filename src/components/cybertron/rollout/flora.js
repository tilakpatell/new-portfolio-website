// Dry grass in tufts by the road: thin curved blades, darker at the root,
// bleached at the tip, swaying in the wind. Thousands of them as one
// instanced mesh; each fades in by growing out of the ground as you come up
// on it, so the far edge never pops.

import * as THREE from 'three';

function rng(seed) {
  let a = seed >>> 0 || 1;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), a | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// One tuft: blades fanning out from a point, each a tapered strip of three
// segments curving outward. aH is how far up the blade a vertex is (0 at the
// root), for the wind and the colour.
export function tuftGeometry({ blades = 14, height = 0.62, width = 0.045, seed = 7 } = {}) {
  const r = rng(seed);
  const pos = [];
  const nor = [];
  const hgt = [];
  const idx = [];
  const SEG = 3;
  for (let b = 0; b < blades; b++) {
    const a = (b / blades) * Math.PI * 2 + r() * 0.6;
    const lean = 0.25 + r() * 0.75;
    const h = height * (0.55 + r() * 0.6);
    const w = width * (0.7 + r() * 0.6);
    const dx = Math.cos(a);
    const dz = Math.sin(a);
    // the blade's face turns to the side of its lean
    const sx = -dz;
    const sz = dx;
    const base = pos.length / 3;
    const ox = (r() - 0.5) * 0.12;
    const oz = (r() - 0.5) * 0.12;
    for (let k = 0; k <= SEG; k++) {
      const t = k / SEG;
      const out = lean * h * t ** 1.7 * 0.6;
      const y = h * t * (1 - 0.25 * lean * t);
      const half = (w / 2) * (1 - t) ** 0.85;
      const cx = ox + dx * out;
      const cz = oz + dz * out;
      // normals lean up, so a tuft lights softly rather than blade by blade
      const nx = dx * 0.35;
      const nz = dz * 0.35;
      if (k < SEG) {
        pos.push(cx - sx * half, y, cz - sz * half, cx + sx * half, y, cz + sz * half);
        nor.push(nx, 1, nz, nx, 1, nz);
        hgt.push(t, t);
      } else {
        pos.push(cx, y, cz);
        nor.push(nx, 1, nz);
        hgt.push(1);
      }
    }
    for (let k = 0; k < SEG - 1; k++) {
      const v = base + k * 2;
      idx.push(v, v + 1, v + 2, v + 1, v + 3, v + 2);
    }
    const v = base + (SEG - 1) * 2;
    idx.push(v, v + 1, v + 2);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  geo.setAttribute('aH', new THREE.Float32BufferAttribute(hgt, 1));
  geo.setIndex(idx);
  geo.normalizeNormals();
  return geo;
}

// root and tip colours; each tuft is tinted on top (instance colour)
export function tuftMaterial({ root = 0x4a3a24, tip = 0xd9c08a, fadeFrom = 95, fadeTo = 130 } = {}) {
  const mat = new THREE.MeshStandardMaterial({ roughness: 0.92, metalness: 0, side: THREE.DoubleSide, envMapIntensity: 0.5 });
  const uniforms = {
    uTime: { value: 0 },
    uRoot: { value: new THREE.Color(root) },
    uTip: { value: new THREE.Color(tip) },
    uFade: { value: new THREE.Vector2(fadeFrom, fadeTo) },
  };
  mat.userData.uniforms = uniforms;
  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float aH;\nvarying float vH;\nuniform float uTime;\nuniform vec2 uFade;')
      .replace(
        '#include <begin_vertex>',
        `vec3 transformed = vec3(position);
        vH = aH;
        {
          vec3 root = (modelMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
          float d = distance(root, cameraPosition);
          float grow = 1.0 - smoothstep(uFade.x, uFade.y, d);
          // wind: a slow sway, gusts rolling across, a flutter at the tips
          float gust = sin(uTime * 0.9 + root.x * 0.05 - root.z * 0.08) * 0.5 + 0.5;
          float sway = sin(uTime * 2.1 + root.x * 0.37 + root.z * 0.23) * (0.05 + 0.1 * gust) + sin(uTime * 7.3 + root.z * 1.7 + position.x * 9.0) * 0.012;
          float bend = aH * aH;
          transformed.x += sway * bend;
          transformed.z += sway * bend * 0.6;
          transformed.y -= abs(sway) * bend * 0.3;
          transformed *= grow;
        }`,
      );
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying float vH;\nuniform vec3 uRoot, uTip;')
      .replace('#include <color_fragment>', '#include <color_fragment>\ndiffuseColor.rgb *= mix(uRoot, uTip, smoothstep(0.0, 0.85, vH));')
      .replace('#include <aomap_fragment>', '#include <aomap_fragment>\nreflectedLight.indirectDiffuse *= mix(0.35, 1.0, vH);\nreflectedLight.directDiffuse *= mix(0.55, 1.0, vH);');
  };
  mat.customProgramCacheKey = () => 'tuft';
  return mat;
}
