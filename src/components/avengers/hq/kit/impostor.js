// Impostors: a detailed model photographed once, at load, into a texture, then
// drawn far away as a card that turns to face the camera. A forest of
// Poly Haven firs costs a few hundred triangles and one draw call per kind,
// and looks like the real model because it is a picture of it.

import * as THREE from 'three';

// Render `object` (its feet at the origin) from the side into a texture. The
// light comes from `lightDir`, and the scene's environment map lights it too.
export function bakeImpostor(renderer, object, { size = 512, environment = null, lightDir = new THREE.Vector3(0.6, 0.6, 0.5), lightColor = 0xfff1df, light = 2.6, ambient = 0.45 } = {}) {
  const scene = new THREE.Scene();
  scene.environment = environment;
  scene.environmentIntensity = 0.8;
  const holder = object.clone(true);
  scene.add(holder);
  const sun = new THREE.DirectionalLight(lightColor, light);
  sun.position.copy(lightDir).normalize().multiplyScalar(10);
  scene.add(sun);
  scene.add(new THREE.HemisphereLight(0xcfe0ff, 0x4a3f30, ambient));
  const box = new THREE.Box3().setFromObject(holder);
  const w = Math.max(box.max.x - box.min.x, box.max.z - box.min.z);
  const h = box.max.y - box.min.y;
  const half = Math.max(w, h) / 2;
  const cx = (box.min.x + box.max.x) / 2;
  const cz = (box.min.z + box.max.z) / 2;
  const cam = new THREE.OrthographicCamera(-half, half, half, -half, 0.01, 100);
  cam.position.set(cx, box.min.y + half, cz + 20);
  cam.lookAt(cx, box.min.y + half, cz);
  const rt = new THREE.WebGLRenderTarget(size, size, { samples: 4, generateMipmaps: true, minFilter: THREE.LinearMipmapLinearFilter, magFilter: THREE.LinearFilter, colorSpace: THREE.LinearSRGBColorSpace });
  const prev = { target: renderer.getRenderTarget(), color: renderer.getClearColor(new THREE.Color()), alpha: renderer.getClearAlpha(), shadows: renderer.shadowMap.enabled };
  renderer.setRenderTarget(rt);
  renderer.setClearColor(0x000000, 0);
  renderer.shadowMap.enabled = false;
  renderer.clear();
  renderer.render(scene, cam);
  renderer.setRenderTarget(prev.target);
  renderer.setClearColor(prev.color, prev.alpha);
  renderer.shadowMap.enabled = prev.shadows;
  // the picture's square spans 2·half; the model sits centred, feet at the bottom
  return { texture: rt.texture, target: rt, span: half * 2, height: h, width: w };
}

// A forest of cards for one impostor (a baked one from loadImpostor, or one
// from bakeImpostor): `points` are [x, y, z, height, flip, shade]. Each card
// turns about its upright axis to face the camera and is lit through its
// normal map, so the scene's sun lights the forest from the right side.
export function impostorForest(imp, points, { fog = true } = {}) {
  const geo = new THREE.PlaneGeometry(1, 1).translate(0, 0.5, 0);
  const lit = !!imp.normalMap;
  const mat = lit
    ? new THREE.MeshStandardMaterial({ map: imp.map, normalMap: imp.normalMap, alphaTest: 0.5, roughness: 0.9, metalness: 0, side: THREE.DoubleSide, envMapIntensity: 0.7, fog })
    : new THREE.MeshBasicMaterial({ map: imp.texture ?? imp.map, alphaTest: 0.45, side: THREE.DoubleSide, fog });
  mat.alphaToCoverage = true;
  mat.onBeforeCompile = (shader) => {
    // the card's own frame: facing the camera across the ground
    const basis = /* glsl */ `
      vec4 basePos = modelMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
      float sx = length(instanceMatrix[0].xyz) * sign(instanceMatrix[0].x + 1e-6);
      float sy = length(instanceMatrix[1].xyz);
      vec3 toCam = cameraPosition - basePos.xyz;
      toCam.y = 0.0;
      toCam = normalize(toCam + vec3(1e-5, 0.0, 0.0));
      vec3 cardRight = vec3(toCam.z, 0.0, -toCam.x);
    `;
    if (lit) {
      shader.vertexShader = shader.vertexShader.replace(
        '#include <defaultnormal_vertex>',
        basis + /* glsl */ `
      vec3 transformedNormal = normalize((viewMatrix * vec4(toCam, 0.0)).xyz);
      `,
      );
    } else shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', basis + '#include <begin_vertex>');
    shader.vertexShader = shader.vertexShader.replace(
      '#include <project_vertex>',
      /* glsl */ `
      vec3 world = basePos.xyz + cardRight * position.x * sx + vec3(0.0, position.y * sy, 0.0);
      vec4 mvPosition = viewMatrix * vec4(world, 1.0);
      gl_Position = projectionMatrix * mvPosition;
      `,
    );
  };
  const inst = new THREE.InstancedMesh(geo, mat, points.length);
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const s = new THREE.Vector3();
  const p = new THREE.Vector3();
  const c = new THREE.Color();
  points.forEach(([x, y, z, height, flip = 1, shade = 1], i) => {
    // the card is span wide and span tall for a model `height` tall
    const k = height / imp.height;
    s.set(imp.span * k * flip, imp.span * k, 1);
    m.compose(p.set(x, y, z), q, s);
    inst.setMatrixAt(i, m);
    inst.setColorAt(i, c.setRGB(shade * 0.98, shade, shade * 0.94));
  });
  inst.instanceMatrix.needsUpdate = true;
  if (inst.instanceColor) inst.instanceColor.needsUpdate = true;
  inst.frustumCulled = false;
  inst.castShadow = false;
  inst.receiveShadow = false;
  return inst;
}
