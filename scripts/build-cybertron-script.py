"""Builds public/fonts/cybertron-script/CybertronScript.woff: an original
Cybertronian-style cipher for the Transformers themes.

Every letter is a block: some sides of a frame, one mark inside it, and
sometimes a cut corner, all in straight strokes at right angles and 45 degrees.
Upper and lower case share a glyph. Digits and punctuation are left to the
next font in the stack. The design is this file's own, released under the
SIL Open Font License 1.1 (see public/fonts/cybertron-script/OFL.txt).

Run: python3 scripts/build-cybertron-script.py   (needs fontTools)
"""

import pathlib

from fontTools.fontBuilder import FontBuilder
from fontTools.pens.ttGlyphPen import TTGlyphPen

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT_DIR = ROOT / 'public/fonts/cybertron-script'
OUT = OUT_DIR / 'CybertronScript.woff'

U = 112  # one grid unit, in font units; a glyph is 4 units wide and 6 tall
W = 80  # stroke width
SIDE = 70  # side bearing
ASC, DESC = 880, 200

# frame sides: T top, B bottom, L left, R right; then the mark inside; then a cut corner
GLYPHS = {
    'A': ('TLR', 'h', ''), 'B': ('TLBR', 'v', 'tr'), 'C': ('TLB', 's', ''), 'D': ('TBR', 'b', 'bl'),
    'E': ('TLB', 'h', 'tl'), 'F': ('TL', 'c', ''), 'G': ('LBR', 'd', ''), 'H': ('LR', 'k', ''),
    'I': ('TB', 'v', ''), 'J': ('RB', 'c', 'bl'), 'K': ('LT', 'k', 'tl'), 'L': ('LB', 'b', ''),
    'M': ('TLR', 'e', ''), 'N': ('LR', 'd', ''), 'O': ('TLBR', 's', 'bl'), 'P': ('TLR', 't', 'tr'),
    'Q': ('TLBR', 'e', 'br'), 'R': ('TLB', 'd', 'tr'), 'S': ('TB', 'd', ''), 'T': ('TR', 'v', ''),
    'U': ('LBR', 'h', ''), 'V': ('LBR', 'c', 'br'), 'W': ('LBR', 'e', ''), 'X': ('TB', 'b', ''),
    'Y': ('TR', 'c', 'tr'), 'Z': ('TB', 'h', 'br'),
}

MARKS = {
    'v': [[(2, 1), (2, 5)]],
    'h': [[(1, 3), (3, 3)]],
    'd': [[(1, 1), (3, 5)]],
    'b': [[(1, 5), (3, 1)]],
    'c': [[(1, 4), (2, 2), (3, 4)]],
    'k': [[(1, 5), (3, 3), (1, 1)]],
    's': [[(1.6, 2.6), (2.4, 2.6), (2.4, 3.4), (1.6, 3.4), (1.6, 2.6)]],
    't': [[(1, 4), (3, 4)], [(2, 4), (2, 1)]],
    'e': [[(1.3, 2), (1.3, 4)], [(2.7, 2), (2.7, 4)]],
}


def frame(sides, cut):
    """The frame's strokes, with a chamfer at the cut corner."""
    c = 0.9  # how much of each side the chamfer takes
    tl, tr, bl, br = (cut == k for k in ('tl', 'tr', 'bl', 'br'))
    strokes = []
    if 'T' in sides:
        strokes.append([(c if tl else 0, 6), (4 - c if tr else 4, 6)])
    if 'B' in sides:
        strokes.append([(c if bl else 0, 0), (4 - c if br else 4, 0)])
    if 'L' in sides:
        strokes.append([(0, c if bl else 0), (0, 6 - c if tl else 6)])
    if 'R' in sides:
        strokes.append([(4, c if br else 0), (4, 6 - c if tr else 6)])
    for on, a, b in ((tl, (0, 6 - c), (c, 6)), (tr, (4 - c, 6), (4, 6 - c)), (bl, (0, c), (c, 0)), (br, (4 - c, 0), (4, c))):
        if on:
            strokes.append([a, b])
    return strokes


def quad(p, q):
    """One straight stroke as a rectangle, squared off past both ends."""
    (x1, y1), (x2, y2) = p, q
    dx, dy = x2 - x1, y2 - y1
    length = (dx * dx + dy * dy) ** 0.5 or 1
    ux, uy = dx / length, dy / length
    nx, ny = -uy, ux
    h = W / 2
    ax, ay = x1 - ux * h, y1 - uy * h
    bx, by = x2 + ux * h, y2 + uy * h
    pts = [(ax + nx * h, ay + ny * h), (bx + nx * h, by + ny * h), (bx - nx * h, by - ny * h), (ax - nx * h, ay - ny * h)]
    # TrueType outer contours run clockwise
    area = sum(pts[i][0] * pts[(i + 1) % 4][1] - pts[(i + 1) % 4][0] * pts[i][1] for i in range(4))
    return pts if area < 0 else pts[::-1]


def draw(spec):
    sides, mark, cut = spec
    pen = TTGlyphPen(None)
    strokes = frame(sides, cut) + MARKS[mark]
    for line in strokes:
        pts = [(SIDE + x * U, y * U) for x, y in line]
        for p, q in zip(pts, pts[1:]):
            r = [(round(x), round(y)) for x, y in quad(p, q)]
            pen.moveTo(r[0])
            for pt in r[1:]:
                pen.lineTo(pt)
            pen.closePath()
    return pen.glyph()


def build():
    advance = SIDE * 2 + 4 * U
    order = ['.notdef', 'space'] + list(GLYPHS)
    glyphs = {'.notdef': TTGlyphPen(None).glyph(), 'space': TTGlyphPen(None).glyph()}
    metrics = {'.notdef': (advance, 0), 'space': (300, 0)}
    for ch, spec in GLYPHS.items():
        glyphs[ch] = draw(spec)
        metrics[ch] = (advance, SIDE)
    cmap = {ord(' '): 'space'}
    for ch in GLYPHS:
        cmap[ord(ch)] = ch
        cmap[ord(ch.lower())] = ch
    fb = FontBuilder(1000, isTTF=True)
    fb.setupGlyphOrder(order)
    fb.setupCharacterMap(cmap)
    fb.setupGlyf(glyphs)
    fb.setupHorizontalMetrics(metrics)
    fb.setupHorizontalHeader(ascent=ASC, descent=-DESC)
    fb.setupNameTable({'familyName': 'Cybertron Script', 'styleName': 'Regular', 'uniqueFontIdentifier': 'Cybertron Script Regular; tilakpatell.com', 'fullName': 'Cybertron Script Regular', 'psName': 'CybertronScript-Regular', 'licenseDescription': 'SIL Open Font License 1.1'})
    fb.setupOS2(sTypoAscender=ASC, sTypoDescender=-DESC, usWinAscent=ASC, usWinDescent=DESC, sCapHeight=6 * U, sxHeight=6 * U)
    fb.setupPost()
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    fb.font.flavor = 'woff'
    fb.save(OUT)
    (OUT_DIR / 'OFL.txt').write_text(
        'Cybertron Script, an original Cybertronian-style cipher made for tilakpatell.com.\n'
        'Copyright (c) 2026 Tilak Patel. Licensed under the SIL Open Font License, Version 1.1:\n'
        'https://openfontlicense.org\n'
    )
    print(f'{len(GLYPHS)} glyphs -> {OUT.relative_to(ROOT)} ({OUT.stat().st_size} bytes)')


build()
