#!/usr/bin/env python3
"""References for the characters with no voice of their own to clone: the site's invented
villagers and the like. Their sources say how they sound ({"design": "an elderly, warm..."}),
Qwen3-TTS VoiceDesign says a few of their own lines in that voice several times over, and the
judge keeps the take it hears best (every word there, natural) as refs/<who>.wav, with the
words in refs/<who>.txt. generate.py then clones from it like any other reference.

    python scripts/voices/design.py                 every designed voice with no reference yet
    python scripts/voices/design.py --only nana     just these
    python scripts/voices/design.py --refresh       make them all again

Runs the VoiceDesign model in the qwen engine's venv (engines/README.md).
"""

import argparse
import json
import subprocess
import sys

from common import CACHE, HERE, REFS, console, read, speakable, write

import engines
from grab import configs

DESIGN = CACHE / "design"
# a passage of the voice's own lines this long: long enough to learn the voice from, short
# enough (under 11.5 s) for every engine to take whole
LEAST, MOST = 18, 30
# what to say when a voice has no lines yet
STANDIN = "Well, hello there. I didn't see you come in. Sit down, if you like, and tell me what brings you all the way out here today."


def passage(lines):
    """Some of a voice's own lines, whole, LEAST to MOST words in all, or the stand-in."""
    said = []
    for text in sorted({speakable(t) for t in lines}, key=len):
        if len(" ".join(said + [text]).split()) <= MOST:
            said.append(text)
        if len(" ".join(said).split()) >= LEAST:
            break
    return " ".join(said) if len(" ".join(said).split()) >= LEAST // 2 else STANDIN


def score(meant, wav, judge):
    heard = judge.hear(wav)
    w = judge.wer(meant, heard)
    mos = judge.naturalness(wav)
    seconds = len(wav) / 16000
    ok = w <= 0.15 and 3.0 <= seconds <= 11.5
    return {"heard": heard, "wer": round(w, 3), "utmos": round(mos, 2), "seconds": round(seconds, 2), "score": round(mos - 3 * w, 3) if ok else None}


def main():
    console()
    ap = argparse.ArgumentParser(description="Make the designed voices' references.")
    ap.add_argument("--only", help="just these voices, comma-separated")
    ap.add_argument("--takes", type=int, default=6, help="takes to choose each reference from")
    ap.add_argument("--refresh", action="store_true", help="make references that are there already again")
    args = ap.parse_args()

    only = set(args.only.split(",")) if args.only else None
    designs = {w: c["design"] for w, c in configs().items() if c.get("design") and (not only or w in only)}
    todo = {w: d for w, d in designs.items() if args.refresh or not (REFS / f"{w}.wav").exists()}
    if not todo:
        print("Every designed voice has its reference (--refresh makes them again).")
        return
    python = engines.python("qwen")
    if not python:
        sys.exit("The qwen engine's venv isn't set up: see scripts/voices/engines/README.md")
    lines_file = HERE / "lines.json"
    lines = json.loads(lines_file.read_text(encoding="utf-8")) if lines_file.exists() else []
    texts = {w: passage([l["text"] for l in lines if l["who"] == w]) for w in todo}
    items = [{"who": w, "text": texts[w], "out": str(DESIGN / w / f"{k}.wav"), "seed": 7000 + k} for w in todo for k in range(args.takes)]
    DESIGN.mkdir(parents=True, exist_ok=True)
    jobs = DESIGN / "jobs.json"
    jobs.write_text(json.dumps({"voices": {w: {"wav": "", "design": d} for w, d in todo.items()}, "items": items}), encoding="utf-8")
    print(f"Designing {len(todo)} voices, {args.takes} takes each")
    with open(DESIGN / "design.log", "a", encoding="utf-8") as log:
        r = subprocess.run([python, str(HERE / "engines" / "design.py"), str(jobs)], stdout=subprocess.PIPE, stderr=log, text=True, encoding="utf-8", errors="replace", cwd=str(HERE / "engines"))
    fails = [l for l in r.stdout.splitlines() if l.startswith("fail")]
    for f in fails:
        print(f"  ({f.split(chr(9), 2)[-1]})")

    import judge

    REFS.mkdir(parents=True, exist_ok=True)
    for w, d in todo.items():
        takes = [(k, DESIGN / w / f"{k}.wav") for k in range(args.takes)]
        scored = [(k, f, score(texts[w], read(f), judge)) for k, f in takes if f.exists()]
        good = sorted([t for t in scored if t[2]["score"] is not None], key=lambda t: -t[2]["score"])
        if not good:
            print(f"{w}: no take came out right (cache/design/{w}/); try --takes 12, or a shorter passage")
            continue
        k, f, s = good[0]
        write(REFS / f"{w}.wav", read(f, 24000), 24000)
        (REFS / f"{w}.txt").write_text(texts[w] + "\n", encoding="utf-8")
        (REFS / f"{w}.json").write_text(json.dumps({"design": d, "take": k, **s}, indent=1), encoding="utf-8")
        print(f"{w}: take {k}, UTMOS {s['utmos']}, WER {s['wer']}, {s['seconds']} s: “{texts[w]}”")


if __name__ == "__main__":
    main()
