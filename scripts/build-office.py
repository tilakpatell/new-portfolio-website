"""Builds the Scranton office's 3D assets: photographed (PBR) textures and
scanned models, every one CC0 from Poly Haven (https://polyhaven.com) or
ambientCG (https://ambientcg.com), plus Poly Haven's office HDRI for the
light. They load only when the office is drawn in 3D.

- Textures: colour, normal and roughness maps at 1K (512 for small parts),
  saved as WebP in public/textures/office/.
- Models: Poly Haven's glTF at 1K, optimised with glTF Transform (meshopt
  geometry, WebP textures no bigger than they are seen, heavy meshes
  simplified) into single .glb files in public/models/office/. Only props
  that match the set: everything else is built to the show's reference
  photos in the browser.
- Light: poly_haven_studio (an office with its desks and screens), halved to
  512x256 with its full range kept, as public/hdri/office.hdr.

Run: python3 scripts/build-office.py   (needs Pillow, numpy, ffmpeg and npx)
"""

import io
import json
import pathlib
import subprocess
import urllib.request
import zipfile

import numpy as np
from PIL import Image, ImageEnhance

ROOT = pathlib.Path(__file__).resolve().parent.parent
CACHE = ROOT / 'node_modules/.cache/office'
UA = {'User-Agent': 'tilakpatell.com office build'}
TEX = ROOT / 'public/textures/office'
MODELS = ROOT / 'public/models/office'
HDRI = ROOT / 'public/hdri'


def get(url, name=None):
    CACHE.mkdir(parents=True, exist_ok=True)
    path = CACHE / (name or url.split('/')[-1].split('?')[0])
    if not path.exists():
        with urllib.request.urlopen(urllib.request.Request(url, headers=UA)) as r:
            path.write_bytes(r.read())
    return path


def ph_files(asset):
    return json.loads(get(f'https://api.polyhaven.com/files/{asset}', f'{asset}.files.json').read_bytes())


def save(img, rel, size, quality=84):
    path = TEX / rel
    path.parent.mkdir(parents=True, exist_ok=True)
    img = img.convert('RGB').resize(size, Image.LANCZOS)
    img.save(path, 'WEBP', quality=quality, method=6)
    print(f'{path.relative_to(ROOT)}: {size[0]}x{size[1]}, {path.stat().st_size // 1024} KB')


# ── Textures ────────────────────────────────────────────────────────────────
# name: (source, asset, size, {map: source map name})
TEXTURES = {
    # the bullpen's carpet: commercial loop pile, greyed to the set's blue-grey
    'carpet': ('acg', 'Carpet012', 512, {'color': 'Color', 'normal': 'NormalGL', 'rough': 'Roughness'}, {'saturation': 0.38, 'brightness': 1.18}),
    # the drop ceiling's tiles
    'ceiling': ('acg', 'OfficeCeiling001', 512, {'color': 'Color', 'normal': 'NormalGL', 'rough': 'Roughness'}),
    # painted plaster walls
    'wall': ('ph', 'beige_wall_001', 512, {'color': 'Diffuse', 'normal': 'nor_gl', 'rough': 'Rough'}),
    # office chair upholstery
    'fabric': ('acg', 'Fabric030', 256, {'color': 'Color', 'normal': 'NormalGL', 'rough': 'Roughness'}),
    # monitors, keyboards, the bins
    'plastic': ('acg', 'Plastic006', 256, {'normal': 'NormalGL', 'rough': 'Roughness'}),
    # the kitchen and the restrooms: greyed to the set's beige-grey vinyl
    'tiles': ('ph', 'anti_skid_tiles', 512, {'color': 'Diffuse', 'normal': 'nor_gl', 'rough': 'Rough'}, {'saturation': 0.12, 'brightness': 1.55}),
    # the desks: honey maple laminate, as on the set (Michael's darker, by tint)
    'wood': ('ph', 'cherry_veneer', 512, {'color': 'Diffuse', 'normal': 'nor_gl', 'rough': 'Rough'}),
}


def acg_map(asset, kind):
    z = zipfile.ZipFile(get(f'https://ambientcg.com/get?file={asset}_1K-JPG.zip', f'{asset}_1K-JPG.zip'))
    name = next(n for n in z.namelist() if n.endswith(f'_{kind}.jpg'))
    return Image.open(io.BytesIO(z.read(name)))


def ph_map(asset, kind):
    url = ph_files(asset)[kind]['1k']['jpg']['url']
    return Image.open(get(url))


def textures():
    for name, (src, asset, size, maps, *rest) in TEXTURES.items():
        adjust = rest[0] if rest else {}
        for out, kind in maps.items():
            img = acg_map(asset, kind) if src == 'acg' else ph_map(asset, kind)
            if out == 'color' and adjust:
                img = ImageEnhance.Color(img.convert('RGB')).enhance(adjust.get('saturation', 1))
                img = ImageEnhance.Brightness(img).enhance(adjust.get('brightness', 1))
            save(img, f'{name}_{out}.webp', (size, size), quality=78 if out == 'normal' else 80)


# ── Models ──────────────────────────────────────────────────────────────────
# name: (Poly Haven asset, texture size, simplify ratio or None)
MODELS_LIST = {
    # only what the set really has: the round white wall clock, potted plants,
    # yellow legal pads and pens. The desks, chairs, monitors, phones and the
    # rest are built in the browser to match the show (src/components/office/kit.js).
    'clock': ('wall_clock', 256, None),
    'plant': ('potted_plant_02', 256, 0.18),
    'notepads': ('office_notepads', 256, None),
    'stationery': ('stationery_supplies', 256, None),
}


def models():
    MODELS.mkdir(parents=True, exist_ok=True)
    for name, (asset, tex, simplify) in MODELS_LIST.items():
        entry = ph_files(asset)['gltf']['1k']['gltf']
        folder = CACHE / asset
        folder.mkdir(parents=True, exist_ok=True)
        gltf = folder / f'{asset}.gltf'
        if not gltf.exists():
            with urllib.request.urlopen(urllib.request.Request(entry['url'], headers=UA)) as r:
                gltf.write_bytes(r.read())
        for rel, f in entry.get('include', {}).items():
            path = folder / rel
            path.parent.mkdir(parents=True, exist_ok=True)
            if not path.exists():
                with urllib.request.urlopen(urllib.request.Request(f['url'], headers=UA)) as r:
                    path.write_bytes(r.read())
        out = MODELS / f'{name}.glb'
        cmd = ['npx', '--yes', '@gltf-transform/cli@4', 'optimize', str(gltf), str(out), '--compress', 'meshopt', '--texture-compress', 'webp', '--texture-size', str(tex), '--palette', 'false', '--join', 'false', '--flatten', 'false']
        if simplify:
            cmd += ['--simplify', 'true', '--simplify-ratio', str(simplify), '--simplify-error', '0.002']
        else:
            cmd += ['--simplify', 'false']
        subprocess.run(cmd, check=True, capture_output=True)
        print(f'{out.relative_to(ROOT)}: {out.stat().st_size // 1024} KB')


# ── Light ───────────────────────────────────────────────────────────────────
def rgbe_rle(row):
    """One scanline of RGBE bytes, run-length encoded the way Radiance does."""
    w = row.shape[0]
    out = bytearray([2, 2, (w >> 8) & 0xFF, w & 0xFF])
    for c in range(4):
        data = row[:, c]
        i = 0
        while i < w:
            run = 1
            while i + run < w and run < 127 and data[i + run] == data[i]:
                run += 1
            if run >= 4:
                out += bytes([128 + run, data[i]])
                i += run
                continue
            j = i
            while j < w and j - i < 128:
                if j + 3 < w and data[j] == data[j + 1] == data[j + 2] == data[j + 3]:
                    break
                j += 1
            out += bytes([j - i]) + bytes(data[i:j])
            i = j
    return out


def hdri():
    url = json.loads(get('https://api.polyhaven.com/files/poly_haven_studio', 'poly_haven_studio.files.json').read_bytes())['hdri']['1k']['hdr']['url']
    src = get(url)
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', str(src), '-f', 'rawvideo', '-pix_fmt', 'gbrpf32le', '-'], check=True, capture_output=True).stdout
    w, h = 1024, 512
    g, b, r = np.frombuffer(raw, dtype=np.float32).reshape(3, h, w)
    rgb = np.stack([r, g, b], axis=-1).astype(np.float64)
    # halve by averaging 2x2 blocks: the light's energy is kept, nothing clips
    rgb = rgb.reshape(h // 2, 2, w // 2, 2, 3).mean(axis=(1, 3))
    m = rgb.max(axis=-1)
    e = np.where(m > 1e-32, np.floor(np.log2(np.maximum(m, 1e-32))) + 1, 0)
    scale = np.where(m > 1e-32, 256.0 / np.exp2(e), 0)
    rgbe = np.zeros((h // 2, w // 2, 4), dtype=np.uint8)
    rgbe[..., :3] = np.clip(rgb * scale[..., None], 0, 255).astype(np.uint8)
    rgbe[..., 3] = np.where(m > 1e-32, e + 128, 0).astype(np.uint8)
    body = b''.join(rgbe_rle(row) for row in rgbe)
    HDRI.mkdir(parents=True, exist_ok=True)
    out = HDRI / 'office.hdr'
    out.write_bytes(b'#?RADIANCE\nFORMAT=32-bit_rle_rgbe\n\n' + f'-Y {h // 2} +X {w // 2}\n'.encode() + body)
    print(f'{out.relative_to(ROOT)}: {w // 2}x{h // 2}, {out.stat().st_size // 1024} KB, peak {rgb.max():.0f}')


if __name__ == '__main__':
    textures()
    models()
    hdri()
