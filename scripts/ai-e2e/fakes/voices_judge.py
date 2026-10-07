"""The fake ears (VOICES_JUDGE=fake): what generate.py's judge listens with
in a contract test, in place of Whisper, WavLM and UTMOS, with no models and
no torch. The same functions as scripts/voices/judge.py, answering from the
sidecar the fake worker wrote beside each take (voices_worker.py):

    hear       the words the sidecar says were said
    voiceprint a unit vector whose dot with the reference's is the sidecar's similarity (0.9, or 0.3 for a bad take)
    naturalness 4.0
    speech     the whole take
    wer        word error rate, by edit distance over words

generate.py tells it which take it is about to hear (listening(take)), since
the real ears' functions take samples and the sidecar is found by file.
"""

import json
import re
from pathlib import Path

import numpy as np

SR = 16000
current = None


def listening(take):
    """The take about to be heard, or None for a reference."""
    global current
    current = Path(take) if take else None


def _sidecar():
    if current is None:
        return None
    f = Path(f"{current}.said.json")
    return json.loads(f.read_text(encoding="utf-8")) if f.exists() else None


def hear(wav, words=False):
    s = _sidecar()
    text = s["said"] if s else ""
    return (text, []) if words else text


def _words(text):
    return re.sub(r"[^a-z0-9' ]+", " ", text.lower()).split()


def wer(meant, heard_text):
    a, b = _words(meant), _words(heard_text)
    if not a:
        return 0.0 if not b else 1.0
    d = list(range(len(b) + 1))
    for i, x in enumerate(a, 1):
        prev, d[0] = d[0], i
        for j, y in enumerate(b, 1):
            prev, d[j] = d[j], min(d[j] + 1, d[j - 1] + 1, prev + (x != y))
    return min(1.0, d[len(b)] / len(a))


def voiceprint(wav):
    """A reference (no take being heard) is [1, 0]; a take sits at the sidecar's similarity to it."""
    s = _sidecar()
    if not s:
        return np.array([1.0, 0.0])
    sim = float(s["sim"])
    return np.array([sim, (1 - sim * sim) ** 0.5])


def naturalness(wav):
    return 4.0


def feeling(wav):
    """(arousal, dominance, valence): the fake hears every clip as even, neither calm nor agitated."""
    return (0.5, 0.5, 0.5)


def speech(wav, gap=0.3):
    return [(0.0, len(wav) / SR)] if len(wav) else []
