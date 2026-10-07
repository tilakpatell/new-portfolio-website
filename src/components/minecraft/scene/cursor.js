// Minecraft, the block under the crosshair: the game's thin black outline
// (40% black, just proud of the block so it never sinks into it) and, while
// a block is being broken, its crack: the pack's ten destroy stages over
// every face, multiplied into what's under them as the game blends them
// (the texel times the colour behind, twice), so the crack darkens the
// block's own pixels rather than painting over them.
//
// createCursor(scene, { array, layers }) → { set(hit | null, crack: 0–9 | -1), dispose }

import * as THREE from 'three';

const vertex = /* glsl */ `
out vec3 vUv;
uniform float layer;
void main() {
  vUv = vec3(uv, layer);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;
const fragment = /* glsl */ `
layout(location = 0) out highp vec4 outColour;
precision highp sampler2DArray;
uniform sampler2DArray atlas;
in vec3 vUv;
void main() {
  vec4 t = texture(atlas, vec3(vUv.x, 1.0 - vUv.y, vUv.z));
  if (t.a < 0.1) discard;
  outColour = vec4(t.rgb, 1.0);
}
`;

export function createCursor(scene, { array, layers }) {
  const outline = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(1.004, 1.004, 1.004)), new THREE.LineBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.4, depthWrite: false }));
  outline.visible = false;
  outline.renderOrder = 4;
  scene.add(outline);

  const crackMaterial = new THREE.ShaderMaterial({
    glslVersion: THREE.GLSL3,
    vertexShader: vertex,
    fragmentShader: fragment,
    uniforms: { atlas: { value: array }, layer: { value: layers[0] ?? 0 } },
    // the game's crack blend: source × destination + destination × source
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
  const crack = new THREE.Mesh(new THREE.BoxGeometry(1.002, 1.002, 1.002), crackMaterial);
  crack.visible = false;
  crack.renderOrder = 3;
  scene.add(crack);

  return {
    set(hit, stage = -1) {
      outline.visible = Boolean(hit);
      crack.visible = Boolean(hit) && stage >= 0;
      if (!hit) return;
      outline.position.set(hit.x + 0.5, hit.y + 0.5, hit.z + 0.5);
      crack.position.copy(outline.position);
      if (stage >= 0) crackMaterial.uniforms.layer.value = layers[Math.min(9, stage)];
    },
    dispose() {
      scene.remove(outline);
      scene.remove(crack);
      outline.geometry.dispose();
      outline.material.dispose();
      crack.geometry.dispose();
      crackMaterial.dispose();
    },
  };
}
