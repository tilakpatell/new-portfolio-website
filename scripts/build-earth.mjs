// The Earth world's maps (public/textures/earth/), from NASA Earth
// Observatory images (public domain). Download these into one folder, then
// run this on it:
//
//   https://eoimages.gsfc.nasa.gov/images/imagerecords/73000/73751/world.topo.bathy.200407.3x21600x10800.jpg
//     Blue Marble Next Generation, July 2004, with topography and bathymetry: the day side
//   https://eoimages.gsfc.nasa.gov/images/imagerecords/144000/144898/BlackMarble_2016_3km.jpg
//     Black Marble 2016: the lights on the night side
//   https://eoimages.gsfc.nasa.gov/images/imagerecords/57000/57747/cloud_combined_8192.tif
//     the clouds
//   https://eoimages.gsfc.nasa.gov/images/imagerecords/73000/73934/gebco_08_rev_elev_21600x10800.png
//     the height of the land, for its relief (a slope map the light can rake)
//   https://eoimages.gsfc.nasa.gov/images/imagerecords/73000/73963/gebco_08_rev_bath_21600x10800.png
//     the sea floor, for where the sea is (anything not white), so the sun glints off it
//
//   node scripts/build-earth.mjs <folder>
//
// Each map comes in a desktop size and a phone size (`-sm`). The slope map
// keeps east-west slope in red and north-south in green (128 is flat),
// already widened towards the poles, where a pixel is narrower.

import sharp from 'sharp';
import { mkdir, stat } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'public', 'textures', 'earth');
const from = process.argv[2];
if (!from) {
  console.error('usage: node scripts/build-earth.mjs <folder of NASA downloads>');
  process.exit(1);
}
const src = (f) => sharp(join(from, f), { limitInputPixels: false });
await mkdir(OUT, { recursive: true });

const report = async (file) => console.log(`${file}  ${((await stat(join(OUT, file))).size / 1048576).toFixed(2)} MB`);
const save = async (img, file, opts) => {
  await img.webp(opts).toFile(join(OUT, file));
  await report(file);
};

// the day side: 8K for a desktop, 4K for a phone
for (const [w, file, quality] of [
  [8192, 'day.webp', 74],
  [4096, 'day-sm.webp', 80],
]) {
  await save(src('world.topo.bathy.200407.3x21600x10800.jpg').resize(w, w / 2, { kernel: 'lanczos3' }), file, { quality, effort: 6 });
}

// the night side's lights
for (const [w, file] of [
  [8192, 'night.webp'],
  [4096, 'night-sm.webp'],
]) {
  await save(src('BlackMarble_2016_3km.jpg').resize(w, w / 2, { kernel: 'lanczos3' }), file, { quality: 76, effort: 6 });
}

// the clouds, as one channel
for (const [w, file] of [
  [4096, 'clouds.webp'],
  [2048, 'clouds-sm.webp'],
]) {
  await save(src('cloud_combined_8192.tif').resize(w, w / 2, { kernel: 'lanczos3' }).greyscale(), file, { quality: 78, effort: 6 });
}

// where the sea is: white for sea, black for land, softened a pixel at the coast
for (const [w, file] of [
  [4096, 'water.webp'],
  [2048, 'water-sm.webp'],
]) {
  const sea = await src('gebco_08_rev_bath_21600x10800.png').greyscale().threshold(254).negate().resize(w, w / 2, { kernel: 'cubic' }).blur(0.6).toBuffer();
  await save(sharp(sea).greyscale(), file, { quality: 85, effort: 6 });
}

// the land's slopes, from its height
for (const [w, file] of [
  [4096, 'relief.webp'],
  [2048, 'relief-sm.webp'],
]) {
  const h = w / 2;
  const { data } = await src('gebco_08_rev_elev_21600x10800.png').greyscale().resize(w, h, { kernel: 'cubic' }).blur(0.8).raw().toBuffer({ resolveWithObject: true });
  const out = Buffer.alloc(w * h * 3);
  const at = (x, y) => data[Math.min(h - 1, Math.max(0, y)) * w + (((x % w) + w) % w)];
  // a pixel's slope in height units per pixel, made into something the eye
  // reads as relief: scaled, and squashed so the Himalaya don't swamp the Alps
  const K = 9 * (w / 4096);
  const squash = (v) => 128 + 127 * Math.tanh(v);
  for (let y = 0; y < h; y++) {
    const lat = (0.5 - (y + 0.5) / h) * Math.PI;
    const widen = 1 / Math.max(0.12, Math.cos(lat));
    for (let x = 0; x < w; x++) {
      const dx = ((at(x + 1, y) - at(x - 1, y)) / 2) * widen;
      const dy = (at(x, y - 1) - at(x, y + 1)) / 2;
      const i = (y * w + x) * 3;
      out[i] = squash((dx * K) / 255);
      out[i + 1] = squash((dy * K) / 255);
      out[i + 2] = 128;
    }
  }
  await save(sharp(out, { raw: { width: w, height: h, channels: 3 } }), file, { quality: 88, effort: 6, smartSubsample: true });
}
