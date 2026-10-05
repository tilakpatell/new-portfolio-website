"""Builds public/audio/harmonium.mp3 and src/components/music/harmoniumSamples.js:
a real harmonium, every key from E2 to D5, each held note ready to loop.

The source is donyaquick's "Harmonium Samples - All Keys and Drones"
(Freesound #330410, CC0), recorded at the Euterpea Studio of Yale's
Department of Computer Science. Freesound's high-quality preview of it is
downloaded to scripts/data/harmonium/ (not committed: 11 MB) the first time
this runs. From 40 s on it plays every key from E2 up to D5, each held for
several seconds.

For each key the script finds where it starts, measures its pitch to a
hundredth of a hertz, and picks a stretch of its sustain to loop: a whole
number of periods long, cut where the waveform matches itself, with the
end crossfaded into what comes before the start so the seam can't be heard.
The sprite holds each key's attack and that loop. A browser's MP3 decoder may
add padding at the start; the sprite opens with a single click, which the
engine finds to know exactly where everything else is.

Run: python3 scripts/build-harmonium.py   (needs ffmpeg with libmp3lame, and numpy)
"""

import json
import pathlib
import subprocess

import numpy as np

ROOT = pathlib.Path(__file__).resolve().parent.parent
SRC = ROOT / 'scripts/data/harmonium/harmonium-all-keys.mp3'
SRC_URL = 'https://cdn.freesound.org/previews/330/330410_1089898-hq.mp3'
OUT_MP3 = ROOT / 'public/audio/harmonium.mp3'
OUT_JS = ROOT / 'src/components/music/harmoniumSamples.js'
SR = 44100
FIRST, LAST = 40, 74  # E2 to D5, in MIDI numbers: the run of keys in the recording
RUN = (40.0, 376.0)  # seconds of the recording the run takes up
SYNC = 0.2  # where the click is, in the sprite
GAP = 0.08  # silence between keys in the sprite
LOOP_RANGE = (0.8, 1.8)  # how long a loop may be, in seconds
MATCH = 0.04  # the window its end is matched to its start over
XFADE = 0.12  # the crossfade baked into each loop's end


def decode():
    if not SRC.exists():
        SRC.parent.mkdir(parents=True, exist_ok=True)
        subprocess.run(['curl', '-sSfL', '-o', str(SRC), SRC_URL], check=True)
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', str(SRC), '-ac', '1', '-ar', str(SR), '-f', 'f32le', '-'], check=True, capture_output=True).stdout
    return np.frombuffer(raw, dtype=np.float32).astype(np.float64)


def period(w, hz):
    """The period (in samples) of a steady tone near `hz`, to a fraction of a sample."""
    p0 = SR / hz
    lags = np.arange(int(p0 * 0.94), int(p0 * 1.06) + 2)
    n = len(w) - lags[-1] - 1
    c = np.array([np.dot(w[:n], w[k : k + n]) / np.sqrt(np.dot(w[:n], w[:n]) * np.dot(w[k : k + n], w[k : k + n])) for k in lags])
    i = int(np.argmax(c))
    if 0 < i < len(c) - 1:  # a parabola through the peak, for the fraction
        a, b, d = c[i - 1], c[i], c[i + 1]
        return lags[i] + 0.5 * (a - d) / (a - 2 * b + d)
    return float(lags[i])


def envelope(x, hop):
    n = len(x) // hop
    return np.sqrt(np.mean(x[: n * hop].reshape(n, hop) ** 2, axis=1))


def keys(x):
    """Where each key of the run starts and ends: the dips in level between them."""
    hop = int(0.01 * SR)
    a, b = int(RUN[0] * SR), int(RUN[1] * SR)
    env = envelope(x[a:b], hop)
    db = 20 * np.log10(env + 1e-9)
    smooth = np.convolve(db, np.ones(5) / 5, mode='same')
    # a key's release and the next one's attack: a dip of 12 dB or more below the
    # level either side; take the deepest few dozen, at least 4 s apart
    want = LAST - FIRST  # boundaries between keys
    cands = []
    for i in range(50, len(smooth) - 50):
        if smooth[i] == smooth[i - 50 : i + 50].min():
            depth = min(smooth[i - 120 : i - 20].max(), smooth[i + 20 : i + 120].max()) - smooth[i]
            if depth > 12:
                cands.append((depth, i))
    cands.sort(reverse=True)
    picked = []
    for depth, i in cands:
        if all(abs(i - j) > 400 for j in picked):
            picked.append(i)
        if len(picked) == want:
            break
    if len(picked) != want:
        raise SystemExit(f'found {len(picked)} gaps between keys, wanted {want}')
    edges = [0] + sorted(picked) + [len(smooth) - 1]
    out = []
    for k in range(len(edges) - 1):
        s, e = edges[k], edges[k + 1]
        seg = smooth[s:e]
        level = np.percentile(seg, 80)
        on = s + int(np.argmax(seg > level - 20))  # where it rises within 20 dB of its sustain
        off = s + len(seg) - 1 - int(np.argmax(seg[::-1] > level - 6))  # where it starts to fall away
        out.append((a + on * hop, a + off * hop))
    return out


def loop_points(x, on, off, hz):
    """A loop in the sustain: start, end (samples), and how well its end matches its start.

    A harmonium's reed banks beat against each other, so its waveform repeats only
    roughly at the pitch: the end is chosen, between LOOP_RANGE seconds on, where a
    window of several periods best matches the one at the start, beating and all."""
    start = on + int(0.55 * SR)
    lo, hi = (int(t * SR) for t in LOOP_RANGE)
    if off - start < hi + int(0.1 * SR):
        hi = off - start - int(0.1 * SR)
        if hi < lo:
            raise SystemExit(f'key at {on / SR:.1f}s is too short to loop')
    p = period(x[start : start + int(0.25 * SR)], hz)
    # start on a rising zero crossing
    seg = x[start : start + int(p * 2)]
    z = np.where((seg[:-1] <= 0) & (seg[1:] > 0))[0]
    ls = start + int(z[0]) if len(z) else start
    w = int(MATCH * SR)
    ref = x[ls : ls + w]
    region = x[ls + lo : ls + hi + w]
    # normalised cross-correlation of the start's window along the region, by FFT
    n = 1 << int(np.ceil(np.log2(len(region) + w)))
    corr = np.fft.irfft(np.fft.rfft(region, n) * np.conj(np.fft.rfft(ref, n)), n)[: len(region) - w + 1]
    energy = np.sqrt(np.convolve(region**2, np.ones(w), mode='valid') * np.dot(ref, ref)) + 1e-12
    c = corr / energy
    i = int(np.argmax(c))
    return ls, ls + lo + i, float(c[i])


def main():
    x = decode()
    found = keys(x)
    notes = []
    parts = [np.zeros(int(SYNC * SR))]
    click = np.zeros(int(0.3 * SR))
    click[0] = 0.9  # the sync click, at SYNC
    parts.append(click)
    at = sum(len(p) for p in parts)
    for i, (on, off) in enumerate(found):
        midi = FIRST + i
        nominal = 440 * 2 ** ((midi - 69) / 12)
        p = period(x[on + int(1.0 * SR) : on + int(1.5 * SR)], nominal)
        hz = SR / p
        if abs(12 * np.log2(hz / nominal)) > 0.6:
            raise SystemExit(f'key {i} ({midi}) measured {hz:.2f} Hz, not near {nominal:.2f}')
        ls, le, match = loop_points(x, on, off, hz)
        # the key from just before its attack to the end of its loop
        begin = max(0, on - int(0.01 * SR))
        y = x[begin:le].copy()
        # bake a crossfade: the end of the loop runs into what comes just before its start
        n = int(XFADE * SR)
        w = np.sin(np.linspace(0, np.pi / 2, n)) ** 2
        y[-n:] = y[-n:] * (1 - w) + x[ls - n : ls] * w
        y[:200] *= np.linspace(0, 1, 200)
        gain = 0.5 / np.sqrt(np.mean(x[ls:le] ** 2))  # every key at the same sustain level
        y *= gain
        notes.append([midi, round(hz, 3), round(at / SR, 5), round((at + ls - begin) / SR, 5), round((at + le - begin) / SR, 5), round(float(match), 4)])
        parts.append(y)
        parts.append(np.zeros(int(GAP * SR)))
        at += len(y) + int(GAP * SR)
    sprite = np.concatenate(parts)
    peak = np.abs(sprite[int((SYNC + 0.01) * SR) :]).max()
    sprite[int((SYNC + 0.01) * SR) :] *= 0.89 / peak
    pcm = (np.clip(sprite, -1, 1) * 32767).astype('<i2').tobytes()
    OUT_MP3.parent.mkdir(parents=True, exist_ok=True)
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-f', 's16le', '-ar', str(SR), '-ac', '1', '-i', '-', '-c:a', 'libmp3lame', '-b:a', '96k', str(OUT_MP3)], input=pcm, check=True)
    rows = ',\n'.join(f'  [{m}, {hz}, {a}, {ls}, {le}]' for m, hz, a, ls, le, _ in notes)
    OUT_JS.write_text(
        '// Generated by scripts/build-harmonium.py: a real harmonium, every key from\n'
        "// E2 to D5, from donyaquick's recordings at Yale's Euterpea Studio (Freesound\n"
        '// #330410, CC0). Each key is [midi, hz, start, loop start, loop end] in\n'
        '// seconds of the sprite, counted from the sync click at SYNC.\n'
        f"export const HARMONIUM_URL = '/audio/harmonium.mp3';\n"
        f'export const SYNC = {SYNC};\n'
        f'export const HARMONIUM_KEYS = [\n{rows},\n];\n'
    )
    worst = min(n[5] for n in notes)
    print(f'{len(notes)} keys, {len(sprite) / SR:.1f} s, {OUT_MP3.stat().st_size // 1024} KB; worst loop match {worst:.4f}')
    for n in notes:
        print(n)


if __name__ == '__main__':
    main()
