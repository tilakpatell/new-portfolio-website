"""Builds public/fonts/cybertron-script/CybertronScript.woff for the
Transformers themes: the Cybertronian alphabet of the Aligned continuity
(Transformers: War for Cybertron and Fall of Cybertron), A to Z.

The glyphs were traced from the alphabet chart on TFWiki (File:Aligned_font.jpg)
into scripts/data/cybertronian-aligned.json. The letterforms are the games'
(Hasbro, High Moon Studios); this is a fan reproduction for a personal,
non-commercial site. Upper and lower case share a glyph, as do accented
letters and their base letter; digits and punctuation fall through to the next
font in the CSS stack.

Run: python3 scripts/build-cybertron-script.py   (needs fontTools)
"""

import json
import pathlib
import unicodedata

from fontTools.fontBuilder import FontBuilder
from fontTools.pens.cu2quPen import Cu2QuPen
from fontTools.pens.transformPen import TransformPen
from fontTools.pens.ttGlyphPen import TTGlyphPen
from fontTools.svgLib.path import parse_path

ROOT = pathlib.Path(__file__).resolve().parent.parent
DATA = json.loads((ROOT / 'scripts/data/cybertronian-aligned.json').read_text())
OUT_DIR = ROOT / 'public/fonts/cybertron-script'
OUT = OUT_DIR / 'CybertronScript.woff'

S = 7.0  # font units per chart pixel: a row of glyphs (about 100 px) is about 700 units tall
SIDE = 40  # side bearing
DROP = -40  # the row's floor sits a little below the baseline
ASC, DESC = 820, 220


def glyph(letter, spec):
    x0, _y0, x1, _y1 = spec['box']
    cx0, cy0, _w, _h = spec['crop']
    bottom = DATA['rows']['A-M' if letter <= 'M' else 'N-Z']['bottom']
    tt = TTGlyphPen(None)
    # the chart's y runs down and the font's up: flip, scale the 4x crop to font units, and place it
    pen = TransformPen(Cu2QuPen(tt, max_err=1.0, reverse_direction=True), (S / 4, 0, 0, -S / 4, (cx0 - x0) * S + SIDE, (bottom - cy0) * S + DROP))
    parse_path(spec['d'], pen)
    return tt.glyph(), round((x1 - x0 + 1) * S + 2 * SIDE)


def build():
    order = ['.notdef', 'space'] + list(DATA['glyphs'])
    glyphs = {'.notdef': TTGlyphPen(None).glyph(), 'space': TTGlyphPen(None).glyph()}
    metrics = {'.notdef': (500, 0), 'space': (320, 0)}
    for letter, spec in DATA['glyphs'].items():
        g, advance = glyph(letter, spec)
        glyphs[letter] = g
        metrics[letter] = (advance, SIDE)
    cmap = {ord(' '): 'space'}
    for letter in DATA['glyphs']:
        cmap[ord(letter)] = letter
        cmap[ord(letter.lower())] = letter
    # accented letters (the é in résumé) share their base letter's glyph
    for cp in range(0xC0, 0x180):
        base = unicodedata.normalize('NFD', chr(cp))[0].upper()
        if base in DATA['glyphs'] and cp not in cmap:
            cmap[cp] = base
    fb = FontBuilder(1000, isTTF=True)
    fb.setupGlyphOrder(order)
    fb.setupCharacterMap(cmap)
    fb.setupGlyf(glyphs)
    for name in DATA['glyphs']:
        fb.font['glyf'][name].recalcBounds(fb.font['glyf'])
    fb.setupHorizontalMetrics({k: (v[0], fb.font['glyf'][k].xMin if hasattr(fb.font['glyf'][k], 'xMin') else 0) for k, v in metrics.items()})
    fb.setupHorizontalHeader(ascent=ASC, descent=-DESC)
    fb.setupNameTable({
        'familyName': 'Cybertron Script',
        'styleName': 'Regular',
        'uniqueFontIdentifier': 'Cybertron Script Regular; Aligned Cybertronian, fan reproduction',
        'fullName': 'Cybertron Script Regular',
        'psName': 'CybertronScript-Regular',
        'description': 'The Aligned Cybertronian alphabet (War for Cybertron), traced. Letterforms: Hasbro, High Moon Studios.',
    })
    fb.setupOS2(sTypoAscender=ASC, sTypoDescender=-DESC, usWinAscent=ASC, usWinDescent=DESC, sCapHeight=700, sxHeight=700)
    fb.setupPost()
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    fb.font.flavor = 'woff'
    fb.save(OUT)
    (OUT_DIR / 'NOTICE.txt').write_text(
        'Cybertron Script: the Aligned Cybertronian alphabet from Transformers: War for Cybertron and\n'
        'Fall of Cybertron (letterforms by Hasbro and High Moon Studios), traced from the TFWiki chart\n'
        'File:Aligned_font.jpg for this personal, non-commercial fan site. See scripts/build-cybertron-script.py.\n'
    )
    old = OUT_DIR / 'OFL.txt'
    if old.exists():
        old.unlink()
    print(f'{len(DATA["glyphs"])} glyphs -> {OUT.relative_to(ROOT)} ({OUT.stat().st_size} bytes)')


build()
