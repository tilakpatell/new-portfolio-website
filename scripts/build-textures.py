"""Downloads and prepares the photographed (PBR) textures the music room and
the Scranton office use. Every one is CC0, from Poly Haven
(https://polyhaven.com, via its public API) or ambientCG
(https://ambientcg.com): free for any use, no credit required, though both
are credited on the pages anyway.

Each map is fetched at 1K or 2K, cropped or rotated as the surface needs,
and saved as WebP under public/textures/ at the size it is shown, so nothing
heavier than the screen can use is downloaded.

Run: python3 scripts/build-textures.py   (needs Pillow with WebP)
"""

import io
import json
import pathlib
import urllib.request
import zipfile

from PIL import Image, ImageEnhance

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = ROOT / 'public/textures'
CACHE = ROOT / 'node_modules/.cache/textures'
UA = {'User-Agent': 'tilakpatell.com texture build'}


def get(url):
    CACHE.mkdir(parents=True, exist_ok=True)
    path = CACHE / url.split('/')[-1].split('?')[0]
    if not path.exists():
        with urllib.request.urlopen(urllib.request.Request(url, headers=UA)) as r:
            path.write_bytes(r.read())
    return path.read_bytes()


def polyhaven(asset, kind, res='1k'):
    """One map of a Poly Haven texture: Diffuse, nor_gl, Rough, AO, arm, ..."""
    files = json.loads(get(f'https://api.polyhaven.com/files/{asset}?x=.json'))
    return Image.open(io.BytesIO(get(files[kind][res]['jpg']['url'])))


def ambientcg(asset, kind, res='1K'):
    """One map of an ambientCG material: Color, NormalGL, Roughness, AmbientOcclusion, ..."""
    z = zipfile.ZipFile(io.BytesIO(get(f'https://ambientcg.com/get?file={asset}_{res}-JPG.zip')))
    name = next(n for n in z.namelist() if n.endswith(f'_{kind}.jpg'))
    return Image.open(io.BytesIO(z.read(name)))


def save(img, rel, size=None, quality=84):
    path = OUT / rel
    path.parent.mkdir(parents=True, exist_ok=True)
    if size:
        img = img.resize(size, Image.LANCZOS)
    img.convert('RGB').save(path, 'WEBP', quality=quality, method=6)
    print(f'{path.relative_to(ROOT)}: {img.size[0]}x{img.size[1]}, {path.stat().st_size // 1024} KB')


def music():
    # Rosewood (Poly Haven: rosewood_veneer1), lacquered a shade darker: the
    # sitar's neck (grain along it) and gourd, and the dayan's sheesham shell.
    wood = polyhaven('rosewood_veneer1', 'Diffuse')
    lacquer = ImageEnhance.Brightness(ImageEnhance.Contrast(wood).enhance(1.08)).enhance(0.82)
    save(lacquer.rotate(90, expand=True).crop((0, 256, 1024, 512)), 'music/rosewood-neck.webp', (1024, 256))
    save(lacquer.crop((0, 0, 1024, 1024)), 'music/rosewood.webp', (512, 512))


if __name__ == '__main__':
    music()
