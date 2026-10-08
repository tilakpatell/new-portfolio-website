"""Where ESO's Milky Way panorama really points, for the universe map's sky.

The panorama (eso0932a, scripts/bake-universe-sky.mjs) is a mosaic: laid
out as galactic longitude and latitude, but turned a few degrees off the
true galactic frame, and bent here and there where its frames were stitched.
The bake puts the light where the true stars are, so the photo
has to be brought to them. This draws the Hipparcos stars (to magnitude 8)
as the photo would show them, and measures, patch by patch of sky, how far
the photo's own stars sit off them (where the two patterns correlate best),
then fits

- a rotation (Kabsch's, the photo's frame from the true one), measured
  again closer each time, then
- what's left, a smooth bend: a grid every 15 degrees of how far the photo
  sits off, longitude and latitude, from the patches round each node (a
  gaussian weighting, 10 degrees), nothing past latitude 75,

and writes both to scripts/data/universe-sky-fit.json, which the bake reads.

    python3 scripts/fit-universe-sky.py [image]

(image: a panorama in ESO's frame to measure instead, by default the source
itself; the bake's --check writes its result back into that frame, and run
on that this should find no rotation and no bend left.)
"""

import json
import sys

import numpy as np
from PIL import Image, ImageFilter

Image.MAX_IMAGE_PIXELS = None
SOURCE = sys.argv[1] if len(sys.argv) > 1 else 'scripts/.cache/eso0932a.tif'
# Hipparcos as tab-separated values, fetched by hand once (the script that
# fetched it went with the map's old star field):
# https://vizier.cds.unistra.fr/viz-bin/asu-tsv?-source=I/239/hip_main&-out=HIP,_RA.icrs,_DE.icrs,Vmag,B-V&-out.max=unlimited
CATALOGUE = 'scripts/.cache/hip_main.tsv'
OUT = 'scripts/data/universe-sky-fit.json'
FAINTEST = 8
GRID = 15  # degrees between the bend's nodes
TILE = 12  # degrees: the patches of sky measured
SPREAD = 10  # degrees: the gaussian each node weighs its stars by
D = np.pi / 180

# ICRS to galactic (the IAU's rotation, J2000)
TO_GALACTIC = np.array([
    [-0.0548755604162154, -0.873437090234885, -0.4838350155487132],
    [0.4941094278755837, -0.4448296299600112, 0.7469822444972189],
    [-0.8676661490190047, -0.1980763734312015, 0.4559837761750669],
])


def unit(l, b):
    return np.stack([np.cos(b * D) * np.cos(l * D), np.cos(b * D) * np.sin(l * D), np.sin(b * D)], -1)


def lonlat(v):
    return np.degrees(np.arctan2(v[..., 1], v[..., 0])) % 360, np.degrees(np.arcsin(np.clip(v[..., 2], -1, 1)))


image = Image.open(SOURCE).convert('L')
W, H = image.size
# the photo's points of light: what stands over the light round it
points = np.clip(np.asarray(image).astype(float) - np.asarray(image.filter(ImageFilter.GaussianBlur(6))).astype(float), 0, None)


def pixel(l, b):  # ESO's frame: l 0 in the middle, rising to the left, north up
    return ((180 - l) / 360 * W - 0.5) % W, (90 - b) / 180 * H - 0.5


stars = []
for line in open(CATALOGUE):
    f = line.split('\t')
    if len(f) < 5 or not f[0].strip().isdigit():
        continue
    try:
        ra, dec, v = float(f[1]), float(f[2]), float(f[3])
    except ValueError:
        continue
    if v <= FAINTEST:
        stars.append((ra, dec, v))
ra, dec, vmag = map(np.array, zip(*stars))
true = np.stack([np.cos(dec * D) * np.cos(ra * D), np.cos(dec * D) * np.sin(ra * D), np.sin(dec * D)], -1) @ TO_GALACTIC.T
flux = 10 ** (-0.4 * (vmag - FAINTEST))


def drawn(where):
    """the catalogue's stars drawn as the photo would show them, at `where`
    (photo-frame directions)"""
    l, b = lonlat(where)
    px, py = pixel(l, b)
    sky = np.zeros((H, W))
    ok = (py >= 0) & (py < H - 1)
    np.add.at(sky, (py[ok].round().astype(int), px[ok].round().astype(int) % W), flux[ok])
    sky = np.sqrt(sky)
    k = np.exp(-np.arange(-4, 5) ** 2 / (2 * 1.5**2))
    k /= k.sum()
    sky = sum(w * np.roll(sky, s, 1) for s, w in zip(range(-4, 5), k))
    return sum(w * np.roll(sky, s, 0) for s, w in zip(range(-4, 5), k))


def offsets(sky, reach):
    """how far the photo sits off `sky`, tile by tile (TILE degrees, or wider
    for a longer reach; half overlapping), each where its correlation peaks
    within `reach` pixels; → tile centres (l, b) and offsets (pixels), the
    clear ones"""
    t = max(int(TILE / 360 * W), 3 * reach)
    out = []
    for y0 in range(int(H * 15 / 180), int(H * 165 / 180) - t, t // 2):
        for x0 in range(0, W, t // 2):
            xs = np.arange(x0, x0 + t) % W
            a = points[y0:y0 + t][:, xs]
            g = sky[y0:y0 + t][:, xs]
            if g.std() == 0 or a.std() == 0:
                continue
            c = np.real(np.fft.ifft2(np.fft.fft2(a - a.mean()) * np.conj(np.fft.fft2(g - g.mean()))))
            c = np.fft.fftshift(c)
            m = t // 2
            win = c[m - reach:m + reach + 1, m - reach:m + reach + 1]
            yy, xx = np.unravel_index(np.argmax(win), win.shape)
            if not (0 < yy < 2 * reach and 0 < xx < 2 * reach):
                continue
            # clear: the peak well over the rest of the window
            if win.max() < 6 * np.abs(win).mean():
                continue
            sub = lambda a0, a1, a2: 0.5 * (a0 - a2) / (a0 - 2 * a1 + a2)  # a parabola through the peak
            dy = yy - reach + sub(win[yy - 1, xx], win[yy, xx], win[yy + 1, xx])
            dx = xx - reach + sub(win[yy, xx - 1], win[yy, xx], win[yy, xx + 1])
            cx, cy = (x0 + t / 2) % W, y0 + t / 2
            out.append((180 - (cx + 0.5) / W * 360, 90 - (cy + 0.5) / H * 180, dx, dy))
    o = np.array(out)
    return o[:, 0], o[:, 1], o[:, 2], o[:, 3]


def kabsch(P, T, w):
    U, _, Vt = np.linalg.svd((P * w[:, None]).T @ T)
    return U @ np.diag([1, 1, np.sign(np.linalg.det(U @ Vt))]) @ Vt


def misses(l, b, dx, dy):  # pixel offsets → degrees on the sky
    return np.hypot(dx * 360 / W * np.cos(b * D), dy * 180 / H)


# the rotation: from each clear tile, the place at its middle and where the
# photo has it; fitted, the stars redrawn where it puts them, measured again
R = np.eye(3)
for reach in (160, 40, 12):
    l, b, dx, dy = offsets(drawn(true @ R.T), reach)
    print(f'rotated {np.degrees(np.arccos(min(1, (np.trace(R) - 1) / 2))):.2f} deg: {len(l)} clear tiles, median miss {np.median(misses(l, b, dx, dy)):.3f} deg')
    seen = unit(l - dx * 360 / W, b - dy * 180 / H)  # where the photo has what R put at the tile's middle
    at = unit(l, b) @ R  # (back to the true frame)
    R = kabsch(seen, at, np.cos(b * D))
l, b, dx, dy = offsets(drawn(true @ R.T), 12)
print(f'rotated {np.degrees(np.arccos(min(1, (np.trace(R) - 1) / 2))):.2f} deg: {len(l)} clear tiles, median miss {np.median(misses(l, b, dx, dy)):.3f} deg')

# the bend: the tiles' offsets left after the rotation, smoothed onto a grid
lons = np.arange(0, 360, GRID)
lats = np.arange(-90, 90 + GRID, GRID)
dl = -dx * 360 / W * np.cos(b * D)  # degrees on the sky, photo minus rotated (longitude rises to the left)
db = -dy * 180 / H
c = unit(l, b)
bend = []
for lat in lats:
    row = []
    for lon in lons:
        w = np.cos(b * D) * np.exp(-(np.degrees(np.arccos(np.clip(c @ unit(lon, lat), -1, 1))) / SPREAD) ** 2 / 2)
        fade = np.clip((75 - abs(lat)) / 15, 0, 1)
        row.append([round(float(fade * (w @ dl) / w.sum()), 4), round(float(fade * (w @ db) / w.sum()), 4)] if w.sum() > 0.3 else [0, 0])
    bend.append(row)
B = np.array(bend)


def bent(where):  # where the photo has the places at `where` (rotated)
    l, b = lonlat(where)
    i, j = (b + 90) / GRID, l / GRID
    i0 = np.clip(np.floor(i).astype(int), 0, len(lats) - 2)
    j0 = np.floor(j).astype(int) % len(lons)
    fi, fj = i - i0, j - np.floor(j)
    j1 = (j0 + 1) % len(lons)
    o = (B[i0, j0] * ((1 - fi) * (1 - fj))[:, None] + B[i0, j1] * ((1 - fi) * fj)[:, None]
         + B[i0 + 1, j0] * (fi * (1 - fj))[:, None] + B[i0 + 1, j1] * (fi * fj)[:, None])
    return unit(l + o[:, 0] / np.maximum(np.cos(b * D), 0.05), b + o[:, 1])


l2, b2, dx2, dy2 = offsets(drawn(bent(true @ R.T)), 12)
print(f'bent at most {np.abs(B).max():.2f} deg: {len(l2)} clear tiles, median miss {np.median(misses(l2, b2, dx2, dy2)):.3f} deg, 90th {np.percentile(misses(l2, b2, dx2, dy2), 90):.3f}')

if len(sys.argv) == 1:
    with open(OUT, 'w') as f:
        json.dump({'source': 'eso0932a', 'rotation': [[round(float(x), 10) for x in r] for r in R], 'grid': GRID, 'bend': bend}, f, separators=(',', ':'))
        f.write('\n')
    print(f'{OUT} written')
