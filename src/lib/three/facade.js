// Towers painted in the shader: every building one instance of a box, its
// walls drawn from where they are in the world (so a wall of any size gets
// floors and windows of the right size): glass curtain walls, stone with
// punched windows, brick walk-ups, a band of shopfronts at street level. The
// windows reflect the sky by day and, as uNight goes to 1, light up one by
// one. Invincible's city and Spider-Man's avenue are both built from it.

import * as THREE from 'three';

// what a building's walls are (its style's first number)
export const KIND = { glass: 0, stone: 1, brick: 2 };

// `space`: 'world' (the walls drawn from where they are in the world) or
// 'local' (from where they are in the field's own space: towers in a group
// scaled or tilted, as a planet's landing stands them)
export function facadeMaterial(uniforms = { uNight: { value: 0 } }, { space = 'world' } = {}) {
  const local = space === 'local';
  const m = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.8, metalness: 0 });
  m.onBeforeCompile = (shader) => {
    shader.uniforms.uNight = uniforms.uNight;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec4 aStyle;\nvarying vec3 vCity;\nvarying vec3 vCityN;\nvarying vec4 vStyle;')
      .replace(
        '#include <project_vertex>',
        `#include <project_vertex>
        {
          mat4 im = ${local ? 'mat4(1.0)' : 'modelMatrix'};
          #ifdef USE_INSTANCING
            im = ${local ? 'instanceMatrix' : 'modelMatrix * instanceMatrix'};
          #endif
          vCity = (im * vec4(transformed, 1.0)).xyz;
          vCityN = normalize(mat3(im) * objectNormal);
          vStyle = aStyle;
        }`,
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
        uniform float uNight;
        varying vec3 vCity;
        varying vec3 vCityN;
        varying vec4 vStyle;
        float cityHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
        float box(vec2 f, vec4 r) { return step(r.x, f.x) * step(f.x, r.y) * step(r.z, f.y) * step(f.y, r.w); }`,
      )
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
        vec3 cn = normalize(vCityN);
        float kind = vStyle.x;
        float tone = vStyle.y;
        float seed = vStyle.z;
        float roof = step(0.6, cn.y);
        float u = abs(cn.x) > 0.5 ? vCity.z : vCity.x;
        float glassK = 1.0 - step(0.5, kind);
        float brickK = step(1.5, kind);
        float stoneK = 1.0 - glassK - brickK;
        float fh = mix(mix(3.6, 3.2, brickK), 3.9, glassK);
        float cw = mix(mix(3.1, 2.7, brickK), 1.85, glassK);
        vec2 cell = vec2(u / cw, vCity.y / fh);
        vec2 f = fract(cell);
        vec2 wid = floor(cell);
        float win = glassK * box(f, vec4(0.05, 0.95, 0.12, 0.93))
          + stoneK * box(f, vec4(0.2, 0.8, 0.26, 0.84))
          + brickK * box(f, vec4(0.24, 0.76, 0.3, 0.86));
        // the street floor: shopfronts, a band of glass under a sign
        float street = 1.0 - step(4.6, vCity.y);
        float shop = box(vec2(fract(u / 7.0), vCity.y), vec4(0.08, 0.92, 0.35, 3.3));
        win = mix(win, shop, street) * (1.0 - roof);
        vec3 wall = glassK * mix(vec3(0.46, 0.5, 0.55), vec3(0.72, 0.74, 0.74), tone)
          + stoneK * mix(vec3(0.46, 0.43, 0.39), vec3(0.72, 0.69, 0.63), tone)
          + brickK * mix(vec3(0.38, 0.19, 0.14), vec3(0.62, 0.38, 0.28), tone);
        // a floor's band of stone or spandrel, slightly darker
        wall *= 0.92 + 0.08 * step(0.5, fract(vCity.y / fh + 0.35));
        // grime toward the street
        wall *= 0.8 + 0.2 * smoothstep(0.0, 24.0, vCity.y);
        float pane = cityHash(wid + seed * 13.0);
        vec3 glass = mix(vec3(0.07, 0.11, 0.15), vec3(0.16, 0.22, 0.28), pane) * mix(1.0, 1.35, glassK);
        vec3 roofC = vec3(0.3, 0.3, 0.31) * (0.85 + 0.3 * cityHash(floor(vCity.xz * 0.5)));
        diffuseColor.rgb = mix(mix(wall, glass, win), roofC, roof);
        float cityWin = win;`,
      )
      .replace(
        '#include <roughnessmap_fragment>',
        `#include <roughnessmap_fragment>
        roughnessFactor = mix(mix(0.82, 0.45, glassK), 0.06 + 0.08 * pane, cityWin);`,
      )
      .replace(
        '#include <metalnessmap_fragment>',
        `#include <metalnessmap_fragment>
        metalnessFactor = mix(0.55 * glassK, 0.85, cityWin);`,
      )
      .replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>
        {
          // a lit window, here and there: whole floors of an office, a few flats
          float floorOn = step(0.55, cityHash(vec2(wid.y, seed * 9.0)));
          float lit = step(mix(0.82, 0.45, floorOn), cityHash(wid * 1.7 + seed * 5.0)) * cityWin * uNight;
          vec3 warm = mix(vec3(1.0, 0.7, 0.38), vec3(0.7, 0.82, 1.0), step(0.7, cityHash(wid + seed)));
          totalEmissiveRadiance += lit * warm * (0.35 + 0.45 * cityHash(wid * 3.1 + seed));
          // shopfronts glow at street level after dark
          totalEmissiveRadiance += street * cityWin * uNight * vec3(1.0, 0.85, 0.6) * 0.8;
          // and after dark the walls themselves are darker than the sky lights them
          diffuseColor.rgb *= 1.0 - 0.45 * uNight * (1.0 - cityWin);
        }`,
      );
  };
  m.customProgramCacheKey = () => (local ? 'tm-facade-local' : 'tm-facade');
  return m;
}

// Boxes as instances, one draw: [{ x, y, z, w, h, d, kind, tone, seed }],
// each standing on its y (0 unless given), w, h and d its size on x, y and z.
export function boxField(list, material) {
  const geo = new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0);
  const style = new Float32Array(list.length * 4);
  const mesh = new THREE.InstancedMesh(geo, material, list.length);
  const m = new THREE.Matrix4();
  const s = new THREE.Vector3();
  const p = new THREE.Vector3();
  const q = new THREE.Quaternion();
  list.forEach((b, i) => {
    mesh.setMatrixAt(i, m.compose(p.set(b.x, b.y ?? 0, b.z), q, s.set(b.w, b.h, b.d)));
    style.set([b.kind, b.tone, b.seed, 0], i * 4);
  });
  geo.setAttribute('aStyle', new THREE.InstancedBufferAttribute(style, 4));
  mesh.instanceMatrix.needsUpdate = true;
  mesh.computeBoundingSphere();
  return mesh;
}
