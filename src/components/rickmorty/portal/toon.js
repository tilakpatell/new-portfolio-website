// The look of the show: flat colour in two or three steps of light, and a
// dark ink line round everything. The light comes from MeshToonMaterial with
// a stepped gradient; the line is a pass after the scene is drawn that finds
// edges in the depth and the normals (so it outlines the Kenney props as well
// as the cast, without the gaps an inverted hull leaves at hard edges).

import * as THREE from 'three';
import { Pass, FullScreenQuad } from 'three/examples/jsm/postprocessing/Pass.js';

let steps = null;
export function gradient() {
  if (steps) return steps;
  const d = new Uint8Array([90, 90, 90, 255, 170, 170, 170, 255, 255, 255, 255, 255]);
  steps = new THREE.DataTexture(d, 3, 1, THREE.RGBAFormat);
  steps.minFilter = steps.magFilter = THREE.NearestFilter;
  steps.generateMipmaps = false;
  steps.needsUpdate = true;
  return steps;
}

export const toon = (color, extra = {}) => new THREE.MeshToonMaterial({ color, gradientMap: gradient(), ...extra });

// A Kenney model's materials, in toon: same colours and palette texture,
// optionally tinted (Cronenberg World's flesh, Gazorpazorp's rock).
// `gradientMap` swaps the light steps (a textured model whose paint carries
// its own shading wants gentler ones), `aniso` sharpens its textures, and
// `dispose` frees the materials it replaces.
export function toonify(root, { tint = null, mix = 0.6, glow = null, gradientMap = null, aniso = 0, dispose = false } = {}) {
  const made = new Map();
  root.traverse((o) => {
    if (!o.isMesh) return;
    const conv = (m) => {
      if (made.has(m)) return made.get(m);
      const c = (m.color ?? new THREE.Color(1, 1, 1)).clone();
      if (tint) c.lerp(new THREE.Color(tint), mix);
      const t = toon(c, { map: m.map ?? null, ...(gradientMap ? { gradientMap } : {}) });
      if (aniso && m.map) m.map.anisotropy = aniso;
      if (dispose) m.dispose();
      if (glow && /light|glass|screen|window/i.test(m.name ?? '')) {
        t.emissive = new THREE.Color(glow);
        t.emissiveIntensity = 1.6;
      }
      made.set(m, t);
      return t;
    };
    o.material = Array.isArray(o.material) ? o.material.map(conv) : conv(o.material);
    o.castShadow = true;
    o.receiveShadow = true;
  });
  return root;
}

// Kenney's greens run from mint to teal. releaf gives one of them (a
// material's colour) another leaf colour at its own brightness, and
// releafMap the green swatches of a palette texture, so a dimension can
// green, or sicken, its plants.
const LEAF_LUM = 0.75; // a Kenney leaf green's brightness
const lum = (r, g, b) => 0.2126 * r + 0.7152 * g + 0.0722 * b;

// (r, g, b), sRGB in 0…1: one of those greens, by hue?
function leafy(r, g, b) {
  const max = Math.max(r, g, b);
  const chroma = max - Math.min(r, g, b);
  if (chroma < 0.12 || g < r) return false;
  const hue = max === g ? 120 + (60 * (b - r)) / chroma : 240 + (60 * (r - g)) / chroma;
  return hue > 75 && hue < 195;
}
const brightness = (r, g, b) => Math.min(1.25, Math.max(0.45, lum(r, g, b) / LEAF_LUM));

const rgb = { r: 0, g: 0, b: 0 };
const to = { r: 0, g: 0, b: 0 };
export function releaf(color, leaf) {
  color.getRGB(rgb, THREE.SRGBColorSpace);
  if (!leafy(rgb.r, rgb.g, rgb.b)) return color;
  new THREE.Color(leaf).getRGB(to, THREE.SRGBColorSpace);
  const k = brightness(rgb.r, rgb.g, rgb.b);
  return color.setRGB(Math.min(1, to.r * k), Math.min(1, to.g * k), Math.min(1, to.b * k), THREE.SRGBColorSpace);
}

// a new texture (the caller disposes it); the original if it can't be read
export function releafMap(map, leaf) {
  const img = map?.image;
  if (!img?.width) return map;
  const c = document.createElement('canvas');
  c.width = img.width;
  c.height = img.height;
  const x = c.getContext('2d', { willReadFrequently: true });
  x.drawImage(img, 0, 0);
  const px = x.getImageData(0, 0, c.width, c.height);
  const d = px.data;
  new THREE.Color(leaf).getRGB(to, THREE.SRGBColorSpace);
  for (let i = 0; i < d.length; i += 4) {
    const r = d[i] / 255;
    const g = d[i + 1] / 255;
    const b = d[i + 2] / 255;
    if (!leafy(r, g, b)) continue;
    const k = brightness(r, g, b) * 255;
    d[i] = Math.min(255, to.r * k);
    d[i + 1] = Math.min(255, to.g * k);
    d[i + 2] = Math.min(255, to.b * k);
  }
  x.putImageData(px, 0, 0);
  const t = map.clone(); // keeps its flip, colour space, filters and wrap
  t.source = new THREE.Source(c);
  t.needsUpdate = true;
  return t;
}

// The ink: draws the scene once more as normals and depth, then darkens the
// picture where either jumps. `hide` lists what has no line (the sky, glows,
// decals on the ground). `fade` [near, far] thins the line out between those
// distances (in the scene's units) and leaves none beyond, as a cartoon draws
// its backgrounds (and so no line along a far horizon); without it, it never does.
export class InkPass extends Pass {
  constructor(scene, camera, { hide = () => [], color = 0x14101a, width = 1, fade = null } = {}) {
    super();
    this.scene = scene;
    this.camera = camera;
    this.hide = hide;
    this.normals = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, depthTexture: new THREE.DepthTexture(1, 1, THREE.UnsignedIntType) });
    this.normalMat = new THREE.MeshNormalMaterial();
    this.quad = new FullScreenQuad(
      new THREE.ShaderMaterial({
        uniforms: {
          tDiffuse: { value: null },
          tNormal: { value: this.normals.texture },
          tDepth: { value: this.normals.depthTexture },
          px: { value: new THREE.Vector2(1, 1) },
          near: { value: camera.near },
          far: { value: camera.far },
          ink: { value: new THREE.Color(color) },
          width: { value: width },
          fade: { value: new THREE.Vector2(...(fade ?? [0, 0])) },
        },
        vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
        fragmentShader: `
          #include <packing>
          uniform sampler2D tDiffuse, tNormal, tDepth;
          uniform vec2 px;
          uniform float near, far, width;
          uniform vec2 fade;
          uniform vec3 ink;
          varying vec2 vUv;
          float invz(vec2 uv) {
            float d = texture2D(tDepth, uv).x;
            if (d >= 1.0) return 0.0;
            return 1.0 / -perspectiveDepthToViewZ(d, near, far);
          }
          vec3 nrm(vec2 uv) { return texture2D(tNormal, uv).xyz * 2.0 - 1.0; }
          void main() {
            vec4 c = texture2D(tDiffuse, vUv);
            vec2 o = px * width;
            // depth: 1/z is flat across a plane, so its second difference
            // is only big where one surface steps in front of another
            float zc = invz(vUv);
            float zl = invz(vUv - vec2(o.x, 0.0)), zr = invz(vUv + vec2(o.x, 0.0));
            float zd = invz(vUv - vec2(0.0, o.y)), zu = invz(vUv + vec2(0.0, o.y));
            float lap = abs(zl + zr - 2.0 * zc) + abs(zd + zu - 2.0 * zc);
            float edgeZ = smoothstep(0.08, 0.2, lap / max(max(zc, max(max(zl, zr), max(zd, zu))), 1e-4));
            // creases: neighbours facing different ways
            vec3 nc = nrm(vUv);
            float crease = 0.0;
            if (zc > 0.0) {
              float k = min(min(dot(nc, nrm(vUv + vec2(o.x, 0.0))), dot(nc, nrm(vUv - vec2(o.x, 0.0)))), min(dot(nc, nrm(vUv + vec2(0.0, o.y))), dot(nc, nrm(vUv - vec2(0.0, o.y)))));
              crease = smoothstep(0.75, 0.45, k);
            }
            float e = max(edgeZ, crease * 0.85);
            // thinner with distance, from the nearest of the five samples
            if (fade.y > 0.0) {
              float nz = max(max(zc, max(zl, zr)), max(zd, zu));
              e *= 1.0 - smoothstep(fade.x, fade.y, nz > 0.0 ? 1.0 / nz : fade.y);
            }
            gl_FragColor = vec4(mix(c.rgb, ink, e * 0.92), c.a);
          }`,
      }),
    );
  }

  setSize(w, h) {
    this.normals.setSize(w, h);
    this.quad.material.uniforms.px.value.set(1 / w, 1 / h);
  }

  render(renderer, writeBuffer, readBuffer) {
    const hidden = this.hide().filter((o) => o?.visible);
    for (const o of hidden) o.visible = false;
    const { background, overrideMaterial, fog } = this.scene;
    this.scene.background = null;
    this.scene.fog = null;
    this.scene.overrideMaterial = this.normalMat;
    const auto = renderer.shadowMap.autoUpdate;
    renderer.shadowMap.autoUpdate = false;
    const clear = renderer.getClearColor(new THREE.Color());
    const alpha = renderer.getClearAlpha();
    renderer.setClearColor(0x7f7fff, 1);
    renderer.setRenderTarget(this.normals);
    renderer.clear();
    renderer.render(this.scene, this.camera);
    renderer.setClearColor(clear, alpha);
    renderer.shadowMap.autoUpdate = auto;
    this.scene.overrideMaterial = overrideMaterial;
    this.scene.background = background;
    this.scene.fog = fog;
    for (const o of hidden) o.visible = true;
    const u = this.quad.material.uniforms;
    u.tDiffuse.value = readBuffer.texture;
    u.near.value = this.camera.near;
    u.far.value = this.camera.far;
    renderer.setRenderTarget(this.renderToScreen ? null : writeBuffer);
    this.quad.render(renderer);
  }

  dispose() {
    this.normals.dispose();
    this.normalMat.dispose();
    this.quad.material.dispose();
    this.quad.dispose();
  }
}
