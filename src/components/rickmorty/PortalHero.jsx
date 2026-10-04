import { useEffect, useRef } from 'react';
import { use3D } from '../../lib/gpu';
import { prefersReducedMotion } from '../../lib/hooks';
import { DIMENSIONS } from './dimensions';

// The hero's portal: the green swirl, and through it whichever dimension the
// portal gun last opened onto. Drawn by one fragment shader on a plain WebGL
// canvas where 3D is on (no Three.js for this); a CSS swirl otherwise.

const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);

const VERT = 'attribute vec2 p; void main() { gl_Position = vec4(p, 0.0, 1.0); }';
const FRAG = `
precision highp float;
uniform vec2 res;
uniform float t, open, pattern;
uniform vec3 skyA, skyB, ground, acc;
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y); }
float fbm(vec2 p) { float s = 0.0, a = 0.5; for (int i = 0; i < 4; i++) { s += a * noise(p); p *= 2.0; a *= 0.5; } return s; }
vec3 world(vec2 q) {
  vec3 c = mix(skyA, skyB, smoothstep(-0.1, 0.55, q.y));
  float h = -0.12 + 0.04 * sin(q.x * 5.0 + pattern * 1.7) + 0.02 * sin(q.x * 13.0 + pattern);
  if (pattern < 0.5) {
    // Earth: clouds, rolling hills
    float cl = smoothstep(0.55, 0.57, fbm(q * 3.0 + vec2(t * 0.04, 0.0)));
    c = mix(c, vec3(1.0), cl * smoothstep(0.0, 0.2, q.y));
  } else if (pattern < 1.5) {
    // Cronenberg World: a sick sky, things that were people
    c += vec3(0.2, 0.0, 0.1) * fbm(q * 4.0 - t * 0.05);
  } else if (pattern < 2.5) {
    // Gazorpazorp: two suns
    c = mix(c, acc, smoothstep(0.075, 0.07, length(q - vec2(-0.12, 0.22))));
    c = mix(c, vec3(1.0, 0.7, 0.5), smoothstep(0.045, 0.04, length(q - vec2(0.06, 0.3))));
    h += 0.06 * sin(q.x * 3.0 + 1.0);
  } else if (pattern < 3.5) {
    // the Citadel: stars and the city of Ricks hanging in them
    c += vec3(step(0.995, hash(floor(q * 260.0)))) * 0.9;
    float city = smoothstep(0.17, 0.16, length((q - vec2(0.0, 0.18)) * vec2(1.0, 1.6)));
    for (int i = 0; i < 6; i++) {
      float fi = float(i);
      city = max(city, smoothstep(0.06, 0.055, length(q - vec2(-0.2 + fi * 0.08, 0.1 + 0.05 * sin(fi * 2.0)))));
    }
    c = mix(c, vec3(0.65, 0.72, 0.85), city);
    c = mix(c, acc, city * step(0.5, fract(q.y * 60.0)) * 0.4);
    h = -0.9;
  } else if (pattern < 4.5) {
    // Froopyland: a rainbow
    float r = length(q - vec2(0.0, -0.3));
    vec3 rb = 0.6 + 0.4 * cos(6.2831 * (r * 3.0 + vec3(0.0, 0.33, 0.67)));
    c = mix(c, rb, smoothstep(0.02, 0.0, abs(r - 0.4) - 0.07) * 0.75);
  } else if (pattern < 5.5) {
    // Blips and Chitz: a neon grid to the horizon
    if (q.y < h) {
      vec2 g = vec2(q.x / (h - q.y + 0.05), 1.0 / (h - q.y + 0.05) + t * 0.6);
      float line = max(smoothstep(0.05, 0.0, abs(fract(g.x * 2.0) - 0.5) - 0.45), smoothstep(0.05, 0.0, abs(fract(g.y * 0.6) - 0.5) - 0.45));
      return mix(ground, acc, line * 0.9);
    }
    c = mix(c, acc, smoothstep(0.09, 0.0, abs(q.y - h - 0.02)) * 0.4);
  } else {
    // Planet Squanch: big purple mushrooms on the skyline
    for (int i = 0; i < 4; i++) {
      float fi = float(i);
      vec2 m = vec2(-0.3 + fi * 0.2, h + 0.1 + 0.04 * fi);
      if (length((q - m) * vec2(1.0, 1.8)) < 0.08) c = vec3(0.6, 0.35, 0.8);
      if (abs(q.x - m.x) < 0.012 && q.y < m.y && q.y > h) c = vec3(0.95, 0.9, 0.8);
    }
  }
  if (q.y < h) c = mix(ground, ground * 0.6, smoothstep(h, h - 0.5, q.y)) * (0.92 + 0.12 * fbm(q * 9.0));
  return c;
}
void main() {
  vec2 uv = (gl_FragCoord.xy - 0.5 * res) / res.y;
  vec2 o = uv / vec2(0.34, 0.45);
  float r = length(o);
  float e = max(open, 0.001);
  float a = atan(o.y, o.x);
  float rr = r / e;
  // the rim: green, turning, ragged at the edge
  float rag = 0.04 * sin(a * 9.0 + t * 3.0) + 0.03 * sin(a * 17.0 - t * 5.0);
  float edge = 1.0 + rag;
  float sw = sin(a * 3.0 - rr * 10.0 + t * 4.0) * 0.5 + 0.5;
  float sw2 = sin(a * 7.0 + rr * 16.0 - t * 6.0) * 0.5 + 0.5;
  vec3 green = mix(vec3(0.06, 0.42, 0.1), vec3(0.74, 1.0, 0.44), smoothstep(0.3, 0.7, sw * 0.65 + sw2 * 0.35));
  vec3 c = world(uv / max(e, 0.2));
  // the swirling band, a bright lip at the very edge, then a tight glow
  c = mix(c, green, smoothstep(edge - 0.3, edge - 0.12, rr));
  c = mix(c, vec3(0.9, 1.0, 0.62), smoothstep(edge - 0.07, edge - 0.015, rr));
  float inside = smoothstep(edge + 0.012, edge - 0.012, rr);
  float glow = exp(-max(rr - edge, 0.0) * 9.0) * 0.5 * (1.0 - inside) * open;
  // premultiplied: the world where the portal is, green light round it
  gl_FragColor = vec4(c * inside + vec3(0.45, 1.0, 0.35) * glow, max(inside, glow));
}`;

function startGl(canvas, state) {
  const gl = canvas.getContext('webgl', { premultipliedAlpha: true, alpha: true, antialias: true });
  if (!gl) return null;
  const sh = (type, src) => {
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    return s;
  };
  const prog = gl.createProgram();
  gl.attachShader(prog, sh(gl.VERTEX_SHADER, VERT));
  gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FRAG));
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return null;
  gl.useProgram(prog);
  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(prog, 'p');
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  const u = Object.fromEntries(['res', 't', 'open', 'pattern', 'skyA', 'skyB', 'ground', 'acc'].map((k) => [k, gl.getUniformLocation(prog, k)]));
  const draw = (t) => {
    const w = canvas.width;
    const h = canvas.height;
    gl.viewport(0, 0, w, h);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    const d = DIMENSIONS[state.dim];
    gl.uniform2f(u.res, w, h);
    gl.uniform1f(u.t, t);
    gl.uniform1f(u.open, state.open);
    gl.uniform1f(u.pattern, d.pattern);
    gl.uniform3fv(u.skyA, hex(d.sky[0]));
    gl.uniform3fv(u.skyB, hex(d.sky[1]));
    gl.uniform3fv(u.ground, hex(d.ground));
    gl.uniform3fv(u.acc, hex(d.accent));
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  };
  const dispose = () => {
    gl.deleteBuffer(buf);
    gl.deleteProgram(prog);
    gl.getExtension('WEBGL_lose_context')?.loseContext();
  };
  return { draw, dispose };
}

// dim: which dimension shows; firing (a counter) closes and reopens the portal onto it
export default function PortalHero({ dim, firing, className }) {
  const { on } = use3D();
  const ref = useRef(null);
  const state = useRef({ dim, open: 1, shown: dim, fire: firing, fireAt: -1 });

  useEffect(() => {
    const s = state.current;
    if (s.fire !== firing) {
      s.fire = firing;
      s.fireAt = performance.now();
    }
    s.next = dim;
  }, [dim, firing]);

  useEffect(() => {
    if (!on) return undefined;
    const box = ref.current;
    if (!box) return undefined;
    // a canvas of its own each time: a context given back can't be used again
    const canvas = document.createElement('canvas');
    canvas.className = 'rm-portal-canvas';
    canvas.setAttribute('aria-hidden', 'true');
    box.append(canvas);
    const s = state.current;
    const r = startGl(canvas, s);
    if (!r) {
      canvas.remove();
      return undefined;
    }
    const calm = prefersReducedMotion();
    let raf = 0;
    let visible = true;
    const io = new IntersectionObserver(([e]) => {
      visible = e.isIntersecting;
    });
    io.observe(canvas);
    const size = () => {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = Math.round(canvas.clientWidth * dpr);
      canvas.height = Math.round(canvas.clientHeight * dpr);
    };
    size();
    const ro = new ResizeObserver(size);
    ro.observe(canvas);
    const t0 = performance.now();
    const frame = (now) => {
      raf = requestAnimationFrame(frame);
      if (!visible || document.hidden) return;
      // firing: the portal snaps shut, swaps, and swirls open again
      const since = (now - s.fireAt) / 1000;
      if (s.fireAt > 0 && since < 0.7) {
        s.open = since < 0.25 ? 1 - since / 0.25 : Math.min(1, (since - 0.25) / 0.45);
        if (since >= 0.25) s.dim = s.next;
      } else {
        s.open = 1;
        s.dim = s.next ?? s.dim;
      }
      r.draw(calm ? 2 : (now - t0) / 1000);
    };
    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      io.disconnect();
      ro.disconnect();
      r.dispose();
      canvas.remove();
    };
  }, [on]);

  const d = DIMENSIONS[dim];
  return (
    <div className={`rm-portal ${className ?? ''}`} data-gl={on || undefined}>
      {on ? (
        <div ref={ref} className="rm-portal-box" />
      ) : (
        <div key={firing} className="rm-portal-css" style={{ '--sky-a': d.sky[0], '--sky-b': d.sky[1], '--ground': d.ground }} aria-hidden="true">
          <div className="rm-portal-world" />
          <div className="rm-portal-swirl" />
        </div>
      )}
    </div>
  );
}
