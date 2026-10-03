"""Builds public/fonts/durin-runes/DurinRunes.woff for the Middle-earth themes'
language mode: English written in runes, letter for letter, the way Tolkien
wrote the Dwarves' runes in The Hobbit (Thror's map, the title page): with the
Anglo-Saxon runes. TH, NG, EA and ST each take one rune, as they do there.

The glyphs are Noto Sans Runic's (SIL OFL 1.1, from @fontsource/noto-sans-runic);
this font maps Latin letters onto them and is renamed, as the licence asks.
Digits and punctuation fall through to the next font in the CSS stack.

Run: python3 scripts/build-durin-runes.py   (needs fontTools)
"""

import pathlib
import shutil
import unicodedata

from fontTools.feaLib.builder import addOpenTypeFeaturesFromString
from fontTools.subset import Options, Subsetter
from fontTools.ttLib import TTFont

ROOT = pathlib.Path(__file__).resolve().parent.parent
PKG = ROOT / 'node_modules/@fontsource/noto-sans-runic'
SRC = PKG / 'files/noto-sans-runic-runic-400-normal.woff'
OUT_DIR = ROOT / 'public/fonts/durin-runes'
OUT = OUT_DIR / 'DurinRunes.woff'

LETTERS = {
    'A': 0x16AA, 'B': 0x16D2, 'C': 0x16B3, 'D': 0x16DE, 'E': 0x16D6, 'F': 0x16A0, 'G': 0x16B7,
    'H': 0x16BB, 'I': 0x16C1, 'J': 0x16C4, 'K': 0x16E3, 'L': 0x16DA, 'M': 0x16D7, 'N': 0x16BE,
    'O': 0x16A9, 'P': 0x16C8, 'Q': 0x16E2, 'R': 0x16B1, 'S': 0x16CB, 'T': 0x16CF, 'U': 0x16A2,
    'V': 0x16A1, 'W': 0x16B9, 'X': 0x16C9, 'Y': 0x16A3, 'Z': 0x16CE,
}
PAIRS = {'TH': 0x16A6, 'NG': 0x16DD, 'EA': 0x16E0, 'ST': 0x16E5}

font = TTFont(SRC)
cmap = font.getBestCmap()
missing = [hex(u) for u in [*LETTERS.values(), *PAIRS.values()] if u not in cmap]
assert not missing, f'missing runes: {missing}'

options = Options()
options.layout_features = []
options.name_IDs = ['*']
options.notdef_outline = True
sub = Subsetter(options)
sub.populate(unicodes=[0x20, *LETTERS.values(), *PAIRS.values()])
sub.subset(font)

cmap = font.getBestCmap()
glyph = {k: cmap[u] for k, u in {**LETTERS, **PAIRS}.items()}
for table in font['cmap'].tables:
    if not table.isUnicode():
        continue
    for letter, u in LETTERS.items():
        table.cmap[ord(letter)] = cmap[u]
        table.cmap[ord(letter.lower())] = cmap[u]
    # accented letters (the é in résumé) take their base letter's rune
    for cp in range(0xC0, 0x180):
        base = unicodedata.normalize('NFD', chr(cp))[0].upper()
        if base in LETTERS and cp not in table.cmap:
            table.cmap[cp] = cmap[LETTERS[base]]

rules = '\n'.join(f'  sub {glyph[p[0]]} {glyph[p[1]]} by {glyph[p]};' for p in PAIRS)
addOpenTypeFeaturesFromString(font, f'languagesystem DFLT dflt;\nlanguagesystem latn dflt;\nfeature liga {{\n{rules}\n}} liga;\n')

names = font['name']
for rec in list(names.names):
    if rec.nameID in (1, 3, 4, 6, 16, 17):
        names.removeNames(nameID=rec.nameID)
names.setName('Durin Runes', 1, 3, 1, 0x409)
names.setName('Regular', 2, 3, 1, 0x409)
names.setName('Durin Runes Regular; Latin letters onto Noto Sans Runic', 3, 3, 1, 0x409)
names.setName('Durin Runes Regular', 4, 3, 1, 0x409)
names.setName('DurinRunes-Regular', 6, 3, 1, 0x409)
names.setName('Modified version of Noto Sans Runic (SIL OFL 1.1): Latin letters are mapped onto Anglo-Saxon runes.', 10, 3, 1, 0x409)

OUT_DIR.mkdir(parents=True, exist_ok=True)
font.flavor = 'woff'
font.save(OUT)
shutil.copy(PKG / 'LICENSE', OUT_DIR / 'OFL.txt')
print(f'{len(LETTERS)} letters, {len(PAIRS)} ligatures -> {OUT.relative_to(ROOT)} ({OUT.stat().st_size} bytes)')
