// The universe map's sky (public/textures/universe/sky-glow.webp and
// sky-glow-sm.webp), baked from the 8K Milky Way (sky-hq.webp, which
// build-universe-textures.py --hq makes from Solar System Scope's) for
// skyShader.js, which draws the stars and the fine detail itself, at the
// screen's own resolution. So all its file has to give is the light of the
// band, clean: the baked stars taken out (a median filter), and the
// source's JPEG blocks and the WebP's own blurred away, then saved at a
// quality that doesn't put blocks back in (q97, with smart subsampling:
// still smaller than sky.webp's q88, as there's no fine detail left to
// keep). sky.webp, with its stars, stays as it was for the Earth's
// background (earth/scene.js).
//
//   node scripts/bake-universe-sky.mjs

import sharp from 'sharp';
import { statSync } from 'node:fs';

const DIR = 'public/textures/universe';
const MASTER = `${DIR}/sky-hq.webp`;
const OUT = [
  { file: `${DIR}/sky-glow.webp`, width: 4096 },
  { file: `${DIR}/sky-glow-sm.webp`, width: 2048 },
];

const { data, info } = await sharp(MASTER).raw().toBuffer({ resolveWithObject: true });
const starless = await sharp(data, { raw: info }).median(5).raw().toBuffer();
const clean = await sharp(starless, { raw: info }).blur(3).raw().toBuffer();
for (const { file, width } of OUT) {
  await sharp(clean, { raw: info })
    .resize(width, width / 2, { kernel: 'lanczos3' })
    .webp({ quality: 97, smartSubsample: true, effort: 6, preset: 'photo' })
    .toFile(file);
  console.log(`${file}: ${width}x${width / 2}, ${Math.round(statSync(file).size / 1024)} KB`);
}
