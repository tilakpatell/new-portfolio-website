// The contact page's paper airplane: a sheet of the memo pad below, folded
// into a dart, gliding a lazy figure of eight beside the heading. It banks
// into its turns, leaves a dotted trail in the theme's colour, and drifts
// toward the pointer. Click it and it loops the loop; send the memo
// (Contact.jsx says so with tp:memo-sent) and it's thrown off the screen,
// and a fresh sheet folds itself into another.

import * as THREE from 'three';
import { clamp01, color, createRenderer, disposeTree, easeOut, precompile } from '../../../lib/three/renderer';

const FPS_GAP = 1000 / 30 - 2;
const TRAIL = 70;

// The dart, nose along +x: a keel under the centre fold, two wings either
// side lifting a little at their tips. UVs map the sheet it was folded from.
function dartGeometry() {
  const N = [1.15, 0, 0];
  const T = [-0.95, 0, 0];
  const K = [-0.95, -0.3, 0];
  const WL = [-0.95, 0.1, -0.82];
  const WR = [-0.95, 0.1, 0.82];
  const tris = [
    [N, T, WL, [1, 0.5], [0, 0.5], [0, 0]],
    [N, WR, T, [1, 0.5], [0, 1], [0, 0.5]],
    [N, K, T, [1, 0.5], [0, 0.35], [0, 0.5]],
  ];
  const pos = [];
  const uv = [];
  for (const [a, b, c, ua, ub, uc] of tris) {
    pos.push(...a, ...b, ...c);
    uv.push(...ua, ...ub, ...uc);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.computeVertexNormals();
  return g;
}

// the memo pad's rules and red margin, faint, for the paper
function paperTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#fbfaf6';
  g.fillRect(0, 0, 256, 256);
  g.strokeStyle = 'rgba(120, 150, 210, 0.45)';
  g.lineWidth = 2;
  for (let y = 24; y < 256; y += 22) {
    g.beginPath();
    g.moveTo(0, y);
    g.lineTo(256, y);
    g.stroke();
  }
  g.strokeStyle = 'rgba(220, 80, 80, 0.72)';
  g.beginPath();
  g.moveTo(40, 0);
  g.lineTo(40, 256);
  g.stroke();
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function create(canvas, ctx) {
  const gl = createRenderer(canvas, { alpha: true, ratio: 1.75, onLost: ctx.onLost, onSlow: ctx.onSlow });
  const { renderer } = gl;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 50);
  camera.position.set(0, 0.4, 7.5);
  camera.lookAt(0, 0, 0);
  scene.add(new THREE.HemisphereLight(0xffffff, 0x9aa3b5, 1.6));
  const sun = new THREE.DirectionalLight(0xffffff, 1.6);
  sun.position.set(2, 4, 3);
  scene.add(sun);

  const plane = new THREE.Mesh(dartGeometry(), new THREE.MeshStandardMaterial({ map: paperTexture(), side: THREE.DoubleSide, roughness: 0.85, flatShading: true }));
  plane.scale.setScalar(0.72);
  scene.add(plane);

  // the trail: dots dropped behind it, fading as they age
  const trailPos = new Float32Array(TRAIL * 3);
  const trailAge = new Float32Array(TRAIL).fill(1);
  const trailGeo = new THREE.BufferGeometry();
  trailGeo.setAttribute('position', new THREE.BufferAttribute(trailPos, 3));
  trailGeo.setAttribute('aAge', new THREE.BufferAttribute(trailAge, 1));
  const trailMat = new THREE.ShaderMaterial({
    uniforms: { uColor: { value: new THREE.Color() }, uSize: { value: 5 } },
    vertexShader: /* glsl */ `
      attribute float aAge;
      uniform float uSize;
      varying float vAge;
      void main() {
        vAge = aAge;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = uSize * (1.0 - aAge * 0.5);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor;
      varying float vAge;
      void main() {
        float d = length(gl_PointCoord - 0.5);
        if (d > 0.5 || vAge >= 1.0) discard;
        gl_FragColor = vec4(uColor, (1.0 - vAge) * 0.85);
      }
    `,
    transparent: true,
    depthWrite: false,
  });
  const trail = new THREE.Points(trailGeo, trailMat);
  trail.frustumCulled = false;
  scene.add(trail);
  let nextDot = 0;
  let dotClock = 0;

  const recolor = (c) => {
    color(c.accent, trailMat.uniforms.uColor.value);
  };
  recolor(ctx.colors);

  // where it flies: a figure of eight round a centre that leans to the pointer
  const centre = new THREE.Vector3();
  const want = new THREE.Vector3();
  const path = (t, out) => out.set(Math.sin(t * 0.72) * 2.1, Math.sin(t * 1.1) * 0.72 + Math.sin(t * 0.37) * 0.2, Math.cos(t * 0.72) * 0.7);
  const at = new THREE.Vector3();
  const ahead = new THREE.Vector3();
  const lastDir = new THREE.Vector3(1, 0, 0);
  const up = new THREE.Vector3(0, 1, 0);
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const roll = new THREE.Quaternion();
  const axis = new THREE.Vector3(1, 0, 0);

  let t = 0;
  let lastDraw = 0;
  let drawn = false;
  let loop = -1; // seconds into a loop-the-loop, or -1
  let thrown = -1; // seconds since the memo was sent, or -1
  let fold = 1; // a fresh sheet folding in: 0 to 1

  const ray = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  const pointer = { x: 0, y: 0, on: false };
  const onMove = (e) => {
    const r = ctx.el.getBoundingClientRect();
    pointer.x = ((e.clientX - r.left) / r.width) * 2 - 1;
    pointer.y = -((e.clientY - r.top) / r.height) * 2 + 1;
    pointer.on = true;
    ndc.set(pointer.x, pointer.y);
    ray.setFromCamera(ndc, camera);
    ctx.el.style.cursor = ray.intersectObject(plane, false).length ? 'pointer' : '';
  };
  const onLeave = () => {
    pointer.on = false;
    ctx.el.style.cursor = '';
  };
  const onClick = (e) => {
    onMove(e);
    if (loop < 0 && thrown < 0 && ray.intersectObject(plane, false).length) {
      loop = 0;
      ctx.invalidate();
    }
  };
  const onSent = () => {
    if (thrown < 0) thrown = 0;
    ctx.invalidate();
  };
  ctx.el.addEventListener('pointermove', onMove);
  ctx.el.addEventListener('pointerleave', onLeave);
  ctx.el.addEventListener('click', onClick);
  window.addEventListener('tp:memo-sent', onSent);

  const fly = (dt) => {
    // the centre leans toward the pointer, a little
    want.set(pointer.on ? pointer.x * 1.2 : 0, pointer.on ? pointer.y * 0.5 : 0, 0);
    centre.lerp(want, 1 - Math.exp(-dt * 1.5));
    path(t, at).add(centre);
    path(t + 0.08, ahead).add(centre);
    // a loop-the-loop: a circle up and over, along the way it's going
    if (loop >= 0) {
      const p = clamp01(loop / 1.4);
      const a = p * Math.PI * 2;
      const r = 0.7;
      const pa = Math.sin(a) * r;
      const pb = (1 - Math.cos(a)) * r;
      const pa2 = Math.sin(a + 0.15) * r;
      const pb2 = (1 - Math.cos(a + 0.15)) * r;
      at.addScaledVector(lastDir, pa).y += pb;
      ahead.addScaledVector(lastDir, pa2).y += pb2;
      if (p >= 1) loop = -1;
    }
    // thrown: off and away to the upper right, faster and faster
    if (thrown >= 0) {
      const s = thrown * thrown * 2.2;
      at.x += s * 1.6;
      at.y += s * 0.6;
      ahead.copy(at).add(new THREE.Vector3(1.6, 0.6, 0));
      if (thrown > 1.6) {
        thrown = -1;
        fold = 0;
      }
    }
    const dir = ahead.clone().sub(at);
    if (dir.lengthSq() > 1e-6) {
      dir.normalize();
      // bank into the turn: the more it's turning, the more it rolls
      const turn = lastDir.clone().cross(dir).y;
      lastDir.lerp(dir, 0.5).normalize();
      m.lookAt(new THREE.Vector3(), dir, up);
      q.setFromRotationMatrix(m);
      // lookAt points -z; the dart's nose is +x
      q.multiply(new THREE.Quaternion().setFromAxisAngle(up, Math.PI / 2));
      roll.setFromAxisAngle(axis, THREE.MathUtils.clamp(-turn * 18, -0.7, 0.7));
      q.multiply(roll);
      plane.quaternion.slerp(q, loop >= 0 || thrown >= 0 ? 1 : 1 - Math.exp(-dt * 8));
    }
    plane.position.copy(at);
    if (fold < 1) {
      fold = Math.min(1, fold + dt / 0.9);
      const f = easeOut(fold);
      plane.scale.set(0.72 * f, 0.72 * (0.2 + 0.8 * f), 0.72 * f);
      plane.rotateX((1 - f) * 4);
    } else plane.scale.setScalar(0.72);
  };

  const dropDot = (dt) => {
    dotClock += dt;
    if (dotClock > 0.07 && thrown < 0) {
      dotClock = 0;
      const tail = new THREE.Vector3(-0.95 * 0.72, 0, 0).applyQuaternion(plane.quaternion).add(plane.position);
      trailPos.set([tail.x, tail.y, tail.z], nextDot * 3);
      trailAge[nextDot] = 0;
      nextDot = (nextDot + 1) % TRAIL;
    }
    for (let i = 0; i < TRAIL; i++) trailAge[i] = Math.min(1, trailAge[i] + dt / 3.2);
    trailGeo.attributes.position.needsUpdate = true;
    trailGeo.attributes.aAge.needsUpdate = true;
  };

  return {
    ready: precompile(renderer, scene, camera),
    resize(w, h) {
      gl.setSize(w, h);
      camera.aspect = Math.max(0.3, w / Math.max(1, h));
      // keep the whole figure of eight in view, whatever the box's shape
      const half = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
      camera.position.z = Math.max(7.5, 3.2 / (half * camera.aspect));
      camera.updateProjectionMatrix();
      trailMat.uniforms.uSize.value = 5 * renderer.getPixelRatio();
      drawn = false;
    },
    setColors(c) {
      recolor(c);
      drawn = false;
    },
    render(ms, now) {
      if (gl.lost) return false;
      gl.watch(now);
      if (ctx.reduced) {
        // one still frame: gliding, mid-turn
        if (!drawn) {
          t = 2.2;
          fly(0.016);
          renderer.render(scene, camera);
          drawn = true;
        }
        return thrown >= 0 || loop >= 0;
      }
      if (drawn && now - lastDraw < FPS_GAP) return true;
      const dt = lastDraw ? Math.min(0.1, (now - lastDraw) / 1000) : 1 / 30;
      lastDraw = now;
      t += dt;
      if (loop >= 0) loop += dt;
      if (thrown >= 0) thrown += dt;
      fly(dt);
      dropDot(dt);
      renderer.render(scene, camera);
      drawn = true;
      return true;
    },
    dispose() {
      ctx.el.removeEventListener('pointermove', onMove);
      ctx.el.removeEventListener('pointerleave', onLeave);
      ctx.el.removeEventListener('click', onClick);
      window.removeEventListener('tp:memo-sent', onSent);
      ctx.el.style.cursor = '';
      disposeTree(scene);
      gl.dispose();
    },
  };
}
