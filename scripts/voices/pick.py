"""The choices the voice scripts make, kept apart from the models so they can be
tested: where speech splits into utterances, which known quote a transcript
holds, how a candidate segment or a take of a line scores, and which segments
make a voice's reference. test_pick.py beside this file tests them.
"""

import re
from difflib import SequenceMatcher
from itertools import combinations

# A reference longer than this F5-TTS cuts, leaving its transcript describing
# audio it no longer has; the other engines are happy with it too.
LONGEST = 11.5


def utterances(words, gap=0.35, shortest=1.2, longest=LONGEST):
    """Speech as utterances, from Whisper's word timings [(word, start, end), ...]:
    split where the speaker pauses for `gap` seconds or more, and where a run is
    longer than `longest` at its last sentence end that fits (or its last word).
    Ones shorter than `shortest` are dropped. Returns [(start, end, text), ...]."""
    runs, run = [], []
    for w in words:
        if run and w[1] - run[-1][2] >= gap:
            runs.append(run)
            run = []
        run.append(w)
    if run:
        runs.append(run)

    out = []
    for run in runs:
        while run:
            fits = [i for i, w in enumerate(run) if w[2] - run[0][1] <= longest] or [0]
            last = fits[-1]
            if last < len(run) - 1:
                ends = [i for i in fits if run[i][0].endswith((".", "?", "!"))]
                last = ends[-1] if ends else last
            piece, run = run[: last + 1], run[last + 1 :]
            start, end = piece[0][1], piece[-1][2]
            if end - start + 1e-6 >= shortest:
                out.append((start, end, " ".join(w[0] for w in piece)))
    return out


def normal(text):
    """Text as plain lowercase words, for matching what was heard against what was meant."""
    t = text.lower().replace("’", "'").replace("‘", "'")
    return " ".join(re.sub(r"[^a-z0-9']+", " ", t).split())


def quoted(text, quotes, at_least=0.8):
    """The quote (as given) that `text` says, allowing for a misheard word or two, or None."""
    heard = normal(text).split()
    best, found = at_least, None
    for q in quotes:
        want = normal(q).split()
        if not want:
            continue
        n = len(want)
        windows = [heard[i : i + k] for k in (n - 1, n, n + 1) if k > 0 for i in range(max(1, len(heard) - k + 1))]
        for w in windows:
            r = SequenceMatcher(None, " ".join(w), " ".join(want)).ratio()
            if r >= best:
                best, found = r, q
    return found


def segment_score(sim, margin, ovrl, utmos, halves=None):
    """How good a candidate is as reference audio: mostly how surely it's the
    speaker (similarity to their voiceprint, and margin over every other crew
    voice), then how clean (DNSMOS overall) and natural (UTMOS) it sounds, less
    a cost when its two halves sound like different people."""
    split = 0.5 * max(0.0, 0.35 - halves) if halves is not None else 0.0
    return sim + 0.5 * margin + 0.15 * (ovrl - 3) + 0.1 * (utmos - 3) - split


def take_score(wer, sim, utmos, wps):
    """How good a take of a line is, or None when it isn't usable: wrong words
    (WER over a third) or a pace no one talks at (words per second)."""
    if wer > 0.34 or not 0.8 <= wps <= 6.0:
        return None
    return sim + 0.15 * (utmos - 3) - 1.5 * wer


def choose(segments, longest=LONGEST, enough=7.0, most=3):
    """The segments a reference is made of: up to `most` from one source, at
    most `longest` seconds in all, with the best duration-weighted score, less
    a cost for falling short of `enough` seconds. In the order they were said."""
    best, value = [], float("-inf")
    for source in {s["source"] for s in segments}:
        mine = sorted((s for s in segments if s["source"] == source), key=lambda s: -s["score"])[:10]
        for k in range(1, most + 1):
            for group in combinations(mine, k):
                total = sum(s["end"] - s["start"] for s in group)
                if total > longest:
                    continue
                mean = sum(s["score"] * (s["end"] - s["start"]) for s in group) / total
                v = mean - 0.6 * max(0.0, enough - total) / enough
                if v > value:
                    best, value = list(group), v
    return sorted(best, key=lambda s: s["start"])
