"""Builds public/fonts/basic-script/BasicScript.woff for Aurebesh mode.

The site writes in Aurebesh with SilvinoR's OFL font, which covers plain ASCII
but not accented letters, so a word like "Résumé" would show its é in Latin.
This makes a modified copy that maps every accented Latin letter to the glyph
of its base letter (é -> e, ā -> a, ...), and a few look-alike symbols (×, −,
›) to x, - and >.

The SIL Open Font License reserves the name AUREBESH, so the modified font
must not use it: it is named "Basic Script" instead, with the original
copyright and the OFL kept (see public/fonts/basic-script/OFL.md).

Run: python3 scripts/build-basic-script.py   (needs fontTools)
"""

import pathlib
import shutil
import unicodedata

from fontTools.ttLib import TTFont

ROOT = pathlib.Path(__file__).resolve().parent.parent
SRC = ROOT / 'public/fonts/aurebesh/Aurebesh.ttf'
OUT_DIR = ROOT / 'public/fonts/basic-script'
OUT = OUT_DIR / 'BasicScript.woff'

SYMBOLS = {'×': 'x', '−': '-', '–': '-', '—': '-', '›': '>', '‹': '<', '…': '.', '·': '.'}
# Letters Unicode doesn't decompose, mapped to the nearest plain letter.
SYMBOLS.update({'Ø': 'O', 'ø': 'o', 'Æ': 'A', 'æ': 'a', 'Œ': 'O', 'œ': 'o', 'Ł': 'L', 'ł': 'l', 'Đ': 'D', 'đ': 'd',
                'Ð': 'D', 'ð': 'd', 'ß': 's', 'Þ': 'T', 'þ': 't', 'ı': 'i', 'ŋ': 'n', 'Ŋ': 'N', 'ĸ': 'k'})

font = TTFont(SRC)
cmap = font.getBestCmap()

def base(ch):
    """The plain ASCII letter an accented letter is built on, if any."""
    decomposed = unicodedata.normalize('NFD', ch)
    first = decomposed[0]
    return first if first.isascii() and first.isalpha() else None

additions = {}
ranges = list(range(0x00C0, 0x0250)) + list(range(0x1E00, 0x1F00))
for cp in ranges:
    if cp in cmap:
        continue
    ch = chr(cp)
    b = base(ch) if ch.isalpha() else None
    if b and ord(b) in cmap:
        additions[cp] = cmap[ord(b)]
for ch, target in SYMBOLS.items():
    if ord(ch) not in cmap and ord(target) in cmap:
        additions[ord(ch)] = cmap[ord(target)]

for table in font['cmap'].tables:
    if table.isUnicode():
        for cp, glyph in additions.items():
            if table.format == 4 and cp > 0xFFFF:
                continue
            table.cmap[cp] = glyph

# A new name, as the OFL's Reserved Font Name clause requires.
names = font['name']
for rec in list(names.names):
    if rec.nameID in (1, 3, 4, 6, 16, 17):
        names.removeNames(nameID=rec.nameID)
names.setName('Basic Script', 1, 3, 1, 0x409)
names.setName('Regular', 2, 3, 1, 0x409)
names.setName('Basic Script Regular; tilakpatell.com', 3, 3, 1, 0x409)
names.setName('Basic Script Regular', 4, 3, 1, 0x409)
names.setName('BasicScript-Regular', 6, 3, 1, 0x409)
names.setName(
    'Modified version of Aurebesh by SilvinoR (SIL OFL 1.1): accented Latin letters are mapped to their base glyphs.',
    10, 3, 1, 0x409,
)

OUT_DIR.mkdir(parents=True, exist_ok=True)
font.flavor = 'woff'
font.save(OUT)
shutil.copy(ROOT / 'public/fonts/aurebesh/OFL.md', OUT_DIR / 'OFL.md')
(OUT_DIR / 'FONTLOG.txt').write_text(
    'Basic Script is a modified version of Aurebesh (c) 2022 SilvinoR, released under the SIL Open Font License 1.1.\n'
    'Changes: accented Latin letters and a few symbols are mapped to existing glyphs (see scripts/build-basic-script.py).\n'
    'Renamed because AUREBESH is a Reserved Font Name.\n'
)
print(f'added {len(additions)} code points -> {OUT.relative_to(ROOT)} ({OUT.stat().st_size} bytes)')
