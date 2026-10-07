#!/usr/bin/env python3
"""Each voice's bank: every line grab.py heard that is surely them, cut out clean.

grab.py listens to every scene it fetches, and keeps each utterance's words, voiceprint and how
clean it sounds (cache/grab/segments/), and each voice's voiceprint centroid
(cache/grab/centroids.json). A reference uses a few seconds of that; the bank keeps all of it
that is the speaker: like their centroid, more like them than like any other voice by a clear
margin, one speaker throughout, not clipped. It's what finetune.py teaches a model the voice
from, and, with how each line feels (judge.feeling), what generate.py clones an angry line from
an angry scene of theirs with.

    python scripts/voices/bank.py                 every voice with a centroid
    python scripts/voices/bank.py --only han      just these

Writes cache/bank/<who>/<n>.wav (24 kHz) and cache/bank/<who>/bank.jsonl (audio, text and
scores per line), and prints how many minutes each voice has.
"""

import argparse
import json
from pathlib import Path

import numpy as np

import pick
from common import CACHE, console, read, write

GRAB = CACHE / "grab"
BANK = CACHE / "bank"
RATE = 24000
# the least spread of feeling a voice is taken to have (a small bank can look narrower than they are)
SPREAD_FLOOR = (0.1, 0.09, 0.1)


def chosen(segments, who, cents, least_sim=0.6, least_margin=0.15, shortest=1.2, longest=15.0):
    """The segments ({source: [segment, ...]}) that are surely `who`, best first, as
    [(source, segment, sim, margin)]."""
    out = []
    for sid, segs in segments.items():
        for g in segs:
            seconds = g["end"] - g["start"]
            if not g.get("vp") or not shortest <= seconds <= longest or g.get("clipped", 0) >= 0.002:
                continue
            if g.get("halves") is not None and g["halves"] < 0.35:  # its halves are two people
                continue
            sim, margin = pick.identify(np.asarray(g["vp"], dtype=np.float32), who, cents)
            if sim >= least_sim and margin >= least_margin:
                out.append((sid, g, sim, margin))
    out.sort(key=lambda x: -(x[2] + 0.5 * x[3]))
    return out


def load():
    cents = json.loads((GRAB / "centroids.json").read_text(encoding="utf-8"))
    cents = {w: np.asarray(c, dtype=np.float32) / np.linalg.norm(c) for w, c in cents.items()}
    segments = {}
    for f in sorted((GRAB / "segments").glob("*.json")):
        kept = json.loads(f.read_text(encoding="utf-8"))
        segments[f.stem] = kept.get("segments", [])
    return cents, segments


def main():
    console()
    ap = argparse.ArgumentParser(description="Bank every line that is surely each voice.")
    ap.add_argument("--only", help="just these voices, comma-separated")
    ap.add_argument("--least-sim", type=float, default=0.6, help="how like the voice's centroid a line must be")
    ap.add_argument("--least-margin", type=float, default=0.15, help="by how much more than like any other voice")
    args = ap.parse_args()

    cents, segments = load()
    only = set(args.only.split(",")) if args.only else None
    for who in sorted(cents):
        if only and who not in only:
            continue
        lines = chosen(segments, who, cents, args.least_sim, args.least_margin)
        out = BANK / who
        out.mkdir(parents=True, exist_ok=True)
        for old in out.glob("*.wav"):
            old.unlink()
        rows, audio = [], {}
        for n, (sid, g, sim, margin) in sorted(enumerate(lines), key=lambda x: x[1][0]):  # a source at a time
            vocals = GRAB / "vocals" / f"{sid}.flac"
            if not vocals.exists():
                continue
            if sid not in audio:
                audio = {sid: read(vocals, RATE)}  # one source at a time: they're long
            piece = audio[sid][int(g["start"] * RATE) : int(g["end"] * RATE)].copy()
            fade = int(0.015 * RATE)
            piece[:fade] *= np.linspace(0, 1, fade, dtype=np.float32)
            piece[-fade:] *= np.linspace(1, 0, fade, dtype=np.float32)
            f = out / f"{n:04d}.wav"
            write(f, piece, RATE)
            rows.append({"n": n, "audio": str(f), "text": g["text"], "source": sid, "start": g["start"], "seconds": round(g["end"] - g["start"], 2), "sim": round(sim, 3), "margin": round(margin, 3), "utmos": g.get("utmos"), "ovrl": g.get("ovrl")})
        rows.sort(key=lambda r: r.pop("n"))
        if rows:  # how each line feels, for generate.py to clone each line from one that feels like it should
            import judge

            for r in rows:
                r["avd"] = judge.feeling(read(r["audio"]))
            avd = np.array([r["avd"] for r in rows])
            (out / "feel.json").write_text(json.dumps({"mean": avd.mean(0).round(3).tolist(), "spread": np.maximum(avd.std(0), SPREAD_FLOOR).round(3).tolist(), "lines": len(rows)}), encoding="utf-8")
        (out / "bank.jsonl").write_text("".join(json.dumps(r, ensure_ascii=False) + "\n" for r in rows), encoding="utf-8")
        minutes = sum(r["seconds"] for r in rows) / 60
        print(f"{who}: {len(rows)} lines, {minutes:.1f} min from {len({r['source'] for r in rows})} sources")


if __name__ == "__main__":
    main()
