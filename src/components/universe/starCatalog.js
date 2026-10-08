// The real sky's stars, as the universe map's sky draws them (starField.js):
// the Hipparcos catalogue (ESA, 1997), every star to tenth magnitude, baked by
// scripts/bake-universe-stars.mjs into public/textures/universe/stars.bin,
// in the same frame as the Milky Way's photo (skyShader.js), so each star
// sits where the photo has it.
//
// The file is RECORD bytes a star, brightest first (so the first n are the n
// brightest): its direction, octahedral, two uint16s (little-endian); its V
// magnitude, a byte, in sixteenths from -2; its B-V colour index, a byte, in
// 85ths from -0.5.
//
// Pure (no three.js), so the bake and the tests share it.

export const RECORD = 6;

// how far round the sky's bake turned ESO's panorama, of a whole turn: 50 of
// its 6000 columns (scripts/bake-universe-sky.mjs reads it from here)
export const SKY_TURN = 50 / 6000;

const DEG = Math.PI / 180;

// ICRS to galactic (the IAU's rotation, J2000)
const TO_GALACTIC = [
  [-0.0548755604162154, -0.873437090234885, -0.4838350155487132],
  [0.4941094278755837, -0.4448296299600112, 0.746982244497219],
  [-0.8676661490190047, -0.1980763734312015, 0.4559837761750669],
];

// right ascension and declination (degrees) → galactic longitude 0-360 and
// latitude (degrees)
export function equatorialToGalactic(ra, dec) {
  const e = [Math.cos(dec * DEG) * Math.cos(ra * DEG), Math.cos(dec * DEG) * Math.sin(ra * DEG), Math.sin(dec * DEG)];
  const [x, y, z] = TO_GALACTIC.map((r) => r[0] * e[0] + r[1] * e[1] + r[2] * e[2]);
  const l = Math.atan2(y, x) / DEG;
  return [(l + 360) % 360, Math.asin(Math.max(-1, Math.min(1, z))) / DEG];
}

// galactic longitude and latitude → the direction the sky's photo has them
// at, in the sky sphere's own frame. The photo is ESO's panorama (l 0 in the
// middle, rising to the left, north up) turned upside down and SKY_TURN
// round; skyShader.js's photo() reads u = atan(d.z, -d.x) / 2π, v = 1 -
// acos(d.y) / π
export function skyDir(l, b) {
  const u = 0.5 - l / 360 - SKY_TURN;
  const t = 2 * Math.PI * (u - Math.floor(u));
  const c = Math.cos(b * DEG);
  return [-c * Math.cos(t), -Math.sin(b * DEG), c * Math.sin(t)];
}

const sign = (v) => (v < 0 ? -1 : 1);

// a unit direction ↔ two uint16s (octahedral)
export function octEncode([x, y, z]) {
  const s = Math.abs(x) + Math.abs(y) + Math.abs(z);
  let u = x / s;
  let v = y / s;
  if (z < 0) [u, v] = [(1 - Math.abs(v)) * sign(u), (1 - Math.abs(u)) * sign(v)];
  return [Math.round((u * 0.5 + 0.5) * 65535), Math.round((v * 0.5 + 0.5) * 65535)];
}

export function octDecode(a, b) {
  let u = (a / 65535) * 2 - 1;
  let v = (b / 65535) * 2 - 1;
  const z = 1 - Math.abs(u) - Math.abs(v);
  if (z < 0) [u, v] = [(1 - Math.abs(v)) * sign(u), (1 - Math.abs(u)) * sign(v)];
  const n = Math.hypot(u, v, z);
  return [u / n, v / n, z / n];
}

const byte = (v) => Math.max(0, Math.min(255, Math.round(v)));

export function encodeStar(buf, i, dir, v, bv) {
  const [a, b] = octEncode(dir);
  const o = i * RECORD;
  buf[o] = a & 255;
  buf[o + 1] = a >> 8;
  buf[o + 2] = b & 255;
  buf[o + 3] = b >> 8;
  buf[o + 4] = byte((v + 2) * 16);
  buf[o + 5] = byte((bv + 0.5) * 85);
}

export function decodeStars(buffer) {
  const bytes = new Uint8Array(buffer);
  const count = Math.floor(bytes.length / RECORD);
  const dir = new Float32Array(count * 3);
  const mag = new Float32Array(count);
  const bv = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    const o = i * RECORD;
    dir.set(octDecode(bytes[o] | (bytes[o + 1] << 8), bytes[o + 2] | (bytes[o + 3] << 8)), i * 3);
    mag[i] = bytes[o + 4] / 16 - 2;
    bv[i] = bytes[o + 5] / 85 - 0.5;
  }
  return { count, dir, mag, bv };
}

// a star's colour from its B-V: its temperature (Ballesteros 2012), then a
// black body's light at that temperature through the eye's colour matching
// (Wyman, Sloan and Shirley's fit of the CIE 1931 curves) into linear sRGB,
// scaled so its brightest channel is 1
const lobe = (x, mu, s1, s2) => Math.exp(-0.5 * ((x - mu) / (x < mu ? s1 : s2)) ** 2);
export function bvToRgb(bvIndex) {
  const t = 4600 * (1 / (0.92 * bvIndex + 1.7) + 1 / (0.92 * bvIndex + 0.62));
  let X = 0;
  let Y = 0;
  let Z = 0;
  for (let l = 380; l <= 780; l += 5) {
    const p = l ** -5 / Math.expm1(1.4388e7 / (l * t));
    X += p * (1.056 * lobe(l, 599.8, 37.9, 31) + 0.362 * lobe(l, 442, 16, 26.7) - 0.065 * lobe(l, 501.1, 20.4, 26.2));
    Y += p * (0.821 * lobe(l, 568.8, 46.9, 40.5) + 0.286 * lobe(l, 530.9, 16.3, 31.1));
    Z += p * (1.217 * lobe(l, 437, 11.8, 36) + 0.681 * lobe(l, 459, 26, 13.8));
  }
  const rgb = [3.2406 * X - 1.5372 * Y - 0.4986 * Z, -0.9689 * X + 1.8758 * Y + 0.0415 * Z, 0.0557 * X - 0.204 * Y + 1.057 * Z].map((c) => Math.max(0, c));
  const m = Math.max(...rgb);
  return rgb.map((c) => c / m);
}
