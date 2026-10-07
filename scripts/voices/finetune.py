#!/usr/bin/env python3
"""A model of each voice's own: Qwen3-TTS 1.7B Base taught the speaker from every line of theirs in
their bank (bank.py), so it says new lines the way they do, not only in a voice like theirs.

For each voice: train for --epochs, keeping a few epochs (engines/qwen_sft.py, in the qwen venv);
have each kept epoch say some of the voice's own lines from lines.json; keep the epoch the judge
likes best (how like the speaker, every word there, natural) as cache/finetune/<who>/best; delete
the rest. The qwenft engine then makes that voice's takes with it: put "qwenft" in the voice's
"engine" in refs.json, beside its other engines, and each line keeps the best take of them all.

    python scripts/voices/finetune.py --only han          (a voice needs a bank: bank.py)
    python scripts/voices/finetune.py --only han --epochs 12 --force

Several GB a voice (a whole model each), and some minutes of the GPU.
"""

import argparse
import json
import os
import shutil
import subprocess
import sys

from common import CACHE, HERE, REFS, console, read

import engines
import pick

BANK = CACHE / "bank"
FT = CACHE / "finetune"
# fewer lines than this is too little to learn a voice from
LEAST_LINES, LEAST_MINUTES = 40, 3.0


def trial_lines(who, n):
    """n of the voice's own lines to try each epoch on: spread across their lines, of middling length."""
    lines = json.loads((HERE / "lines.json").read_text(encoding="utf-8"))
    mine = sorted((l for l in lines if l["who"] == who and 4 <= len(l["text"].split()) <= 20), key=lambda l: l["id"])
    step = max(1, len(mine) // n)
    return mine[::step][:n]


def try_epoch(who, ckpt, lines, voice, judge, cent, takes=2):
    """The epoch's mean take score on `lines` (a take that fails counts as -1)."""
    out = FT / who / "trial" / ckpt.name
    items = [{"who": who, "text": pick_text(l), "out": str(out / f"{l['id']}.{k}.wav"), "seed": 4242 + k} for l in lines for k in range(takes)]
    jobs = out / "jobs.json"
    out.mkdir(parents=True, exist_ok=True)
    jobs.write_text(json.dumps({"voices": {who: voice}, "items": items}), encoding="utf-8")
    env = {**os.environ, "QWENFT_CKPT": str(ckpt), "PYTHONIOENCODING": "utf-8", "PYTHONWARNINGS": "ignore"}
    with open(out / "worker.log", "a", encoding="utf-8") as log:
        subprocess.run([engines.python("qwen"), str(HERE / "engines" / "qwenft.py"), str(jobs)], stdout=subprocess.DEVNULL, stderr=log, env=env, cwd=str(HERE / "engines"))
    ref = judge.voiceprint(read(voice["wav"]))
    scores, sims = [], []
    for it in items:
        if not os.path.exists(it["out"]):
            scores.append(-1.0)
            continue
        wav = read(it["out"])
        heard = judge.hear(wav)
        wer = judge.wer(it["text"], heard)
        vp = judge.voiceprint(wav)
        sim = float(vp @ ref) if cent is None else (float(vp @ ref) + float(vp @ cent)) / 2
        spans = judge.speech(wav)
        talk = spans[-1][1] - spans[0][0] if spans else len(wav) / judge.SR
        s = pick.take_score(wer, sim, judge.naturalness(wav), len(pick.normal(it["text"]).split()) / max(talk, 0.1))
        scores.append(-1.0 if s is None else s)
        sims.append(sim)
    return sum(scores) / len(scores), (sum(sims) / len(sims) if sims else 0.0)


def pick_text(line):
    from common import speakable

    return speakable(line["text"])


def main():
    console()
    ap = argparse.ArgumentParser(description="Teach Qwen3-TTS each voice from its bank.")
    ap.add_argument("--only", required=True, help="the voices, comma-separated")
    ap.add_argument("--epochs", type=int, default=10)
    ap.add_argument("--save", default="2,4,6,8,10", help="the epochs to try (and keep the best of)")
    ap.add_argument("--lr", type=float, default=1e-5)
    ap.add_argument("--trials", type=int, default=8, help="lines each kept epoch says, to choose by")
    ap.add_argument("--force", action="store_true", help="train even on a small bank, or again over a model already made")
    args = ap.parse_args()

    python = engines.python("qwen")
    if not python:
        sys.exit("The qwen engine's venv isn't set up: see scripts/voices/engines/README.md")
    import judge
    from generate import centroids

    cents = centroids()
    for who in args.only.split(","):
        bank = BANK / who / "bank.jsonl"
        best = FT / who / "best"
        if (best / "model.safetensors").exists() and not args.force:
            print(f"{who}: has a model already ({best}); --force makes it again")
            continue
        if not bank.exists():
            print(f"{who}: no bank yet: python scripts/voices/bank.py --only {who}")
            continue
        rows = [json.loads(l) for l in bank.read_text(encoding="utf-8").splitlines() if l.strip()]
        minutes = sum(r["seconds"] for r in rows) / 60
        if (len(rows) < LEAST_LINES or minutes < LEAST_MINUTES) and not args.force:
            print(f"{who}: only {len(rows)} lines, {minutes:.1f} min in the bank: too little to learn from (grab more scenes, or --force)")
            continue
        ref = REFS / f"{who}.wav"
        voice = {"wav": str(ref), "text": (REFS / f"{who}.txt").read_text(encoding="utf-8").strip()}
        work = FT / who
        work.mkdir(parents=True, exist_ok=True)
        train = work / "train.jsonl"
        train.write_text("".join(json.dumps({"audio": r["audio"], "text": r["text"], "ref_audio": str(ref)}, ensure_ascii=False) + "\n" for r in rows), encoding="utf-8")
        print(f"{who}: training on {len(rows)} lines, {minutes:.1f} min, {args.epochs} epochs")
        with open(work / "train.log", "a", encoding="utf-8") as log:
            r = subprocess.run([python, str(HERE / "engines" / "qwen_sft.py"), "--train", str(train), "--out", str(work), "--speaker", who, "--epochs", str(args.epochs), "--save", args.save, "--lr", str(args.lr)], stdout=log, stderr=subprocess.STDOUT, cwd=str(HERE / "engines"), env={**os.environ, "PYTHONIOENCODING": "utf-8"})
        if r.returncode:
            print(f"{who}: training stopped (exit {r.returncode}): see {work / 'train.log'}")
            continue
        lines = trial_lines(who, args.trials)
        tried = {}
        for ckpt in sorted(work.glob("epoch-*"), key=lambda p: int(p.name.split("-")[1])):
            tried[ckpt.name] = try_epoch(who, ckpt, lines, voice, judge, cents.get(who))
            print(f"  {ckpt.name}: score {tried[ckpt.name][0]:.3f}, likeness {tried[ckpt.name][1]:.3f}")
        if not tried:
            print(f"{who}: no epoch was saved: see {work / 'train.log'}")
            continue
        win = max(tried, key=lambda k: tried[k][0])
        if best.exists():
            shutil.rmtree(best)
        (work / win).rename(best)
        for ckpt in work.glob("epoch-*"):
            shutil.rmtree(ckpt)
        (work / "report.json").write_text(json.dumps({"bank_lines": len(rows), "bank_minutes": round(minutes, 2), "epochs": args.epochs, "lr": args.lr, "tried": tried, "best": win}, indent=1), encoding="utf-8")
        print(f"{who}: kept {win} as {best}")


if __name__ == "__main__":
    main()
