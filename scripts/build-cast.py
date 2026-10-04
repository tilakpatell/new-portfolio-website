"""Builds the Scranton office's people: the parts they're dressed from, out of
Quaternius's Ultimate Modular Men and Women packs (CC0, quaternius.com), on
the packs' own rigged skeletons.

Each pack's characters come as four parts (head, body, legs, feet) on one
shared skeleton. This takes only the parts the cast is dressed from, folds
each into a single primitive whose vertices carry a `_SLOT` (which of the
part's colours it was: skin, hair, jacket, shirt, tie...), keeps the skeleton
(the browser poses it; the packs' animations are for standing figures), and
writes one meshopt-compressed .glb per pack to public/models/office/. The
browser colours each person's slots as the show dresses them
(src/components/office/people.js).

Run: python3 scripts/build-cast.py   (needs numpy and npx)
"""

import base64
import json
import pathlib
import struct
import subprocess
import urllib.request

import numpy as np

ROOT = pathlib.Path(__file__).resolve().parent.parent
CACHE = ROOT / 'node_modules/.cache/office/cast'
OUT = ROOT / 'public/models/office'

# the packs' glTF files, as Quaternius shares them (Google Drive)
SOURCES = {
    'men_Suit': '1NhXHnGU0zK9hBrT5FoZp8nTz_EmvTPg5',
    'men_Casual_2': '1Jn7kULNmrtqP8BUUL19h8MhbdOnwPFhv',
    'men_Casual_Hoodie': '1em1So1xwwQNfHJYMvzKcXkZllvtxpKP5',
    'men_Worker': '14d8n7IDnnlnGt_uiATnNg3uvi_4dyd9V',
    'men_Farmer': '1B9Dln-oR5Yk6sdsDR3yHCw86LobAN3Zd',
    'men_Beach': '1IL1YJPJvNkuGnKI69-W-VMBIDCo-u49N',
    'men_Adventurer': '1fzSq1Rr037f7QkfXPWEAzmbLMNx-FpPA',
    'women_Suit': '1GjWtofxjmPku25cXJxHrzLLeUbXw7A_s',
    'women_Casual': '18b3WwlrwrFYWAM7BcnjWeIxKJyxAQiGh',
    'women_Formal': '1iayBzVv_zLjuPtaNPouw_auwKlQLLmes',
    'women_Adventurer': '1uxAFnDp73NO1c16LvHHjAYh1-deMNk5I',
}

# The parts: (source, its node, our name, its materials -> our slots).
# A material left out is dropped (a hard hat, a cowboy hat, earrings).
EYES = {'Eye': 'eyes', 'Brown': 'eyes'}
PACKS = {
    'men': {
        'base': 'men_Suit',
        'parts': [
            ('men_Suit', 'Suit_Head', 'head_parted', {'Skin': 'skin', 'Hair': 'hair', 'Eyebrows': 'brows', **EYES}),
            ('men_Casual_Hoodie', 'Casual_Head', 'head_messy', {'Skin': 'skin', 'Hair': 'hair', 'Eyebrows': 'brows', **EYES}),
            ('men_Casual_2', 'Casual2_Head', 'head_swept', {'Skin': 'skin', 'Skin_Darker': 'skin', 'Hair': 'hair', 'Eyebrows': 'brows', **EYES}),
            ('men_Beach', 'Beach_Head', 'head_short', {'Skin': 'skin', 'Hair': 'hair', 'Eyebrows': 'brows', **EYES}),
            ('men_Worker', 'Worker_Head', 'head_bald_moustache', {'Skin': 'skin', 'Moustache': 'moustache', 'Eyebrows': 'brows', **EYES}),
            ('men_Farmer', 'Farmer_Head', 'head_bald', {'Skin': 'skin', 'Eyebrows': 'brows', **EYES}),
            ('men_Adventurer', 'Adventurer_Head', 'head_beard', {'Skin': 'skin', 'Hair': 'hair', 'Eyebrows': 'brows', **EYES}),
            ('men_Suit', 'Suit_Body', 'body_suit', {'Skin': 'skin', 'Suit': 'top', 'White': 'shirt', 'Tie': 'tie'}),
            ('men_Casual_2', 'Casual2_Body', 'body_tee', {'Skin': 'skin', 'LightBrown': 'top'}),
            ('men_Casual_Hoodie', 'Casual_Body', 'body_hoodie', {'Skin': 'skin', 'Purple': 'top'}),
            ('men_Suit', 'Suit_Legs', 'legs_slacks', {'Suit': 'legs'}),
            ('men_Casual_2', 'Casual2_Legs', 'legs_jeans', {'LightBlue': 'legs'}),
            ('men_Suit', 'Suit_Feet', 'feet_shoes', {'Black': 'shoes'}),
        ],
    },
    'women': {
        'base': 'women_Suit',
        'parts': [
            ('women_Casual', 'Casual_Head', 'head_long', {'Skin': 'skin', 'Hair_Blond': 'hair', 'Hair_Brown': 'brows', **EYES}),
            ('women_Formal', 'Formad_Head', 'head_updo', {'Skin': 'skin', 'Red': 'hair', **EYES}),
            ('women_Adventurer', 'Adventurer_Head', 'head_short', {'Skin': 'skin', 'Hair_Brown': 'hair', **EYES}),
            ('women_Suit', 'Suit_Body', 'body_blazer', {'Skin': 'skin', 'Black': 'top', 'White': 'shirt'}),
            ('women_Casual', 'Casual_Body', 'body_tee', {'Skin': 'skin', 'White': 'top'}),
            ('women_Formal', 'Formal_Body', 'body_dress', {'Skin': 'skin', 'LimeGreen': 'top', 'Gold': 'belt'}),
            ('women_Suit', 'Suit_Legs', 'legs_slacks', {'Black': 'legs'}),
            ('women_Formal', 'Formal_Legs', 'legs_skirt', {'Skin': 'skin', 'LimeGreen': 'legs'}),
            ('women_Suit', 'Suit_Feet', 'feet_shoes', {'Skin': 'skin', 'Black': 'shoes'}),
        ],
    },
}
SLOTS = ['skin', 'hair', 'brows', 'eyes', 'moustache', 'top', 'shirt', 'tie', 'belt', 'legs', 'shoes']

CT = {5120: np.int8, 5121: np.uint8, 5122: np.int16, 5123: np.uint16, 5125: np.uint32, 5126: np.float32}
NC = {'SCALAR': 1, 'VEC2': 2, 'VEC3': 3, 'VEC4': 4, 'MAT4': 16}


def fetch(name):
    CACHE.mkdir(parents=True, exist_ok=True)
    path = CACHE / f'{name}.gltf'
    if not path.exists():
        url = f'https://drive.usercontent.google.com/download?id={SOURCES[name]}&export=download&confirm=t'
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
        path.write_bytes(urllib.request.urlopen(req).read())
    g = json.loads(path.read_text())
    bufs = [base64.b64decode(b['uri'].split(',', 1)[1]) for b in g['buffers']]
    return g, bufs


def read(g, bufs, i):
    a = g['accessors'][i]
    bv = g['bufferViews'][a['bufferView']]
    dt = np.dtype(CT[a['componentType']])
    n = NC[a['type']]
    off = bv.get('byteOffset', 0) + a.get('byteOffset', 0)
    stride = bv.get('byteStride', dt.itemsize * n)
    raw = bufs[bv['buffer']]
    if stride == dt.itemsize * n:
        return np.frombuffer(raw, dtype=dt, count=a['count'] * n, offset=off).reshape(a['count'], n).copy()
    rows = [np.frombuffer(raw, dtype=dt, count=n, offset=off + k * stride) for k in range(a['count'])]
    return np.stack(rows)


class Writer:
    """A glTF with one binary buffer, written as .glb."""

    def __init__(self):
        self.bin = bytearray()
        self.views = []
        self.accessors = []

    def add(self, arr, kind, target=None, minmax=False):
        arr = np.ascontiguousarray(arr)
        while len(self.bin) % 4:
            self.bin.append(0)
        view = {'buffer': 0, 'byteOffset': len(self.bin), 'byteLength': arr.nbytes}
        if target:
            view['target'] = target
        self.bin += arr.tobytes()
        self.views.append(view)
        ctype = {np.dtype(v): k for k, v in CT.items()}[arr.dtype]
        acc = {'bufferView': len(self.views) - 1, 'componentType': ctype, 'count': arr.shape[0], 'type': kind}
        if minmax:
            acc['min'] = arr.min(axis=0).tolist()
            acc['max'] = arr.max(axis=0).tolist()
        self.accessors.append(acc)
        return len(self.accessors) - 1

    def glb(self, doc, path):
        doc['buffers'] = [{'byteLength': len(self.bin)}]
        doc['bufferViews'] = self.views
        doc['accessors'] = self.accessors
        js = json.dumps(doc, separators=(',', ':')).encode()
        js += b' ' * (-len(js) % 4)
        bn = bytes(self.bin) + b'\0' * (-len(self.bin) % 4)
        with open(path, 'wb') as f:
            f.write(struct.pack('<III', 0x46546C67, 2, 12 + 8 + len(js) + 8 + len(bn)))
            f.write(struct.pack('<II', len(js), 0x4E4F534A) + js)
            f.write(struct.pack('<II', len(bn), 0x004E4942) + bn)


def build(pack, spec):
    g, bufs = fetch(spec['base'])
    w = Writer()
    # the skeleton: every node under the armature that isn't a mesh (or the pistol)
    arm = next(i for i, n in enumerate(g['nodes']) if n['name'] == 'CharacterArmature')
    keep = []

    def walk(i):
        n = g['nodes'][i]
        if 'mesh' in n or n['name'] == 'Pistol':
            return
        keep.append(i)
        for c in n.get('children', []):
            walk(c)

    walk(arm)
    remap = {old: new for new, old in enumerate(keep)}
    nodes = []
    for old in keep:
        n = {k: v for k, v in g['nodes'][old].items() if k not in ('children', 'mesh', 'skin')}
        kids = [remap[c] for c in g['nodes'][old].get('children', []) if c in remap]
        if kids:
            n['children'] = kids
        nodes.append(n)
    skin0 = g['skins'][0]
    joint_names = [g['nodes'][j]['name'] for j in skin0['joints']]
    skin = {'name': 'CharacterArmature', 'joints': [remap[j] for j in skin0['joints']], 'inverseBindMatrices': w.add(read(g, bufs, skin0['inverseBindMatrices']).astype(np.float32), 'MAT4')}

    meshes = []
    for src, node_name, name, slots in spec['parts']:
        sg, sb = fetch(src)
        sj = [sg['nodes'][j]['name'] for j in sg['skins'][0]['joints']]
        jmap = np.array([joint_names.index(n) for n in sj], dtype=np.uint16)
        node = next(n for n in sg['nodes'] if n['name'] == node_name)
        mats = [m['name'] for m in sg['materials']]
        pos, nor, jts, wts, slot, idx = [], [], [], [], [], []
        base = 0
        for p in sg['meshes'][node['mesh']]['primitives']:
            mname = mats[p['material']]
            if mname not in slots:
                continue
            at = p['attributes']
            P = read(sg, sb, at['POSITION']).astype(np.float32)
            pos.append(P)
            nor.append(read(sg, sb, at['NORMAL']).astype(np.float32))
            jts.append(jmap[read(sg, sb, at['JOINTS_0']).astype(np.int64)])
            W = read(sg, sb, at['WEIGHTS_0']).astype(np.float32)
            wts.append(W / np.maximum(W.sum(axis=1, keepdims=True), 1e-6))
            slot.append(np.full((len(P), 1), SLOTS.index(slots[mname]), dtype=np.uint8))
            idx.append(read(sg, sb, p['indices']).astype(np.uint32).ravel() + base)
            base += len(P)
        P = np.concatenate(pos)
        I = np.concatenate(idx)
        attrs = {
            'POSITION': w.add(P, 'VEC3', 34962, minmax=True),
            'NORMAL': w.add(np.concatenate(nor), 'VEC3', 34962),
            'JOINTS_0': w.add(np.concatenate(jts).astype(np.uint16), 'VEC4', 34962),
            'WEIGHTS_0': w.add(np.concatenate(wts), 'VEC4', 34962),
            '_SLOT': w.add(np.concatenate(slot), 'SCALAR', 34962),
        }
        prim = {'attributes': attrs, 'indices': w.add(I.astype(np.uint16 if base < 65536 else np.uint32), 'SCALAR', 34963)}
        meshes.append({'name': name, 'primitives': [prim]})
        nodes.append({'name': name, 'mesh': len(meshes) - 1, 'skin': 0})
        nodes[0].setdefault('children', []).append(len(nodes) - 1)
        print(f'  {pack}/{name}: {len(P)} verts, {len(I) // 3} tris')

    doc = {
        'asset': {'version': '2.0', 'generator': 'build-cast.py', 'copyright': 'Quaternius (CC0)'},
        'scene': 0,
        'scenes': [{'nodes': [0]}],
        'nodes': nodes,
        'skins': [skin],
        'meshes': meshes,
        'extras': {'slots': SLOTS},
    }
    raw = CACHE / f'cast-{pack}.raw.glb'
    w.glb(doc, raw)
    out = OUT / f'cast-{pack}.glb'
    subprocess.run(['npx', '--yes', '@gltf-transform/cli@4', 'meshopt', str(raw), str(out), '--level', 'high', '--quantization-volume', 'scene'], check=True)
    print(f'{out.relative_to(ROOT)}: {out.stat().st_size // 1024} KB')


if __name__ == '__main__':
    OUT.mkdir(parents=True, exist_ok=True)
    for pack, spec in PACKS.items():
        build(pack, spec)
