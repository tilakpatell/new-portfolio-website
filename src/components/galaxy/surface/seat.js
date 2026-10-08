// Standing something on uneven ground: its middle on the ground, it floats
// on the downhill side (a boulder's edge in the air, a hut's corner over a
// hollow). Seated, it goes down to the lowest ground under its footprint
// (its middle and eight points round it at `r`), so every side meets the
// ground and the uphill side sinks into it, as a real one would have; never
// more than `max` under its middle, so on a cliff it isn't swallowed. Pure.
//
//   seatY(heightAt, x, z, r, { max }) → the height to stand it at

const RING = Array.from({ length: 8 }, (_, i) => [Math.cos((i / 8) * Math.PI * 2), Math.sin((i / 8) * Math.PI * 2)]);

export function seatY(heightAt, x, z, r, { max = 2 } = {}) {
  const mid = heightAt(x, z);
  if (!(r > 0)) return mid;
  let low = mid;
  for (const [c, s] of RING) low = Math.min(low, heightAt(x + c * r, z + s * r));
  return Math.max(low, mid - max);
}
