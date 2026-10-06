import { useEffect, useMemo } from 'react';
import { T, clamp, ease } from '../hyperspace3d/timeline';
import JumpCanvas from './JumpCanvas';
import { blueSkyAt } from './timing';

// Walt and Jesse's way across the map, made up for the RV: the cook. On the
// jump to lightspeed's timeline (hyperspace3d/timeline.js), so the universe
// map has the RV out at the place under its flash, as it does for the others:
//
//   0.00–0.45s  the desert heat comes up: an amber haze off the ground, the
//               view darkening above it
//   0.45–1.15s  blue crystals grow in from the edges of the view, facet by
//               facet, like frost on a window, until the last of them closes
//               over the middle
//   1.15–1.30s  a pale blue flash as it seals; `onPeak` fires here
//   1.30–1.95s  inside the crystal: Blue Sky, 99.1% pure, a sheet of facets
//               that the light sweeps across, glinting
//   1.95–2.45s  the sheet shatters from the middle out, the shards flying
//               away to show the new place behind
//
// The crystals are a Voronoi field: each cell is a shard with its own
// facet, born in order of how far it sits from the view's edge, growing out
// from its seed in a spiky star until it fills its cell. Where WebGL won't
// start, a frame of blue closes in and breaks open on a 2D canvas. `sound`
// plays the cook, a sizzle rising to the seal and the shatter on the way out
// (only from something the visitor clicked or pressed: browsers block audio
// before).

const FRAG = `
precision highp float;
uniform vec2 res;
uniform float t, clock, flash, dark, haze, front, zoom, shatter, glint, seed;

float hash21(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7)) + seed) * 43758.5453); }
vec2 hash22(vec2 p) { return vec2(hash21(p), hash21(p + 19.19)); }

// the nearest and second nearest of a jittered grid of seeds: the shards
void voronoi(vec2 p, out float f1, out float f2, out vec2 id, out vec2 site) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f1 = 8.0;
  f2 = 8.0;
  id = i;
  site = i;
  for (int y = -1; y <= 1; y++) {
    for (int x = -1; x <= 1; x++) {
      vec2 g = vec2(float(x), float(y));
      vec2 o = hash22(i + g);
      vec2 r = g + o - f;
      float d = dot(r, r);
      if (d < f1) { f2 = f1; f1 = d; id = i + g; site = i + g + o; }
      else if (d < f2) f2 = d;
    }
  }
  f1 = sqrt(f1);
  f2 = sqrt(f2);
}

// how far in from the view's nearest edge a point is: 0 at the edge, 1 in the middle
float inward(vec2 uv, float aspect) {
  vec2 e = 1.0 - abs(uv) / vec2(aspect * 0.5, 0.5);
  return clamp(min(e.x, e.y), 0.0, 1.0);
}

void main() {
  vec2 uv = (gl_FragCoord.xy - 0.5 * res) / res.y;
  float aspect = res.x / res.y;
  float corner = 0.5 * sqrt(aspect * aspect + 1.0);
  // the shatter: the sheet flies apart from the middle, so look inward for what lands here
  float rr = length(uv);
  vec2 dir = uv / max(rr, 1e-4);
  float fly = shatter * shatter;
  vec2 q = uv - dir * fly * (0.45 + 0.25 * rr) ;
  float scale = 6.0 * zoom;
  vec2 p = q * scale;
  float f1, f2;
  vec2 id, site;
  voronoi(p, f1, f2, id, site);
  vec2 siteUv = site / scale;
  // when this shard was born: in from the edges, with a little luck
  float born = inward(siteUv, aspect) * 0.85 + hash21(id) * 0.3;
  float age = (front - born) * 3.0;
  // and how far it's grown out from its seed: a spiky star, then the whole cell
  vec2 rel = p - site;
  float ang = atan(rel.y, rel.x);
  float spikes = 0.72 + 0.28 * cos(ang * 3.0 + hash21(id + 2.3) * 6.2832) + 0.12 * cos(ang * 7.0 - hash21(id + 4.1) * 6.2832);
  float reach = max(age, 0.0) * spikes;
  float crystal = 1.0 - smoothstep(reach - 0.05, reach + 0.02, f1);
  // the facet: a flat blue by how it faces the light, which sweeps across as the clock turns
  vec3 nrm = normalize(vec3((hash22(id + 3.7) - 0.5) * 1.1, 1.0));
  vec3 light = normalize(vec3(cos(clock * 0.7) * 0.9, 0.55 + 0.35 * sin(clock * 0.5), 0.9));
  float shade = clamp(dot(nrm, light), 0.0, 1.0);
  vec3 deep = vec3(0.02, 0.22, 0.44);
  vec3 mid = vec3(0.14, 0.60, 0.86);
  vec3 pale = vec3(0.74, 0.95, 1.0);
  vec3 c = mix(deep, mid, shade);
  c = mix(c, pale, pow(shade, 5.0) * 0.75);
  // each shard's own planes: three to five facets fanning out from its seed, each catching the light its own way
  float planes = 3.0 + floor(hash21(id + 5.0) * 3.0);
  float plane = floor((ang + 3.14159265) / 6.2831853 * planes + hash21(id + 6.0));
  c *= 0.84 + 0.32 * hash21(id + plane * 0.37 + 9.0);
  // the cracks where shards meet, catching the light
  float edge = 1.0 - smoothstep(0.0, 0.05, f2 - f1);
  c = mix(c, pale, edge * 0.8);
  // the growing tip glows as it forms
  float tip = smoothstep(0.12, 0.0, abs(f1 - reach)) * step(0.0, age) * (1.0 - step(1.3, age));
  c = mix(c, vec3(0.9, 1.0, 1.0), tip * 0.7);
  // glints: now and then a facet flashes as the light passes
  float tw = hash21(id + 11.3);
  float spark = smoothstep(0.975, 1.0, sin(clock * (2.0 + tw * 4.0) + tw * 40.0));
  c += vec3(0.85, 1.0, 1.0) * spark * glint * 0.8;
  float alpha = crystal * (0.95 + 0.05 * edge);
  // the shatter: shards nearest the middle brighten and go first
  float siteR = length(siteUv) / corner;
  float wave = shatter * 1.2;
  float gone = smoothstep(siteR - 0.06, siteR + 0.02, wave);
  c = mix(c, pale, smoothstep(siteR - 0.3, siteR - 0.06, wave) * (1.0 - gone) * 0.55);
  alpha *= 1.0 - gone;
  // the desert's heat before any of it: amber off the ground, the sky darkening above
  float ground = smoothstep(0.5, -0.5, uv.y);
  float heat = haze * (0.08 + 0.32 * ground);
  vec3 amber = vec3(0.96, 0.60, 0.20);
  vec4 col = vec4(amber * heat, heat);
  float sky = dark * 0.5 * (1.0 - haze * ground * 0.6) * (1.0 - smoothstep(0.0, 0.2, shatter));
  col = col * (1.0 - sky) + vec4(0.0, 0.0, 0.0, sky);
  col = col * (1.0 - alpha) + vec4(c * alpha, alpha);
  // the flash as it seals: pale blue-white
  vec3 fc = vec3(0.86, 0.97, 1.0);
  col = col * (1.0 - flash) + vec4(fc, 1.0) * flash;
  gl_FragColor = col;
}`;

// The 2D version: a frame of blue closing in from the edges, then breaking open from the middle
function fallback(ctx, t, clock, { W, H }, u) {
  if (u.haze > 0) {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, `rgba(0,0,0,${0.4 * u.dark})`);
    g.addColorStop(1, `rgba(245,153,51,${0.4 * u.haze})`);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  }
  const cx = W / 2;
  const cy = H / 2;
  // how far in the crystal has come: a hole in the middle that closes
  const grown = Math.min(1, u.front / 1.6);
  const hole = Math.max(0, 1 - grown * 1.15);
  // and, shattering, a hole that opens again from the middle
  const open = u.shatter > 0 ? ease(u.shatter) * 1.2 : 0;
  const hw = Math.max(hole, open) * W * 0.5;
  const hh = Math.max(hole, open) * H * 0.5;
  if (grown > 0 && open < 1.2) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, W, H);
    if (hw > 0) ctx.rect(cx - hw, cy - hh, hw * 2, hh * 2);
    ctx.clip('evenodd');
    ctx.globalAlpha = 1 - clamp(u.shatter * 1.1);
    ctx.fillStyle = 'rgb(36,138,204)';
    ctx.fillRect(0, 0, W, H);
    // facets: a few shards of lighter and darker blue, swept by the light
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 9; i++) {
      const s = Math.sin(clock * 0.8 + i * 1.7) * 0.5 + 0.5;
      ctx.fillStyle = `rgba(150,220,255,${0.08 + 0.12 * s})`;
      ctx.beginPath();
      ctx.moveTo((i / 9) * W, 0);
      ctx.lineTo(((i + 0.6) / 9) * W, 0);
      ctx.lineTo(((i + 1.3) / 9) * W, H);
      ctx.lineTo(((i + 0.2) / 9) * W, H);
      ctx.fill();
    }
    ctx.globalCompositeOperation = 'source-over';
    ctx.strokeStyle = 'rgba(200,240,255,0.9)';
    ctx.lineWidth = 3;
    if (hw > 0) ctx.strokeRect(cx - hw, cy - hh, hw * 2, hh * 2);
    ctx.restore();
    ctx.globalAlpha = 1;
  }
  if (u.flash > 0) {
    ctx.fillStyle = `rgba(219,247,255,${u.flash})`;
    ctx.fillRect(0, 0, W, H);
  }
}

export default function BlueSkyJump({ onPeak, onDone, sound = false }) {
  const seed = useMemo(() => Math.random() * 10, []);
  const uniforms = useMemo(() => (t) => ({ ...blueSkyAt(t), seed }), [seed]);

  useEffect(() => {
    if (!sound) return undefined;
    // the cook: a sizzle as the crystals form, and the sheet shattering on the way out
    let alive = true;
    import('../../lib/sfx').then((s) => {
      if (!alive) return;
      s.sizzle();
      s.shatter(undefined, undefined, T.tunnel / 1000);
    });
    return () => {
      alive = false;
    };
  }, [sound]);

  return <JumpCanvas frag={FRAG} uniforms={uniforms} fallback={fallback} onPeak={onPeak} onDone={onDone} />;
}
