#!/usr/bin/env python3
"""The crews' unrecorded lines, made in their own voices.

Each line in scripts/voices/lines.json is said several times (takes) by the
voice's engine (refs.json), cloning from the reference grab.py built
(refs/<who>.wav and its transcript). The judge listens to every take (what
Whisper hears against what was meant, how like the reference it sounds, how
natural) and the best one becomes public/audio/voiced/<who>/<id>.mp3; a line
none of whose takes pass gets a second round with twice as many. The
manifest.json the site looks lines up in (src/lib/voiced.js) is kept up to
date as it goes. That folder is git-ignored: the lines stay on this machine,
or wherever you serve them from behind the sign-in, and never go out with the
public repository or the GitHub Pages build.

    npm run voices:lines                            list the lines (again after editing any)
    python scripts/voices/grab.py                   build the references
    python scripts/voices/generate.py --check       show the references and engines
    python scripts/voices/generate.py --bakeoff 6   try every engine on 6 lines a voice
    python scripts/voices/generate.py --limit 10    make a few
    python scripts/voices/generate.py               make everything that's missing

Takes and their scores are cached in scripts/voices/cache/takes/, so a rerun
picks up where it stopped; cache/takes/report.md lists the lines whose best
take still didn't pass. Setup is in README.md beside this file.
"""

import argparse
import json
import os
import re
import subprocess
import sys
import time
from pathlib import Path

import engines
import pick
from common import CACHE, HERE, OUT, REFS, ROOT, console, ffmpeg, read, run, speakable

TAKES = CACHE / "takes"
ROUNDS = 2  # a line with no passing take gets another round, with twice the takes


def references(cfg, only):
    """{who: {"wav", "text", "speed"}} for each voice with a reference: grab.py's, or your own refs/<who>.wav."""
    found = {}
    for who in sorted(cfg):
        if only and who not in only:
            continue
        wav, txt = REFS / f"{who}.wav", REFS / f"{who}.txt"
        if not wav.exists():
            print(f"{who}: no reference yet: python scripts/voices/grab.py --only {who}  (or put 5 to 11 seconds of them at refs/{who}.wav)")
            continue
        if not txt.exists() or not txt.read_text(encoding="utf-8").strip():
            import judge

            txt.write_text(judge.hear(read(wav)) + "\n", encoding="utf-8")
        found[who] = {"wav": str(wav), "text": txt.read_text(encoding="utf-8").strip(), "speed": float(cfg[who].get("speed", 1.0))}
    return found


def engine_for(who, cfg, override):
    want = override or cfg.get(who, {}).get("engine")
    for e in ([want] if want else []) + engines.PREFERENCE:
        if e in engines.VENVS and engines.python(e):
            if want and e != want:
                print(f"{who}: {want} isn't set up here (engines/README.md), so {e}")
            return e
    sys.exit("No TTS engine is set up here: see scripts/voices/engines/README.md")


def take_path(engine, line, k):
    return TAKES / engine / line["who"] / f"{line['id']}.{k}.wav"


def seed(line, k):
    return (int(line["id"], 16) + 7919 * k) % 2**31


class Judge:
    """Scores takes (pick.take_score) and remembers every score in cache/takes/scores.jsonl."""

    def __init__(self, voices):
        import judge

        self.j = judge
        self.prints = {who: judge.voiceprint(read(v["wav"])) for who, v in voices.items()}
        self.file = TAKES / "scores.jsonl"
        self.known = {}
        if self.file.exists():
            for line in self.file.read_text(encoding="utf-8").splitlines():
                d = json.loads(line)
                self.known[d["take"]] = d

    def forget(self, take):
        self.known.pop(str(Path(take).relative_to(TAKES)), None)

    def __call__(self, who, text, take):
        key = str(Path(take).relative_to(TAKES))
        if key in self.known:
            return self.known[key]
        wav = read(take)
        heard = self.j.hear(wav)
        spans = self.j.speech(wav)
        talk = spans[-1][1] - spans[0][0] if spans else len(wav) / self.j.SR
        d = {"take": key, "heard": heard, "wer": round(self.j.wer(text, heard), 3), "sim": round(float(self.j.voiceprint(wav) @ self.prints[who]), 3), "utmos": self.j.naturalness(wav), "wps": round(len(pick.normal(text).split()) / max(talk, 0.1), 2), "speech": [spans[0][0], spans[-1][1]] if spans else None}
        d["score"] = pick.take_score(d["wer"], d["sim"], d["utmos"], d["wps"])
        self.known[key] = d
        TAKES.mkdir(parents=True, exist_ok=True)
        with open(self.file, "a", encoding="utf-8") as f:
            f.write(json.dumps(d) + "\n")
        return d


def best(scores):
    """(the best take's score, whether it passed): the highest scoring that passed, else the one with the fewest wrong words."""
    passed = [d for d in scores if d["score"] is not None]
    if passed:
        return max(passed, key=lambda d: d["score"]), True
    return (min(scores, key=lambda d: (d["wer"], -d["sim"])) if scores else None), False


def make(engine, lines, voices, judge, takes, done):
    """Every line through `engine`, `takes` takes each (and a second round for the ones that don't pass);
    done(line, score, passed) as each line is decided, while the worker goes on with the rest."""
    pending = {l["id"]: l for l in lines}
    first = 0
    for rnd in range(ROUNDS):
        count = takes * 2**rnd
        ks = range(first, first + count)
        first += count
        mine = {lid: [take_path(engine, l, k) for k in range(first)] for lid, l in pending.items()}
        items = [{"who": l["who"], "text": speakable(l["text"]), "out": str(take_path(engine, l, k)), "seed": seed(l, k)} for l in pending.values() for k in ks]
        if not items:
            return
        got = {lid: {} for lid in pending}  # take -> score, or None when the engine failed it
        owner = {str(take_path(engine, l, k)): l for l in pending.values() for k in range(first)}

        def arrive(path, score):
            l = owner[path]
            got[l["id"]][path] = score
            if l["id"] in pending and len(got[l["id"]]) == len(mine[l["id"]]):
                d, ok = best([s for s in got[l["id"]].values() if s])
                if ok or rnd == ROUNDS - 1:
                    done(l, d, ok)
                    del pending[l["id"]]

        for path, l in list(owner.items()):
            if Path(path).exists():
                arrive(path, judge(l["who"], speakable(l["text"]), path))
        need = [it for it in items if not Path(it["out"]).exists()]
        if need:
            TAKES.mkdir(parents=True, exist_ok=True)
            jobs = TAKES / f"jobs-{engine}.json"
            jobs.write_text(json.dumps({"voices": voices, "items": need}), encoding="utf-8")
            worker = engines.start(engine, jobs, TAKES / f"{engine}.log")
            for out in worker.stdout:
                status, path, why = (out.rstrip("\n").split("\t") + ["", ""])[:3]
                if status == "ok" and path in owner:
                    arrive(path, judge(owner[path]["who"], speakable(owner[path]["text"]), path))
                elif status == "fail" and path in owner:
                    print(f"  ({engine} couldn't make {Path(path).name}: {why})")
                    arrive(path, None)
            if worker.wait():
                print(f"  ({engine} stopped early, exit {worker.returncode}: see {(TAKES / f'{engine}.log').relative_to(ROOT)})")
        for lid, l in list(pending.items()):  # whatever the worker never made counts as failed
            for path in mine[lid]:
                if str(path) not in got[lid]:
                    arrive(str(path), None)
        if not pending:
            return


def loudness(f):
    """ffmpeg loudnorm's measurement of a file, for the second (linear) pass."""
    r = subprocess.run([ffmpeg(), "-hide_banner", "-i", str(f), "-af", "loudnorm=I=-16:TP=-1.5:LRA=11:print_format=json", "-f", "null", "-"], capture_output=True, text=True, errors="replace")
    m = re.search(r"\{[^{}]*\"input_i\"[^{}]*\}", r.stderr)
    return json.loads(m[0]) if m else None


def publish(take, span, mp3):
    """A take as the site's mp3: trimmed to the speech, at -16 LUFS, mono."""
    import soundfile as sf

    wav, sr = sf.read(str(take), dtype="float32")
    if span:
        wav = wav[max(0, int((span[0] - 0.05) * sr)) : int((span[1] + 0.2) * sr)]
    tmp = CACHE / "publish.wav"
    sf.write(str(tmp), wav, sr, subtype="PCM_16")
    m = loudness(tmp)
    norm = f"loudnorm=I=-16:TP=-1.5:LRA=11:measured_I={m['input_i']}:measured_TP={m['input_tp']}:measured_LRA={m['input_lra']}:measured_thresh={m['input_thresh']}:offset={m['target_offset']}:linear=true" if m and m["input_i"] != "-inf" else "loudnorm=I=-16:TP=-1.5"
    mp3.parent.mkdir(parents=True, exist_ok=True)
    run([ffmpeg(), "-y", "-hide_banner", "-i", tmp, "-af", f"highpass=f=60,{norm}", "-ac", "1", "-ar", str(48000 if sr >= 44100 else 24000), "-b:a", "96k" if sr >= 44100 else "64k", mp3])


def main():
    console()
    ffmpeg()
    ap = argparse.ArgumentParser(description="Make the crews' unrecorded lines in their own voices.")
    ap.add_argument("--only", help="just these speakers, comma-separated (walt,jesse)")
    ap.add_argument("--limit", type=int, help="make at most this many lines, to try it out")
    ap.add_argument("--takes", type=int, default=4, help="takes of each line to choose from (a line none pass gets twice as many more)")
    ap.add_argument("--engine", choices=list(engines.VENVS), help="use this engine for every voice (default: refs.json's per voice)")
    ap.add_argument("--force", action="store_true", help="make lines again even if they're already there")
    ap.add_argument("--check", action="store_true", help="show each voice's reference and engine, and stop")
    ap.add_argument("--bakeoff", type=int, metavar="N", help="try every engine set up here on N lines a voice, score them, and stop")
    args = ap.parse_args()

    lines_file = HERE / "lines.json"
    if not lines_file.exists():
        sys.exit("No scripts/voices/lines.json yet: run  npm run voices:lines  first")
    lines = json.loads(lines_file.read_text(encoding="utf-8"))
    cfg = json.loads((HERE / "refs.json").read_text(encoding="utf-8"))
    only = set(args.only.split(",")) if args.only else None
    voices = references(cfg, only)
    if not voices:
        return
    engine_of = {who: engine_for(who, cfg, args.engine) for who in voices}
    for who, v in voices.items():
        print(f"{who}: {engine_of[who]}, reference {Path(v['wav']).name} saying “{v['text']}”")
    if args.check:
        print(f"\nEngines set up here: {', '.join(engines.available())}. A wrong transcript makes worse lines: fix it in refs/<who>.txt (it's used as written).")
        return

    judge = Judge(voices)
    if args.bakeoff:
        return bakeoff(lines, voices, judge, args.bakeoff, args.takes)

    def mp3(l):
        return OUT / l["who"] / f"{l['id']}.mp3"

    def write_manifest():
        made = {l["id"]: f"{l['who']}/{l['id']}.mp3" for l in lines if mp3(l).exists()}
        OUT.mkdir(parents=True, exist_ok=True)
        tmp = OUT / "manifest.json.tmp"
        tmp.write_text(json.dumps({"version": 1, "lines": made}, indent=0), encoding="utf-8")
        os.replace(tmp, OUT / "manifest.json")

    todo = [l for l in lines if l["who"] in voices and (args.force or not mp3(l).exists())]
    if args.limit:
        todo = todo[: args.limit]
    if args.force:
        for l in todo:
            for p in (TAKES / engine_of[l["who"]] / l["who"]).glob(f"{l['id']}.*.wav"):
                judge.forget(p)
                p.unlink()
    print(f"\nMaking {len(todo)} lines into public/audio/voiced/, {args.takes} takes each")
    started, made, doubtful = time.time(), [], []

    def done(l, d, ok):
        if d:
            publish(TAKES / d["take"], d["speech"], mp3(l))
        made.append(l)
        if not ok:
            doubtful.append((l, d))
        left = (time.time() - started) / len(made) * (len(todo) - len(made))
        said = f"sim {d['sim']:.2f} wer {d['wer']:.2f} mos {d['utmos']:.1f}" if d else "no take"
        print(f"[{len(made)}/{len(todo)}, ~{left / 60:.0f} min left] {l['who']}: {l['text']}  ({said}{'' if ok else ', DOUBTFUL'})")
        if len(made) % 20 == 0:
            write_manifest()

    for engine in sorted(set(engine_of.values())):
        make(engine, [l for l in todo if engine_of[l["who"]] == engine], voices, judge, args.takes, done)
    write_manifest()
    report = ["# Lines whose best take didn't pass", "", "Listen, then delete the mp3 and run again (it makes new takes), or fix the line.", "", "| who | line | heard | wer | sim |", "|---|---|---|---|---|"]
    report += [f"| {l['who']} | {l['text']} | {d['heard'] if d else '-'} | {d['wer'] if d else '-'} | {d['sim'] if d else '-'} |" for l, d in doubtful]
    TAKES.mkdir(parents=True, exist_ok=True)
    (TAKES / "report.md").write_text("\n".join(report) + "\n", encoding="utf-8")
    print(f"\nDone: {len(made)} lines, {len(doubtful)} doubtful (cache/takes/report.md). npm run dev and fly: the crews speak these where they have no clip.")


def bakeoff(lines, voices, judge, n, takes):
    """The same few lines a voice through every engine set up here: which sounds most like them, says the words, and sounds natural."""
    sample = []
    for who in voices:
        mine = [l for l in lines if l["who"] == who]
        sample += [mine[i * len(mine) // n] for i in range(min(n, len(mine)))]
    results = {}
    for engine in engines.available():
        print(f"\n{engine}")
        got = results.setdefault(engine, {})
        make(engine, sample, voices, judge, takes, lambda l, d, ok: got.setdefault(l["who"], []).append((d, ok)))
    table = {}
    print("\n| voice | engine | passed | sim | wer | UTMOS | quality |\n|---|---|---|---|---|---|---|")
    for who in voices:
        for engine, got in results.items():
            rows = got.get(who, [])
            ds = [d for d, _ in rows if d]
            if not ds:
                continue
            quality = sum(d["score"] if ok else -0.5 for d, ok in rows) / len(rows)
            table.setdefault(who, {})[engine] = {"passed": sum(ok for _, ok in rows) / len(rows), "sim": sum(d["sim"] for d in ds) / len(ds), "wer": sum(d["wer"] for d in ds) / len(ds), "utmos": sum(d["utmos"] for d in ds) / len(ds), "quality": quality}
            t = table[who][engine]
            print(f"| {who} | {engine} | {t['passed']:.0%} | {t['sim']:.3f} | {t['wer']:.3f} | {t['utmos']:.2f} | {t['quality']:.3f} |")
    winners = {who: max(t, key=lambda e: t[e]["quality"]) for who, t in table.items()}
    (CACHE / "bakeoff.json").write_text(json.dumps({"table": table, "winners": winners}, indent=1), encoding="utf-8")
    print(f"\nBest per voice: {', '.join(f'{w} {e}' for w, e in winners.items())}. Put them in refs.json as \"engine\" (cache/bakeoff.json has the numbers); the takes made here are kept for the real run.")


if __name__ == "__main__":
    main()
