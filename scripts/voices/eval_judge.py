#!/usr/bin/env python3
"""Tier 5, the hearing judge still hears right (scripts/ai-e2e/README.md).

The ears generate.py keeps the best take with (Whisper for the words, WavLM
for whose voice, UTMOS for how natural; judge.py) over a dozen labelled
takes in scripts/ai-e2e/evals/takes/: labels.json gives each take's line,
its speaker and whether it is a good take; refs/<who>.* is a reference of
each speaker. A judge that drifts lets a wrong line ship, or turns down
every right one.

    python scripts/voices/eval_judge.py [--takes DIR] [--out FILE]

The lines: the word error rate on the good takes at most 10% (Whisper
large-v3 on clean speech does far better; a jump means the model or its
settings changed); the labelled speaker's reference the most alike for at
least 90% of the good takes; and every bad take scoring under every good one
on the combined score generate.py ranks takes by (pick.take_score), since
that ordering is all the pipeline uses the judge for. Writes
results/<date>-hearing.json (AI_RESULTS for elsewhere); exits 1 under a line.
"""

import argparse
import datetime
import json
import os
import sys
from pathlib import Path

import pick
from common import console, ears, ffmpeg, read, speakable

ROOT = Path(__file__).resolve().parents[2]
TAKES = ROOT / "scripts" / "ai-e2e" / "evals" / "takes"
LINES = {"wer": 0.10, "speaker_first": 0.90}
AUDIO = (".wav", ".mp3", ".flac", ".ogg")


def listen(j, take):
    """The take about to be heard (the fake ears find what was said by its file; the real ones need nothing)."""
    if hasattr(j, "listening"):
        j.listening(take)


def evaluate(folder):
    folder = Path(folder)
    j = ears()
    labels = json.loads((folder / "labels.json").read_text(encoding="utf-8"))
    refs = {}
    for f in sorted((folder / "refs").iterdir()):
        if f.suffix.lower() in AUDIO and not f.name.endswith(".said.json"):
            listen(j, None)
            refs[f.stem] = j.voiceprint(read(f))
    rows = []
    for take, l in labels.items():
        f = folder / take
        listen(j, f)
        wav = read(f)
        heard = j.hear(wav)
        spans = j.speech(wav)
        talk = spans[-1][1] - spans[0][0] if spans else len(wav) / j.SR
        vp = j.voiceprint(wav)
        sims = {who: round(float(vp @ ref), 4) for who, ref in refs.items()}
        # heard against what the engine was asked to say, as generate.py judges a take (no bracketed asides, plain quotes)
        said = speakable(l["text"])
        wer = round(j.wer(said, heard), 4)
        utmos = j.naturalness(wav)
        wps = round(len(pick.normal(said).split()) / max(talk, 0.1), 2)
        score = pick.take_score(wer, sims.get(l["who"], 0.0), utmos, wps)
        rows.append({"take": take, "who": l["who"], "good": l["good"], "heard": heard, "wer": wer, "sims": sims, "utmos": utmos, "wps": wps, "score": score, "first": max(sims, key=sims.get) if sims else None})
    good = [r for r in rows if r["good"]]
    bad = [r for r in rows if not r["good"]]
    worth = lambda r: float("-inf") if r["score"] is None else r["score"]
    first = [r for r in good if r["sims"] and r["sims"].get(r["who"], -1) >= max(r["sims"].values())]
    return {
        "good": len(good),
        "bad": len(bad),
        "wer": round(sum(r["wer"] for r in good) / len(good), 4) if good else 0.0,
        "speaker_first": len(first) / len(good) if good else 1.0,
        "ordered": not good or not bad or max(worth(r) for r in bad) < min(worth(r) for r in good),
        "rows": rows,
    }


def short(r):
    """What fell short of the lines, in words; none means the judge passes."""
    out = []
    if r["wer"] > LINES["wer"]:
        out.append(f"word error rate {r['wer']:.0%} on the good takes, over {LINES['wer']:.0%}")
    if r["speaker_first"] < LINES["speaker_first"]:
        out.append(f"the right speaker first for {r['speaker_first']:.0%}, under {LINES['speaker_first']:.0%}")
    if not r["ordered"]:
        out.append("a bad take scored over a good one")
    return out


def main():
    console()
    ffmpeg()
    ap = argparse.ArgumentParser(description="How well the voices' judge still hears.")
    ap.add_argument("--takes", default=str(TAKES), help="a folder of takes with labels.json and refs/")
    ap.add_argument("--out", help="where the results go (default results/<date>-hearing.json)")
    args = ap.parse_args()
    r = evaluate(args.takes)
    miss = short(r)
    out = Path(args.out) if args.out else Path(os.environ.get("AI_RESULTS", ROOT / "scripts" / "ai-e2e" / "results")) / f"{datetime.date.today().isoformat()}-hearing.json"
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps({"tier": "evals", "name": "hearing", "ok": not miss, "short": miss, "lines": LINES, **r}, indent=1) + "\n", encoding="utf-8")
    print(f"word error rate {r['wer']:.1%} on {r['good']} good takes; the right speaker first for {r['speaker_first']:.0%}; bad under good: {'yes' if r['ordered'] else 'NO'}")
    print(f"under the line: {'; '.join(miss)}" if miss else "the judge is above every line")
    print(out)
    sys.exit(1 if miss else 0)


if __name__ == "__main__":
    main()
