// The share of a render's pixels that are not the background: a model that
// fails to draw leaves a canvas of nothing but its clear colour, which a page
// error or a console message doesn't always say.
//
//   coverage(png, { bg, tolerance }) → 0 to 1
//
// `bg` is the background as [r, g, b], else the top-left pixel's (the views
// frame the model in the middle); a pixel within `tolerance` of it on every
// channel counts as background, so dithering and antialiasing don't.

import sharp from 'sharp';

export async function coverage(png, { bg, tolerance = 6 } = {}) {
  const { data, info } = await sharp(png).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const [r, g, b] = bg ?? [data[0], data[1], data[2]];
  let drawn = 0;
  for (let i = 0; i < data.length; i += info.channels) {
    if (Math.abs(data[i] - r) > tolerance || Math.abs(data[i + 1] - g) > tolerance || Math.abs(data[i + 2] - b) > tolerance) drawn++;
  }
  return drawn / (info.width * info.height);
}
