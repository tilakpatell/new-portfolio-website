"""Builds the universe map's textures into public/textures/universe/.

Sources (credited on the map itself, in its panel):
- Planet maps by Solar System Scope (https://www.solarsystemscope.com/textures/),
  CC BY 4.0, fetched from their copies on Wikimedia Commons: Mercury under the
  Death Star's plates, and Earth as it is. (The fandoms' planets are baked by
  scripts/build-fandom-planets.mjs.)
- Metal plates and paper from ambientCG (https://ambientcg.com), CC0: the
  Death Star's and Cybertron's panels, the stations' hulls, the paper's grain.

- The sky: Solar System Scope's Milky Way (8K, CC BY 4.0), brought up from
  its very dim original so the band of the galaxy shows (its glow brought up
  apart from its stars, so they stay pinpoints), its arms cooled toward blue
  and its core warmed, with a fine field of faint stars of our own laid
  over, 4096x2048 (2048 on phones).
- Earth's night lights (Solar System Scope, from Commons' 1920 px copy), and
  a roughness map made from its day map, so the oceans catch the sun.

Each planet map is 1024x512 WebP (Earth 2048x1024) with a half-size `-sm`
copy for phones; the tiling materials are 512 px.

`--hq` builds the sharper set instead, for strong graphics cards (lib/detail's
'ultra' level: planets.js picks the `-hq` file): every planet map at twice
its size (2048x1024, Earth and its night 4096x2048) and the sky at 8192x4096,
worked from Solar System Scope's own 8K originals (their site serves them;
Commons rate-limits originals from some networks and caps thumbnails at
3840 px). It writes only the `-hq` files: the standard set stays as it is.

`--ultra` builds Earth's 8192x4096 day map from Solar System Scope's 8K
original as `earth-8k.ktx2` (UASTC through scripts/ktx2.mjs, flipped for
three's UVs), worn near at ultra (planetMaps.js's nearSet), and lists it in
k8.json; nothing else. Too big to keep in the repository: made on the
owner's machine and published with the site.

Run: python3 scripts/build-universe-textures.py [--hq | --ultra]   (needs Pillow and numpy)
"""
import io
import json
import pathlib
import sys
import time
import urllib.parse
import urllib.request
import zipfile

import numpy as np
from PIL import Image, ImageFilter

ROOT = pathlib.Path(__file__).resolve().parent.parent
CACHE = ROOT / 'node_modules/.cache/universe'
OUT = ROOT / 'public/textures/universe'
UA = {'User-Agent': 'tilakpatell.com universe build (https://tilakpatell.com)'}

HQ = '--hq' in sys.argv  # the sharper set for strong graphics cards (see above)
ULTRA = '--ultra' in sys.argv  # Earth's 8192 day map, for ultra (see above)
SKY = 'https://upload.wikimedia.org/wikipedia/commons/8/85/Solarsystemscope_texture_8k_stars_milky_way.jpg'
# Solar System Scope's own downloads (CC BY 4.0), the 8K originals the -hq set is worked from
SSS_HQ = 'https://www.solarsystemscope.com/textures/download/{size}_{name}.jpg'
NIGHT = 'https://upload.wikimedia.org/wikipedia/commons/thumb/2/2f/Solarsystemscope_texture_2k_earth_nightmap.jpg/1920px-Solarsystemscope_texture_2k_earth_nightmap.jpg'
SSS = ['jupiter', 'saturn', 'mars', 'mercury', 'venus_surface', 'venus_atmosphere', 'earth_daymap', 'earth_clouds', 'sun']
ACG = ['MetalPlates001', 'MetalPlates006', 'MetalPlates014', 'Paper001']


def fetch(url, name):
    CACHE.mkdir(parents=True, exist_ok=True)
    path = CACHE / name
    if path.exists() and path.stat().st_size:
        return path.read_bytes()
    for attempt in range(6):
        try:
            data = urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=90).read()
            path.write_bytes(data)
            time.sleep(1.5)  # Commons asks for a gentle pace
            return data
        except Exception as e:  # noqa: BLE001
            print('  retrying', name, e)
            time.sleep(4 * (attempt + 1))
    raise RuntimeError(f'could not fetch {url}')


def commons_urls():
    titles = '|'.join(f'File:Solarsystemscope_texture_2k_{n}.jpg' for n in SSS)
    q = urllib.parse.urlencode({'action': 'query', 'titles': titles, 'prop': 'imageinfo', 'iiprop': 'url', 'format': 'json'})
    data = json.loads(fetch('https://commons.wikimedia.org/w/api.php?' + q, 'commons.json'))
    urls = {}
    for page in data['query']['pages'].values():
        name = page['title'].replace('File:Solarsystemscope texture 2k ', '').replace('.jpg', '').replace(' ', '_')
        urls[name] = page['imageinfo'][0]['url'].split('?')[0]
    return urls


def planet(name, urls):
    if HQ:
        size = '4k' if name == 'venus_atmosphere' else '8k'  # (the clouds come no bigger)
        img = Image.open(io.BytesIO(fetch(SSS_HQ.format(size=size, name=name), f'{size}_{name}.jpg'))).convert('RGB')
    else:
        img = Image.open(io.BytesIO(fetch(urls[name], f'{name}.jpg'))).convert('RGB')
    return np.asarray(img, dtype=np.float32) / 255


def material(asset, kind):
    data = fetch(f'https://ambientcg.com/get?file={asset}_1K-JPG.zip', f'{asset}.zip')
    with zipfile.ZipFile(io.BytesIO(data)) as z:
        name = next(n for n in z.namelist() if n.endswith(f'_{kind}.jpg'))
        return Image.open(io.BytesIO(z.read(name))).convert('RGB')


def arr(img):
    return np.asarray(img, dtype=np.float32) / 255


def img(a):
    return Image.fromarray((np.clip(a, 0, 1) * 255).astype(np.uint8))


def size(a, w, h):
    return arr(img(a).resize((w, h), Image.LANCZOS))


def lum(a):
    return a[..., 0] * 0.299 + a[..., 1] * 0.587 + a[..., 2] * 0.114


def stretch(l, lo=2, hi=98):
    a, b = np.percentile(l, [lo, hi])
    return np.clip((l - a) / max(b - a, 1e-6), 0, 1)


def hexrgb(h):
    return np.array([int(h[i:i + 2], 16) for i in (1, 3, 5)], dtype=np.float32) / 255


def ramp(l, stops):
    """Colour a 0-1 field along [(t, '#rrggbb'), ...]."""
    ts = np.array([t for t, _ in stops])
    cs = np.stack([hexrgb(c) for _, c in stops])
    return np.stack([np.interp(l, ts, cs[:, i]) for i in range(3)], axis=-1)


def highpass(l, radius):
    blur = arr(img(np.stack([l] * 3, -1)).filter(ImageFilter.GaussianBlur(radius)))[..., 0]
    return l - blur


def tile(texture, w, h, nx, ny):
    """A material tiled nx by ny across a w x h map."""
    t = texture.resize((w // nx, h // ny), Image.LANCZOS)
    out = Image.new('RGB', (w, h))
    for i in range(nx):
        for j in range(ny):
            out.paste(t, (i * (w // nx), j * (h // ny)))
    return arr(out.resize((w, h)))


def blob_mask(w, h, u, v, ru, rv, soft=0.5):
    """A soft elliptical mask on an equirectangular map, wrapping in u."""
    x = np.linspace(0, 1, w, endpoint=False)[None, :]
    y = np.linspace(0, 1, h)[:, None]
    du = np.minimum(np.abs(x - u), 1 - np.abs(x - u)) / ru
    dv = np.abs(y - v) / rv
    d = np.sqrt(du ** 2 + dv ** 2)
    return np.clip((1 - d) / soft, 0, 1)


def noise(w, h, seed, scale=8, octaves=4):
    rng = np.random.default_rng(seed)
    out = np.zeros((h, w), np.float32)
    amp = 1.0
    for o in range(octaves):
        n = rng.random((max(2, int(scale * 2 ** o / 2)), max(2, int(scale * 2 ** o)))).astype(np.float32)
        out += amp * arr(img(np.stack([n] * 3, -1)).resize((w, h), Image.BICUBIC))[..., 0]
        amp /= 2
    return stretch(out, 1, 99)


def panels(w, h, cell, seed, depth=3):
    """Hull panels: a grid of cells, each split again at random, so the
    plates come in many sizes. Returns a list of (x0, y0, x1, y1)."""
    rng = np.random.default_rng(seed)
    out = []

    def split(x0, y0, x1, y1, d):
        if d == 0 or (x1 - x0) < 6 or (y1 - y0) < 4 or rng.random() < 0.25:
            out.append((x0, y0, x1, y1))
            return
        if (x1 - x0) > (y1 - y0) * 1.5 or ((y1 - y0) <= (x1 - x0) * 1.5 and rng.random() < 0.5):
            m = int(x0 + (x1 - x0) * rng.uniform(0.3, 0.7))
            split(x0, y0, m, y1, d - 1)
            split(m, y0, x1, y1, d - 1)
        else:
            m = int(y0 + (y1 - y0) * rng.uniform(0.3, 0.7))
            split(x0, y0, x1, m, d - 1)
            split(x0, m, x1, y1, d - 1)

    for x in range(0, w, cell * 2):
        for y in range(0, h, cell):
            split(x, y, min(w, x + cell * 2), min(h, y + cell), depth)
    return out


def plate_maps(w, h, rects, seed, sd):
    """A shade per plate, and the seams between them."""
    rng = np.random.default_rng(seed)
    shade = np.zeros((h, w), np.float32)
    seam = np.zeros((h, w), np.float32)
    for x0, y0, x1, y1 in rects:
        shade[y0:y1, x0:x1] = rng.normal(0, sd)
        seam[y0:y0 + 1, x0:x1] = 1
        seam[y0:y1, x0:x0 + 1] = 1
    return shade, seam


def normal_map(height, strength):
    """A tangent-space normal map from a 0-1 height field on an
    equirectangular map (wrapping round in u; +v is up the image)."""
    h = arr(img(np.stack([height] * 3, -1)).filter(ImageFilter.GaussianBlur(1.2)))[..., 0]
    du = np.roll(h, -1, axis=1) - np.roll(h, 1, axis=1)
    dv = np.vstack([h[:1], h[:-2], h[-2:-1]]) - np.vstack([h[1:2], h[2:], h[-1:]])
    n = np.stack([-du * strength, -dv * strength, np.ones_like(h)], -1)
    n /= np.linalg.norm(n, axis=-1, keepdims=True)
    return n * 0.5 + 0.5


def save(a, name, full=(1024, 512), small=True, quality=84, hq=True):
    """The standard file and its -sm half; with --hq, only the -hq file at
    twice the standard size (a map that has no sharper version, `hq=False`,
    is skipped: planets.js falls back to the standard file)."""
    OUT.mkdir(parents=True, exist_ok=True)
    im = img(a)
    if HQ:
        if not hq:
            return
        im.resize((full[0] * 2, full[1] * 2), Image.LANCZOS).save(OUT / f'{name}-hq.webp', quality=quality, method=6)
        print(f'  {name}-hq.webp')
        return
    im.resize(full, Image.LANCZOS).save(OUT / f'{name}.webp', quality=quality, method=6)
    if small:
        im.resize((full[0] // 2, full[1] // 2), Image.LANCZOS).save(OUT / f'{name}-sm.webp', quality=quality - 2, method=6)
    print(f'  {name}.webp')


def ultra():
    """Earth's day map at 8192x4096, as KTX2, listed in k8.json."""
    import subprocess
    OUT.mkdir(parents=True, exist_ok=True)
    day = Image.open(io.BytesIO(fetch(SSS_HQ.format(size='8k', name='earth_daymap'), '8k_earth_daymap.jpg'))).convert('RGB').resize((8192, 4096), Image.LANCZOS)
    png = CACHE / 'earth-8k.png'
    day.save(png)
    subprocess.run(['node', str(ROOT / 'scripts/ktx2.mjs'), 'convert', str(png), '--out', str(CACHE), '--flip'], check=True)
    (CACHE / 'earth-8k.ktx2').replace(OUT / 'earth-8k.ktx2')
    listed = OUT / 'k8.json'
    names = set(json.loads(listed.read_text())) if listed.exists() else set()
    listed.write_text(json.dumps(sorted(names | {'earth'})) + '\n')
    print('  earth-8k.ktx2')


def main():
    if ULTRA:
        return ultra()
    urls = None if HQ else commons_urls()
    # the maps are worked at twice the standard planet size (the -hq set at twice that again)
    W, H = (4096, 2048) if HQ else (2048, 1024)
    P = {n: size(planet(n, urls), W, H) for n in SSS}
    plates1 = material('MetalPlates001', 'Color')

    # (The fandoms' planets, Music, Marvel, Breaking Bad, Middle-earth, Rick
    # and Morty and the Office, are baked by scripts/build-fandom-planets.mjs,
    # at all three sizes, -hq included: none of them is written here.)

    # The Death Star: Mercury's grey under hull plates, the trench round the
    # middle and the superlaser's dish
    base = ramp(stretch(lum(P['mercury'])), [(0, '#41464d'), (1, '#b9bec6')])
    plates = lum(tile(plates1, W, H, 32, 16))
    plates = np.clip(0.75 + highpass(plates, 2) * 3, 0, 1.2)
    # hull plates of many sizes, each a shade of its own, with seams between,
    # inside the station's big sectors
    patch, seams = plate_maps(W, H, panels(W, H, 32, 5, 3), 6, 0.035)
    big = (((np.arange(W) % (W // 24)) < 2)[None, :] | ((np.arange(H) % (H // 12)) < 2)[:, None]).astype(np.float32)
    ds = base * 0.4 + 0.5 * np.array([0.82, 0.84, 0.88])
    ds = ds * (0.85 + plates[..., None] * 0.15) + patch[..., None]
    ds = ds * (1 - seams[..., None] * 0.18) * (1 - big[..., None] * 0.25)
    y = np.linspace(0, 1, H)[:, None, None]
    trench = (np.abs(y - 0.5) < 0.012).astype(np.float32)
    lip = ((y > 0.5 - 0.016) & (y < 0.5 - 0.012)).astype(np.float32)
    ds = ds * (1 - trench * 0.75) + lip * 0.25
    du, dv = 0.27, 0.32
    k = 1 / np.cos((0.5 - dv) * np.pi)
    x = np.linspace(0, 1, W, endpoint=False)[None, :]
    yy = np.linspace(0, 1, H)[:, None]
    r = np.sqrt(((x - du) / k) ** 2 * 4 + (yy - dv) ** 2)  # u spans twice v
    dish = np.clip(1 - r / 0.05, 0, 1)
    rings = 0.5 + 0.5 * np.cos(r * 380)
    ds = ds * (1 - (dish > 0)[..., None] * (0.35 + 0.15 * rings[..., None])) - (dish > 0.85)[..., None] * 0.15
    save(ds, 'starwars')
    save(np.clip(1 - r / 0.006, 0, 1)[..., None] * hexrgb('#7dff7a'), 'starwars-glow', small=False, hq=False)

    # (Cybertron's maps are worked out on their own: scripts/build-cybertron-planet.mjs)

    # Earth, as it is, and its clouds; Alderaan is Earth turned over and greener
    save(P['earth_daymap'], 'earth', full=(2048, 1024))
    # the oceans smooth (they catch the sun), the land rough
    e = P['earth_daymap']
    sea = np.clip((e[..., 2] - np.maximum(e[..., 0], e[..., 1]) - 0.04) * 8, 0, 1)
    save(np.stack([0.92 - sea * 0.55] * 3, -1), 'earth-rough', small=False, hq=False)
    night = arr(Image.open(io.BytesIO(fetch(SSS_HQ.format(size='8k', name='earth_nightmap'), '8k_earth_nightmap.jpg') if HQ else fetch(NIGHT, 'earth_nightmap.jpg'))).convert('RGB').resize((W, H), Image.LANCZOS))
    save(np.clip(night * np.array([1.15, 0.95, 0.7]) * 1.3, 0, 1), 'earth-night', full=(2048, 1024))
    save(np.stack([lum(P['earth_clouds'])] * 3, -1), 'earth-clouds')
    e = P['earth_daymap'][::-1]
    alderaan = e * np.array([0.85, 1.05, 0.95]) + np.stack([lum(P['earth_clouds'])[::-1]] * 3, -1) * 0.45
    save(alderaan, 'alderaan', full=(512, 256), small=False, hq=False)
    save(P['sun'], 'sun', full=(1024, 512))

    # the sky: the Milky Way, brought up from its very dim original (most of
    # it is a hair off black) so the galaxy's band shows. The glow and the
    # stars are brought up apart: the glow (an opening, min then max, takes
    # the points out) a lot, with a toe so the near-black stays black, and the
    # stars only a little, so they stay pinpoints rather than blown-out
    # squares. Where the glow is faint it's blurred more, as the original's
    # JPEG blocks are all there is there; a hair of dither hides the steps.
    # (for -hq the whole thing is done at the original's 8192, every radius
    # doubled and the star field four times as many points, so it reads the
    # same as the standard sky, only sharper)
    S = 2 if HQ else 1
    sky = Image.open(io.BytesIO(fetch(SSS_HQ.format(size='8k', name='stars_milky_way'), '8k_stars_milky_way.jpg') if HQ else fetch(SKY, 'stars_milky_way.jpg'))).convert('RGB').resize((4096 * S, 2048 * S), Image.LANCZOS)
    opened = sky.filter(ImageFilter.MinFilter(5 if S == 1 else 9)).filter(ImageFilter.MaxFilter(5 if S == 1 else 9))
    sharp, smooth = arr(opened.filter(ImageFilter.GaussianBlur(2.5 * S))), arr(opened.filter(ImageFilter.GaussianBlur(9 * S)))
    t = np.clip((smooth.mean(-1, keepdims=True) - 0.004) / 0.026, 0, 1)
    t = t * t * (3 - 2 * t)
    glow = smooth * (1 - t) + sharp * t
    points = np.clip(arr(sky) - sharp, 0, None)
    soft = lambda x: 1 - np.exp(-x)
    # the glow with a harder toe (the dark stays dark) and a higher shoulder,
    # its faint arms tinted toward blue and its bright core toward warm, a
    # touch more saturated; the source's stars kept as pinpoints
    g = soft(np.clip(glow - 1.1 / 255, 0, None) * 8.5)
    bright = g.mean(-1, keepdims=True)  # (not `lum`: that's the helper above, and a local by that name shadows it for the whole function)
    g = np.clip(g * (np.array([0.82, 0.9, 1.12], np.float32) * (1 - bright) + np.array([1.1, 0.98, 0.86], np.float32) * bright), 0, 1)
    mean = g.mean(-1, keepdims=True)
    g = np.clip(mean + (g - mean) * 1.35, 0, 1)
    stars = soft(points * 2.2) * 0.85
    # and a fine layer of faint stars of our own, so the dark isn't flat
    rng = np.random.default_rng(7)
    h, w = g.shape[:2]
    field = np.zeros((h, w), np.float32)
    n = 26000 * S * S
    ys, xs = rng.integers(0, h, n), rng.integers(0, w, n)
    field[ys, xs] = rng.random(n) ** 3 * 0.55 + 0.04
    field = arr(Image.fromarray((field * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(0.6 * S))) * 1.6
    sky = np.clip(g * 0.95 + stars + np.stack([field * 0.9, field * 0.95, field], -1), 0, 1) ** 0.82
    sky += (rng.random(sky.shape[:2])[..., None] - 0.5) / 255
    save(sky, 'sky', full=(4096, 2048), quality=88 if S == 1 else 84)

    if HQ:
        return  # (the tiling materials have no sharper set: they're 1K sources tiled)
    # Tiling materials for the stations and ships
    for asset, short in (('MetalPlates001', 'plates'), ('MetalPlates014', 'hull')):
        for kind, suffix in (('Color', ''), ('NormalGL', '-normal'), ('Roughness', '-rough')):
            im = material(asset, kind).resize((512, 512), Image.LANCZOS)
            OUT.mkdir(parents=True, exist_ok=True)
            im.save(OUT / f'{short}{suffix}.webp', quality=86, method=6)
            print(f'  {short}{suffix}.webp')
    material('Paper001', 'NormalGL').resize((512, 512), Image.LANCZOS).save(OUT / 'paper-normal.webp', quality=86, method=6)
    print('  paper-normal.webp')


if __name__ == '__main__':
    main()
