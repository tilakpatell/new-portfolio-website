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
export function toonify(root, { tint = null, mix = 0.6, glow = null } = {}) {
  const made = new Map();
  root.traverse((o) => {
    if (!o.isMesh) return;
    const conv = (m) => {
      if (made.has(m)) return made.get(m);
      const c = (m.color ?? new THREE.Color(1, 1, 1)).clone();
      if (tint) c.lerp(new THREE.Color(tint), mix);
      const t = toon(c, { map: m.map ?? null });
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

// The ink: draws the scene once more as normals and depth, then darkens the
// picture where either jumps. `hide` lists what has no line (the sky, glows,
// decals on the ground).
export class InkPass extends Pass {
  constructor(scene, camera, { hide = () => [], color = 0x14101a, width = 1 } = {}) {
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
        },
        vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
        fragmentShader: `
          #include <packing>
          uniform sampler2D tDiffuse, tNormal, tDepth;
          uniform vec2 px;
          uniform float near, far, width;
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
