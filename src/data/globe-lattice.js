// The Fibonacci lattice shared by scripts/build-globe.mjs and the globe on the
// site: point i of n, as [longitude, latitude] in degrees. Both sides must
// compute it identically, so it lives in one place.
const GOLDEN = Math.PI * (3 - Math.sqrt(5));

export function fibonacciPoint(i, n) {
  const y = 1 - (2 * (i + 0.5)) / n;
  const theta = GOLDEN * i;
  const r = Math.sqrt(1 - y * y);
  const lon = (Math.atan2(Math.sin(theta) * r, Math.cos(theta) * r) * 180) / Math.PI;
  const lat = (Math.asin(y) * 180) / Math.PI;
  return [lon, lat];
}

// Two characters of this alphabet encode a country index (0 to 4095).
export const CODE_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
