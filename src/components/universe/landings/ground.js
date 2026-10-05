// The ground's looks up close, for a landing (landings.js's `ground.style`):
// GLSL for footScene's createGround, which works out the colour of the
// ground at a point from the noise (or the plating) its bump map has. Each
// sets `near` (the colour there, from the landing's three colours uA, uB,
// uC) and may add a glow; toward the patch's edge the planet's own map
// takes over again (createGround mixes the two).
//
// In scope: n1, n2, n3 (the noise at three scales, 0…1, from coarse to
// fine as n3, n1, n2), m (where it is, in metres along the ground) and
// vBumpMapUv; on the plating, pl (its texel: r height, g shade, b light)
// and blocks (a bigger lay of it).

export const STYLES = {
  // grass: patches of two greens, blades in the fine noise, bare earth here and there
  grass: {
    bump: 'noise',
    bumpScale: 1.1,
    roughness: 0.95,
    glsl: `
      float g = smoothstep(0.28, 0.72, n3);
      near = mix(uA, uB, clamp(g * 0.75 + n1 * 0.35, 0.0, 1.0));
      near *= 0.74 + 0.5 * n2;
      near = mix(near, uC, smoothstep(0.24, 0.14, n3) * 0.75);`,
  },
  // sand: ripples blown across it, darker grit in patches
  sand: {
    bump: 'noise',
    bumpScale: 0.7,
    roughness: 0.97,
    glsl: `
      float rip = sin(dot(m, vec2(0.83, 0.55)) * 8.5 + n3 * 9.0) * 0.5 + 0.5;
      near = mix(uA, uB, clamp(smoothstep(0.3, 0.7, n3) * 0.7 + rip * 0.18, 0.0, 1.0));
      near *= 0.9 + 0.2 * n2;
      near = mix(near, uC, smoothstep(0.74, 0.88, n1) * 0.55);`,
  },
  // stone tiles a metre and a half square, each its own shade, grout between
  tiles: {
    bump: 'noise',
    bumpScale: 0.5,
    roughness: 0.82,
    glsl: `
      vec2 t = m / 1.5;
      vec2 cell = floor(t);
      vec2 f = fract(t);
      float h = fract(sin(dot(cell, vec2(12.9898, 78.233))) * 43758.5453);
      float edge = min(min(f.x, 1.0 - f.x), min(f.y, 1.0 - f.y));
      near = mix(uA, uB, h) * (0.88 + 0.22 * n2) * (0.94 + 0.12 * n1);
      near = mix(near, uC, 1.0 - smoothstep(0.015, 0.04, edge));`,
  },
  // a Game Boy's four greens, in half-metre pixels
  pixel: {
    bump: 'noise',
    bumpScale: 0.0,
    roughness: 1.0,
    glsl: `
      vec2 cell = floor(m / 0.5);
      float v = texture2D(bumpMap, (cell + 0.5) * 0.5 / 9.0 * 0.45).r;
      near = v < 0.36 ? uC : v < 0.5 ? uA : v < 0.66 ? uB : uB * 1.14;
      vec2 f = fract(m / 0.5);
      near *= 0.94 + 0.06 * step(0.08, min(f.x, f.y));`,
  },
  // asphalt: two greys, its grain, cracks, and painted lines in bays
  asphalt: {
    bump: 'noise',
    bumpScale: 1.3,
    roughness: 0.92,
    glsl: `
      near = mix(uA, uB, n3) * (0.78 + 0.42 * n2);
      near *= 1.0 - (1.0 - smoothstep(0.0, 0.012, abs(n1 - 0.5))) * 0.45;
      float bay = step(abs(fract(m.x / 3.0) - 0.5) * 3.0, 0.07) * step(fract(m.y / 14.0), 0.38);
      near = mix(near, uC, bay * 0.85);`,
  },
  // plating: panels in two metals, the seams and vents glowing the third
  // colour (energon, on Cybertron), pulsing slowly
  plating: {
    bump: 'plating',
    repeat: 0.36,
    bumpScale: 2.0,
    roughness: 0.5,
    metalness: 0.45,
    glsl: `
      near = mix(uA, uB, blocks) * pl.g * 1.3;
      float seam = 1.0 - smoothstep(0.12, 0.2, pl.r);
      near = mix(near, uC * 0.25, seam * 0.6);`,
    glow: `
      float seamG = 1.0 - smoothstep(0.12, 0.2, texture2D(bumpMap, vBumpMapUv).r);
      totalEmissiveRadiance += uC * (seamG * 0.5 + texture2D(bumpMap, vBumpMapUv).b * 1.6) * (0.75 + 0.25 * sin(uTime * 1.7 + vBumpMapUv.x * 3.0));`,
  },
};

export const styleOf = (ground) => (ground && STYLES[ground.style]) || null;
