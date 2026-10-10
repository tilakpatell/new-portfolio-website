#!/usr/bin/env python3
"""The crews' unrecorded lines, made in their own voices.

Each line in scripts/voices/lines.json is said several times (takes) by the
voice's engine (refs.json), cloning from the reference grab.py built
(refs/<who>.wav and its transcript). The judge listens to every take (what
Whisper hears against what was meant, how like the reference it sounds, how
natural) and the best one becomes public/audio/voiced/<who>/<id>.mp3; a line
none of whose takes pass gets a second round with twice as many. The
manifest.json the site looks lines up in (src/lib/voiced.js) is kept up to
date as it goes; commit the folder and they go out with the site.

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
from datetime import datetime
from pathlib import Path

import engines
import pick
from common import CACHE, HERE, OUT, REFS, ROOT, console, ears, ffmpeg, read, run, speakable

# the judge hears takes with Whisper large-v3-turbo (judge.py): there are thousands of them
os.environ.setdefault("VOICES_WHISPER", "openai/whisper-large-v3-turbo")

TAKES = CACHE / "takes"
ROUNDS = 2  # a line with no passing take gets another round, with twice the takes
BANK = CACHE / "bank"
# how much a take loses for each of the speaker's spreads its feeling is off its line's direction
FEEL_WEIGHT = 0.1
# the feeling spread taken for a voice with no bank to measure theirs from
SPREAD = (0.14, 0.12, 0.14)
# a bank line good enough to clone a line from: long enough to carry the voice, surely them
REF_SECONDS, REF_SIM = (2.5, 11.5), 0.65


class Feels:
    """How each line should feel and what to clone it from. delivery.json gives each line a direction
    (an emotion and how strong); the speaker's bank (bank.py) says how they usually sound and how
    each real line of theirs feels. A line is cloned from the two real lines of theirs whose feeling
    is nearest where it should be (takes alternate between them), and the judge holds every take to
    that direction: so an angry line comes from an angry scene, and comes out angry."""

    def __init__(self, voices, judge):
        f = HERE / "delivery.json"
        self.delivery = json.loads(f.read_text(encoding="utf-8")) if f.exists() else {}
        self.voices = dict(voices)
        self.usual, self.refs = {}, {}
        for who, v in voices.items():
            feel = BANK / who / "feel.json"
            rows = BANK / who / "bank.jsonl"
            if feel.exists():
                self.usual[who] = json.loads(feel.read_text(encoding="utf-8"))
            mine = [{"key": who, "avd": judge.j.feeling(read(v["wav"]))}]  # their reference, first
            if rows.exists():
                for n, r in enumerate(json.loads(l) for l in rows.read_text(encoding="utf-8").splitlines() if l.strip()):
                    if r.get("avd") and REF_SECONDS[0] <= r["seconds"] <= REF_SECONDS[1] and r["sim"] >= REF_SIM:
                        key = f"{who}~{n}"
                        self.voices[key] = {"wav": r["audio"], "text": r["text"], "speed": v.get("speed", 1.0)}
                        mine.append({"key": key, "avd": tuple(r["avd"])})
            self.refs[who] = mine

    def direct(self, line):
        """Give the line its feeling to come out with ("feel", "spread") and what to clone it from ("voices")."""
        who, d = line["who"], self.delivery.get(line["id"])
        usual = self.usual.get(who) or {"mean": self.refs[who][0]["avd"], "spread": SPREAD}
        target = pick.feel_target(d["emotion"], d.get("intensity", 2), usual["mean"], usual["spread"]) if d else None
        line["voices"] = [who]
        if target is None:
            return line
        line["feel"], line["spread"] = target, tuple(usual["spread"])
        line["style"] = f"{d['emotion']}: {d['note']}" if d.get("note") else d["emotion"]
        ranked = sorted(self.refs[who], key=lambda r: pick.feel_distance(r["avd"], target, line["spread"]))
        line["voices"] = [r["key"] for r in ranked[:2]]
        return line


def references(cfg, only, speakers=()):
    """{who: {"wav", "text", "speed"}} for each voice (refs.json's, and whoever says a line) with a
    reference: grab.py's, or your own refs/<who>.wav."""
    found = {}
    for who in sorted((set(cfg) - {"*"}) | set(speakers)):
        if only and who not in only:
            continue
        wav, txt = REFS / f"{who}.wav", REFS / f"{who}.txt"
        if not wav.exists():
            print(f"{who}: no reference yet: python scripts/voices/grab.py --only {who}  (or put 5 to 11 seconds of them at refs/{who}.wav)")
            continue
        if not txt.exists() or not txt.read_text(encoding="utf-8").strip():
            txt.write_text(ears().hear(read(wav)) + "\n", encoding="utf-8")
        found[who] = {"wav": str(wav), "text": txt.read_text(encoding="utf-8").strip(), "speed": float(cfg.get(who, {}).get("speed", 1.0))}
    return found


def engines_for(who, cfg, override):
    """The engines a voice's lines are made with: refs.json's "engine" (one, or a list, every line then
    keeping the best take of them all; "*" for the voices with none of their own), or --engine; failing
    those, the first set up here.
    VOICES_ENGINE=fake: the contract tests' worker for every voice (scripts/ai-e2e/fakes/voices_worker.py)."""
    if os.environ.get("VOICES_ENGINE") == "fake":
        return ["fake"]
    # refs.json's "*" is every voice's that names none of its own
    want = [override] if override else cfg.get(who, {}).get("engine") or cfg.get("*", {}).get("engine") or []
    want = [want] if isinstance(want, str) else list(want)
    # qwenft is a model of the voice's own (finetune.py): only a voice that has one
    have = [e for e in want if e in engines.ENGINES and engines.python(e) and (e != "qwenft" or (CACHE / "finetune" / who / "best" / "model.safetensors").exists())]
    for e in want:
        if e not in have and e != "qwenft":
            print(f"{who}: {e} isn't set up here (engines/README.md)")
    if have:
        return have
    for e in engines.PREFERENCE:
        if engines.python(e):
            return [e]
    sys.exit("No TTS engine is set up here: see scripts/voices/engines/README.md")


def take_path(engine, line, k):
    return TAKES / engine / line["who"] / f"{line['id']}.{k}.wav"


def seed(line, k):
    """A take's seed: a line comes out the same way each time, until it's made again (its salt)."""
    return (int(line["id"], 16) + 7919 * k + 104729 * line.get("salt", 0)) % 2**31


def redo(line, engine, judge, salts):
    """New takes for a line: the old ones and their scores gone, and a new salt so they come out differently."""
    for p in (TAKES / engine / line["who"]).glob(f"{line['id']}.*.wav"):
        judge.forget(p)
        p.unlink()
    salts[line["id"]] = salts.get(line["id"], 0) + 1


def centroids():
    """Each voice's voiceprint centroid from every scene grab.py heard them in (cache/grab/centroids.json)."""
    f = CACHE / "grab" / "centroids.json"
    if not f.exists():
        return {}
    import numpy as np

    return {w: np.asarray(c, dtype=np.float32) / np.linalg.norm(c) for w, c in json.loads(f.read_text(encoding="utf-8")).items()}


def likeness(d):
    """How like the speaker a take is: as like the reference as like the speaker in all the scenes
    grab.py heard them in (their centroid), where there's one; else like the reference."""
    return d["sim"] if d.get("csim") is None else (d["sim"] + d["csim"]) / 2


class Judge:
    """Scores takes (pick.take_score) and remembers every score in cache/takes/scores.jsonl."""

    def __init__(self, voices):
        self.j = ears()
        self.prints = {who: self.j.voiceprint(read(v["wav"])) for who, v in voices.items()}
        self.cents = centroids()
        self.file = TAKES / "scores.jsonl"
        self.known = {}
        if self.file.exists():
            for line in self.file.read_text(encoding="utf-8").splitlines():
                d = json.loads(line)
                self.known[d["take"]] = d
        for d in self.known.values():
            d["score"] = pick.take_score(d["wer"], likeness(d), d["utmos"], d["wps"])  # by today's rules

    def centred(self, who, d):
        """Give d its likeness to the speaker's centroid (csim), from the take's audio."""
        take = TAKES / d["take"]
        if who in self.cents and take.exists():
            d["csim"] = round(float(self.j.voiceprint(read(take)) @ self.cents[who]), 3)
            d["score"] = pick.take_score(d["wer"], likeness(d), d["utmos"], d["wps"])
            self.keep(d)

    def forget(self, take):
        self.known.pop(str(Path(take).relative_to(TAKES)), None)

    def __call__(self, who, text, take, feel=None, spread=SPREAD):
        """A take's scores, its score held to the line's feeling when it has one."""
        d = self.scored(who, text, take)
        if feel is None or d["score"] is None or not d.get("heard"):
            return d
        if d.get("avd") is None:
            d["avd"] = self.j.feeling(read(TAKES / d["take"]))
            self.keep(d)
        off = pick.feel_distance(d["avd"], feel, spread)
        return {**d, "feel": round(off, 2), "score": d["score"] - FEEL_WEIGHT * off}

    def scored(self, who, text, take):
        key = str(Path(take).relative_to(TAKES))
        if key in self.known:
            d = self.known[key]
            if d.get("csim") is None and d.get("heard") and who in self.cents:  # scored before the centroid
                self.centred(who, d)
            return d
        wav = read(take)
        if pick.too_long(len(wav) / self.j.SR, text):  # ran on: fails without being heard out
            d = {"take": key, "heard": "", "wer": 1.0, "sim": 0.0, "utmos": 0.0, "wps": 0.0, "speech": None, "score": None}
        else:
            if hasattr(self.j, "listening"):  # the fake ears find what was said by the take's file
                self.j.listening(take)
            heard = self.j.hear(wav)
            spans = self.j.speech(wav)
            talk = spans[-1][1] - spans[0][0] if spans else len(wav) / self.j.SR
            vp = self.j.voiceprint(wav)
            d = {"take": key, "heard": heard, "wer": round(self.j.wer(text, heard), 3), "sim": round(float(vp @ self.prints[who]), 3), "csim": round(float(vp @ self.cents[who]), 3) if who in self.cents else None, "utmos": self.j.naturalness(wav), "avd": self.j.feeling(wav), "wps": round(len(pick.normal(text).split()) / max(talk, 0.1), 2), "speech": [spans[0][0], spans[-1][1]] if spans else None}
            d["score"] = pick.take_score(d["wer"], likeness(d), d["utmos"], d["wps"])
        self.known[key] = d
        self.keep(d)
        return d

    def keep(self, d):
        TAKES.mkdir(parents=True, exist_ok=True)
        with open(self.file, "a", encoding="utf-8") as f:
            f.write(json.dumps(d) + "\n")


def best(scores):
    """(the best take's score, whether it passed): the highest scoring that passed, else the one with the fewest wrong words."""
    passed = [d for d in scores if d["score"] is not None]
    if passed:
        return max(passed, key=lambda d: d["score"]), True
    return (min(scores, key=lambda d: (d["wer"], -d["sim"])) if scores else None), False


def voice_of(line, k):
    """The reference a line's k-th take is cloned from (Feels.direct): its voices in turn."""
    mine = line.get("voices") or [line["who"]]
    return mine[k % len(mine)]


def hear(judge, line, take):
    return judge(line["who"], speakable(line["text"]), take, line.get("feel"), line.get("spread", SPREAD))


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
        items = [{"who": voice_of(l, k), "text": speakable(l["text"]), "out": str(take_path(engine, l, k)), "seed": seed(l, k), **({"style": l["style"]} if l.get("style") else {})} for l in pending.values() for k in ks]
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
                arrive(path, hear(judge, l, path))
        need = [it for it in items if not Path(it["out"]).exists()]
        if need:
            TAKES.mkdir(parents=True, exist_ok=True)
            jobs = TAKES / f"jobs-{engine}.json"
            jobs.write_text(json.dumps({"voices": voices, "items": need}), encoding="utf-8")
            worker = engines.start(engine, jobs, TAKES / f"{engine}.log")
            for out in worker.stdout:
                status, path, why = (out.rstrip("\n").split("\t") + ["", ""])[:3]
                if status == "ok" and path in owner:
                    arrive(path, hear(judge, owner[path], path))
                elif status == "fail" and path in owner:
                    print(f"  ({engine} couldn't make {Path(path).name}: {why})")
                    arrive(path, None)
            if worker.wait():
                print(f"  ({engine} stopped early, exit {worker.returncode}: see {TAKES / f'{engine}.log'})")
        for lid, l in list(pending.items()):  # whatever the worker never made counts as failed
            for path in mine[lid]:
                if str(path) not in got[lid]:
                    arrive(str(path), None)
        if not pending:
            return


def make_all(lines, engines_of, voices, judge, takes, done):
    """Every line through each of its voice's engines (make), then done(line, score, passed) once,
    with the best take of them all, as soon as the line's last engine has decided it."""
    waiting = {l["id"]: set(engines_of[l["who"]]) for l in lines}
    got = {l["id"]: [] for l in lines}
    for engine in sorted({e for es in engines_of.values() for e in es}):

        def one(l, d, ok, engine=engine):
            got[l["id"]] += [d] if d else []
            waiting[l["id"]].discard(engine)
            if not waiting[l["id"]]:
                done(l, *best(got[l["id"]]))

        make(engine, [l for l in lines if engine in engines_of[l["who"]]], voices, judge, takes, one)


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
    ap.add_argument("--ids", help="just these lines, by id, comma-separated (a line's mp3 is public/audio/voiced/<who>/<id>.mp3)")
    ap.add_argument("--takes", type=int, default=8, help="takes of each line to choose from (a line none pass gets twice as many more)")
    ap.add_argument("--engine", choices=engines.ENGINES, help="use this engine for every voice (default: refs.json's per voice)")
    ap.add_argument("--force", action="store_true", help="make lines again even if they're already there")
    ap.add_argument("--remake-before", metavar="WHEN", help="make again the lines made before WHEN (2026-10-07T09:00): like --force, but a rerun after a stop goes on from where it was")
    ap.add_argument("--again", action="store_true", help="choose every line again from its takes, making any missing (after giving a voice another engine)")
    ap.add_argument("--check", action="store_true", help="show each voice's reference and engine, and stop")
    ap.add_argument("--bakeoff", type=int, metavar="N", help="try every engine set up here on N lines a voice, score them, and stop")
    ap.add_argument("--engines", help="the bake-off's engines, comma-separated (default: every one set up here)")
    args = ap.parse_args()

    # (VOICES_LINES: a list exported elsewhere, export-lines.mjs --out, for a run that mustn't touch this one)
    lines_file = Path(os.environ.get("VOICES_LINES", HERE / "lines.json"))
    if not lines_file.exists():
        sys.exit("No scripts/voices/lines.json yet: run  npm run voices:lines  first")
    lines = json.loads(lines_file.read_text(encoding="utf-8"))
    cfg = json.loads((HERE / "refs.json").read_text(encoding="utf-8"))
    only = set(args.only.split(",")) if args.only else None
    voices = references(cfg, only, {l["who"] for l in lines})
    if not voices:
        return
    engines_of = {who: engines_for(who, cfg, args.engine) for who in voices}
    for who, v in voices.items():
        print(f"{who}: {' + '.join(engines_of[who])}, reference {Path(v['wav']).name} saying “{v['text']}”")
    if args.check:
        print(f"\nEngines set up here: {', '.join(engines.available())}. A wrong transcript makes worse lines: fix it in refs/<who>.txt (it's used as written).")
        return

    judge = Judge(voices)
    feels = Feels(voices, judge)
    lines = [feels.direct(l) if l["who"] in voices else l for l in lines]
    directed = sum(1 for l in lines if l.get("feel"))
    print(f"{directed} of {len(lines)} lines directed (delivery.json), cloned from the real lines of theirs that feel most like it")
    if args.bakeoff:
        return bakeoff(lines, feels.voices, judge, args.bakeoff, args.takes, args.engines.split(",") if args.engines else None)

    def mp3(l):
        return OUT / l["who"] / f"{l['id']}.mp3"

    def write_manifest():
        made = {l["id"]: f"{l['who']}/{l['id']}.mp3" for l in lines if mp3(l).exists()}
        OUT.mkdir(parents=True, exist_ok=True)
        tmp = OUT / "manifest.json.tmp"
        tmp.write_text(json.dumps({"version": 1, "lines": made}, indent=0), encoding="utf-8")
        os.replace(tmp, OUT / "manifest.json")

    before = datetime.fromisoformat(args.remake_before).timestamp() if args.remake_before else None

    def stale(l):
        return before is not None and mp3(l).exists() and mp3(l).stat().st_mtime < before

    todo = [l for l in lines if l["who"] in voices and (args.force or args.again or stale(l) or not mp3(l).exists())]
    if args.ids:
        todo = [l for l in todo if l["id"] in set(args.ids.split(","))]
    if args.limit:
        todo = todo[: args.limit]
    # a line that was made (it's in the manifest) but whose mp3 is gone was deleted to be made again,
    # so it gets new takes, not its old best one back; --force makes every line again
    salts_file = TAKES / "salts.json"
    salts = json.loads(salts_file.read_text(encoding="utf-8")) if salts_file.exists() else {}
    listed = json.loads((OUT / "manifest.json").read_text(encoding="utf-8")).get("lines", {}) if (OUT / "manifest.json").exists() else {}
    for l in todo:
        if args.force or stale(l) or (l["id"] in listed and not mp3(l).exists()):
            for e in engines_of[l["who"]]:
                redo(l, e, judge, salts)
        l["salt"] = salts.get(l["id"], 0)
    TAKES.mkdir(parents=True, exist_ok=True)
    salts_file.write_text(json.dumps(salts), encoding="utf-8")
    print(f"\nMaking {len(todo)} lines into public/audio/voiced/, {args.takes} takes each")
    started, made, doubtful = time.time(), [], []

    def done(l, d, ok):
        if d:
            publish(TAKES / d["take"], d["speech"], mp3(l))
        made.append(l)
        if not ok:
            doubtful.append((l, d))
        left = (time.time() - started) / len(made) * (len(todo) - len(made))
        said = f"sim {d['sim']:.2f} wer {d['wer']:.2f} mos {d['utmos']:.1f}" + (f" feel {d['feel']:.1f} off" if d.get("feel") is not None else "") if d else "no take"
        print(f"[{len(made)}/{len(todo)}, ~{left / 60:.0f} min left] {l['who']}: {l['text']}  ({said}{'' if ok else ', DOUBTFUL'})")
        if len(made) % 20 == 0:
            write_manifest()

    make_all(todo, engines_of, feels.voices, judge, args.takes, done)
    write_manifest()
    report = ["# Lines whose best take didn't pass", "", "Listen, then delete the mp3 and run again (it makes new takes), or fix the line.", "", "| who | line | heard | wer | sim |", "|---|---|---|---|---|"]
    report += [f"| {l['who']} | {l['text']} | {d['heard'] if d else '-'} | {d['wer'] if d else '-'} | {d['sim'] if d else '-'} |" for l, d in doubtful]
    TAKES.mkdir(parents=True, exist_ok=True)
    (TAKES / "report.md").write_text("\n".join(report) + "\n", encoding="utf-8")
    print(f"\nDone: {len(made)} lines, {len(doubtful)} doubtful (cache/takes/report.md). npm run dev and fly: the crews speak these where they have no clip.")


def bakeoff(lines, voices, judge, n, takes, which=None):
    """The same few lines a voice through every engine set up here (or `which` of them): which sounds most
    like them, says the words, sounds natural and says it the way it's directed."""
    sample = []
    for who in sorted({l["who"] for l in lines} & set(voices)):
        mine = [l for l in lines if l["who"] == who]
        sample += [mine[i * len(mine) // n] for i in range(min(n, len(mine)))]
    results = {}
    for engine in [e for e in engines.available() if not which or e in which]:
        print(f"\n{engine}")
        got = results.setdefault(engine, {})
        make(engine, sample, voices, judge, takes, lambda l, d, ok: got.setdefault(l["who"], []).append((d, ok)))
    table = {}
    print("\n| voice | engine | passed | sim | wer | UTMOS | quality |\n|---|---|---|---|---|---|---|")
    for who in sorted({l["who"] for l in sample}):
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
