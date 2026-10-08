#!/usr/bin/env python3
"""Each crew voice's reference recording: found, cleaned and chosen, not hand-cut.

A clone is only as good as the few seconds it learns the voice from. For each
speaker in sources.json this gathers candidates (the site's own clips of
them, and the scenes YouTube finds for the searches listed there), takes the
score and effects out (MelBand RoFormer), cuts the speech into utterances
where the speaker pauses (Whisper's word times) and works out who says each
one: a voiceprint centroid starts from the site's clips and from utterances
saying the speaker's known quotes, and grows with the utterances most like
them. Every candidate is scored on how surely it's the speaker and not
another crew voice, how clean and how natural it sounds, and the best few
seconds from one scene become scripts/voices/refs/<who>.wav, with what
Whisper hears in it in <who>.txt.

    python scripts/voices/grab.py                    every voice
    python scripts/voices/grab.py --only morty,hank  just these
    python scripts/voices/grab.py --pick morty=yt-AbCdEfGhIjK@12.3,yt-AbCdEfGhIjK@15.0

Everything fetched and made is cached under scripts/voices/cache/grab/, so a
rerun is quick. cache/grab/report.md lists what was chosen and the runners-up
with their scores (the source@start names --pick takes), and
cache/grab/listen/<who>/ has them to listen to. A source or a segment that's
wrong goes in the voice's "exclude" in sources.json. A reference you made
yourself (refs/<who>.wav with no refs/<who>.json beside it) is left alone
unless you pass --refresh.
"""

import argparse
from functools import lru_cache
import hashlib
import json
import logging
import shutil
import subprocess
import sys
from pathlib import Path

import numpy as np

import pick
from common import CACHE, HERE, REFS, ROOT, AUDIO, console, ffmpeg, read, run, write

GRAB = CACHE / "grab"
SEPARATOR = "vocals_mel_band_roformer.ckpt"
SR = 16000  # what the judge hears
HI = 44100  # what the reference is made at (the separator's own rate)
PAD = (0.1, 0.15)  # seconds kept before an utterance's first word and after its last
ANALYSIS = 2  # bump when the per-segment numbers change, to work them out again
CHECKED = 40  # candidates a voice checks a stretch at a time, best first


def configs():
    """Every voice's sources: sources.json's, and each world's own in sources/<world>.json."""
    cfgs = json.loads((HERE / "sources.json").read_text(encoding="utf-8"))
    for f in sorted((HERE / "sources").glob("*.json")):
        for who, cfg in json.loads(f.read_text(encoding="utf-8")).items():
            if who in cfgs:
                print(f"{who}: in sources.json and {f.name}; using sources.json's")
                continue
            cfgs[who] = cfg
    return cfgs


def ytdlp(*args):
    return subprocess.run([sys.executable, "-m", "yt_dlp", "--js-runtimes", "node", "--no-warnings", *args], capture_output=True, text=True, encoding="utf-8", errors="replace")


def search(query, n):
    """YouTube's first `n` results for a search: [{id, seconds, title}], cached."""
    f = GRAB / "search" / f"{hashlib.sha1(f'{n}|{query}'.encode()).hexdigest()[:16]}.json"
    if f.exists():
        return json.loads(f.read_text(encoding="utf-8"))
    r = ytdlp("--flat-playlist", "--print", "%(id)s\t%(duration)s\t%(title)s", f"ytsearch{n}:{query}")
    found = []
    for line in r.stdout.splitlines():
        parts = line.split("\t")
        if len(parts) == 3:
            seconds = float(parts[1]) if parts[1].replace(".", "", 1).isdigit() else None
            found.append({"id": parts[0], "seconds": seconds, "title": parts[2]})
    if not found:
        print(f"  (no results for “{query}”{': ' + r.stderr.strip().splitlines()[-1] if r.stderr.strip() else ''})")
        return found
    f.parent.mkdir(parents=True, exist_ok=True)
    f.write_text(json.dumps(found, indent=1), encoding="utf-8")
    return found


def sources(who, cfg, per_query):
    """Where a voice's candidates come from: its site clips, then its URLs and searches' results that are worth fetching."""
    out = [{"id": f"clip-{Path(c).stem}", "file": ROOT / c, "title": Path(c).name, "of": who} for c in cfg.get("clips", [])]
    for c in out:
        if not c["file"].exists():
            print(f"  ({who}: {c['file'].relative_to(ROOT)} isn't there, going without it)")
    out = [c for c in out if c["file"].exists()]
    found = [{"id": pick.video_id(u), "seconds": None, "title": u} for u in cfg.get("urls", []) if pick.video_id(u)]
    for q in cfg.get("search", []):
        found += search(q, cfg.get("per_query", per_query))  # a voice can ask for more of each search's results
    seen = set()
    for v in found:
        if v["id"] in seen or pick.excluded(v["id"], 0, [r for r in cfg.get("exclude", []) if "@" not in r]):
            continue
        seen.add(v["id"])
        if pick.usable(v["title"], v["seconds"], cfg.get("avoid", [])):
            out.append({"id": f"yt-{v['id']}", "url": f"https://www.youtube.com/watch?v={v['id']}", "title": v["title"]})
    return out


# When YouTube wants this machine to sign in ("confirm you're not a bot"), its
# Android client still serves the 360p video with 128k AAC sound: enough here.
CLIENTS = [[], ["--extractor-args", "youtube:player_client=android"]]
client = 0


def fetch(src):
    """A source's audio as FLAC on this machine, or None if it couldn't be had."""
    global client
    if "file" in src:
        return src["file"]
    raw = GRAB / "raw"
    out = raw / f"{src['id']}.flac"
    if out.exists():
        return out
    raw.mkdir(parents=True, exist_ok=True)
    print(f"  fetching {src['id']}  {src['title'][:70]}")
    while True:
        r = ytdlp(*CLIENTS[client], "-f", "bestaudio/best", "--no-playlist", "-o", str(raw / f"{src['id']}.dl.%(ext)s"), src["url"])
        if "not a bot" in r.stderr and client + 1 < len(CLIENTS):
            client += 1
            print("  (YouTube wants a sign-in from here: fetching with its Android client from now on)")
            continue
        break
    got = next((p for p in raw.glob(f"{src['id']}.dl.*") if p.suffix.lower() in AUDIO | {".mp4", ".m4a"}), None)
    if not got:
        print(f"  couldn't fetch {src['id']} ({src['title']}): {(r.stderr.strip().splitlines() or ['?'])[-1]}")
        return None
    run([ffmpeg(), "-y", "-hide_banner", "-i", got, "-vn", "-ar", str(HI), "-ac", "2", out])
    got.unlink()
    return out


class Vocals:
    """The voice alone, without the score or the effects under it; the separator loads the first time it's needed."""

    def __init__(self):
        self.sep = None

    def __call__(self, src, f):
        out = GRAB / "vocals" / f"{src['id']}.flac"
        if out.exists():
            return out
        if not self.sep:
            from audio_separator.separator import Separator

            self.sep = Separator(output_dir=str(out.parent), output_format="FLAC", output_single_stem="Vocals", log_level=logging.ERROR, model_file_dir=str(CACHE / "models" / "separator"))
            self.sep.load_model(model_filename=SEPARATOR)
        made = out.parent / Path(self.sep.separate(str(f), {"Vocals": src["id"]})[0]).name
        if made != out:
            made.replace(out)
        return out


def analyse(src, vocals):
    """A source's utterances, each with what's said, its voiceprint and how clean and natural it sounds (cached)."""
    import judge

    f = GRAB / "segments" / f"{src['id']}.json"
    if f.exists():
        kept = json.loads(f.read_text(encoding="utf-8"))
        if kept.get("v") == ANALYSIS:
            return kept["segments"]
    wav = read(vocals, SR)
    total = len(wav) / SR
    _, words = judge.hear(wav, words=True)
    spans = judge.speech(wav)
    segs = []
    for start, end, said in pick.utterances(words):
        # Whisper's first word of a window often takes in the silence before it: start where the speech does
        start = max([start] + [s for s, e in spans if s < end and e > start][:1])
        a, b = max(0.0, start - PAD[0]), min(total, end + PAD[1])
        piece = wav[int(a * SR) : int(b * SR)]
        if len(piece) < SR:
            continue
        halves = None
        if b - a >= 3:
            m = len(piece) // 2
            halves = round(float(judge.voiceprint(piece[:m]) @ judge.voiceprint(piece[m:])), 3)
        segs.append({"start": round(a, 2), "end": round(b, 2), "text": said, "vp": [round(x, 5) for x in judge.voiceprint(piece).tolist()], "halves": halves, **judge.cleanliness(piece), "utmos": judge.naturalness(piece), "clipped": round(judge.clipped(piece), 5)})
    f.parent.mkdir(parents=True, exist_ok=True)
    f.write_text(json.dumps({"v": ANALYSIS, "segments": segs}), encoding="utf-8")
    return segs


@lru_cache(32)
def heard(path):
    """A source's vocals at the judge's rate, kept for the next candidate from the same scene
    (each voice checks dozens, mostly from a few scenes, and decoding a whole scene is slow)."""
    return read(path, SR)


def stretched(c, vocals):
    """A candidate's audio in overlapping stretches of a second and a half (pick.stretches)."""
    wav = heard(str(vocals[c["source"]]))[int(c["start"] * SR) : int(c["end"] * SR)]
    return [wav[int(a * SR) : int(b * SR)] for a, b in pick.stretches(len(wav) / SR)]


def table(rows, chosen):
    return [
        f"| {i} | `{name(c)}`{' **(chosen)**' if c in chosen else ''} | {c['end'] - c['start']:.1f} | {c['sim']:.2f} | {c['margin']:.2f} | {c['halves'] if c['halves'] is not None else '-'} | {c.get('purity', '-')} | {c['ovrl']:.2f} | {c['bak']:.2f} | {c['utmos']:.2f} | {c['score']:.2f} | {c['text'][:80]} |"
        for i, c in enumerate(rows[:12], 1)
    ]


def name(c):
    return f"{c['source']}@{c['start']:.2f}".rstrip("0").rstrip(".")


def build(who, chosen, vocals):
    """The reference itself: the chosen segments in order, a quarter second apart, at an even loudness."""
    import judge

    pieces, cache = [], {}
    for c in chosen:
        if c["source"] not in cache:
            cache[c["source"]] = read(vocals[c["source"]], HI)
        p = cache[c["source"]][int(c["start"] * HI) : int(c["end"] * HI)].copy()
        fade = int(0.015 * HI)
        p[:fade] *= np.linspace(0, 1, fade, dtype=np.float32)
        p[-fade:] *= np.linspace(1, 0, fade, dtype=np.float32)
        pieces += [p, np.zeros(int(0.25 * HI), dtype=np.float32)]
    ref = np.concatenate(pieces[:-1])
    ref *= 0.1 / max(float(np.sqrt(np.mean(ref**2))), 1e-6)  # -20 dBFS
    ref *= min(1.0, 0.95 / max(float(np.abs(ref).max()), 1e-6))
    write(REFS / f"{who}.wav", ref, HI)
    heard = judge.hear(read(REFS / f"{who}.wav", SR))
    (REFS / f"{who}.txt").write_text(heard + "\n", encoding="utf-8")
    return len(ref) / HI, heard


def main():
    console()
    ffmpeg()
    ap = argparse.ArgumentParser(description="Build each crew voice's reference recording from real scene audio.")
    ap.add_argument("--only", help="just these voices, comma-separated (morty,hank)")
    ap.add_argument("--pick", action="append", default=[], help="who=source@start[,source@start]: use these segments (names from the report)")
    ap.add_argument("--per-query", type=int, default=3, help="search results fetched per search in sources.json")
    ap.add_argument("--refresh", action="store_true", help="replace references you made yourself too")
    ap.add_argument("--fetch-only", action="store_true", help="just search and download the sources (no GPU), to process them later")
    args = ap.parse_args()

    cfgs = configs()
    only = set(args.only.split(",")) if args.only else None
    picks = {w: v.split(",") for w, _, v in (p.partition("=") for p in args.pick)}
    wanted = [w for w in cfgs if (not only or w in only) and not cfgs[w].get("design")]  # design.py makes those
    for w in list(wanted):
        own = REFS / f"{w}.wav"
        if own.exists() and not (REFS / f"{w}.json").exists() and not args.refresh:
            print(f"{w}: keeping your own refs/{w}.wav (--refresh replaces it)")
            wanted.remove(w)
    if not wanted:
        return
    # the other voices of the same shows come too: they're who each voice is told apart from
    shows = {cfgs[w].get("show") for w in wanted}
    voices = [w for w in cfgs if cfgs[w].get("show") in shows and not cfgs[w].get("design")]

    print("Finding sources")
    srcs, every = {}, {}
    for w in voices:
        srcs[w] = sources(w, cfgs[w], args.per_query)
        for s in srcs[w]:
            every.setdefault(s["id"], s)
    print(f"{len(every)} sources for {', '.join(voices)}; fetching, separating and listening (cached after the first time)")
    raw = {s["id"]: f for s in every.values() if (f := fetch(s))}
    if args.fetch_only:
        print(f"Fetched {len(raw)} of {len(every)} sources")
        return
    # the separator first and on its own: it and the judge's models together outgrow the card
    sep, vocals, segments = Vocals(), {}, {}
    for sid, f in raw.items():
        vocals[sid] = sep(every[sid], f)
    if sep.sep:
        import gc

        import torch

        sep.sep = None
        gc.collect()
        torch.cuda.empty_cache()
    for n, sid in enumerate(vocals, 1):
        segments[sid] = analyse(every[sid], vocals[sid])
        print(f"  [{n}/{len(vocals)}] {sid}: {len(segments[sid])} utterances  {every[sid]['title'][:70]}")

    # everything heard in a show's sources is a candidate for each of its voices
    pool, seeds, seeded = {}, {}, {}
    for w in voices:
        show_srcs = {s["id"]: s for v in voices if cfgs[v].get("show") == cfgs[w].get("show") for s in srcs[v] if s["id"] in segments}
        rules = cfgs[w].get("exclude", [])
        pool[w] = [(s, g) for s in show_srcs.values() for g in segments[s["id"]] if not pick.excluded(s["id"], g["start"], rules)]
        seeded[w] = []
        for s, g in pool[w]:
            q = None if s.get("of") else pick.quoted(g["text"], cfgs[w].get("quotes", []))
            if s.get("of") == w or q:
                seeded[w].append((s, g, q))
        seeds[w] = [np.array(g["vp"]) for _, g, _ in seeded[w]]
    # a voice nothing seeds (an ensemble's: their quotes rarely come out word for word) starts from
    # whoever is heard most in their own scenes, so long as it isn't a voice already known
    known = {w: pick.centre(s) for w, s in seeds.items() if len(s)}
    known.update({w: np.asarray(c, dtype=np.float32) for w, c in json.loads((GRAB / "centroids.json").read_text(encoding="utf-8")).items() if w not in known} if (GRAB / "centroids.json").exists() else {})
    for w in voices:
        if seeds[w] or w not in wanted:
            continue
        mine = {s["id"] for s in srcs[w] if not s.get("of")}
        own = [(s, g) for s, g in pool[w] if s["id"] in mine and g.get("vp") and g["end"] - g["start"] >= 1.5]
        found = pick.dominant([(np.array(g["vp"]), g["end"] - g["start"]) for _, g in own], {v: c for v, c in known.items() if v != w})
        seeds[w] = found
        seeded[w] = [(s, g, None) for s, g in own if any(np.allclose(np.array(g["vp"]), f) for f in found)]
        if found:
            known[w] = pick.centre(found)
            print(f"  ({w}: no clip or quote to start from; starting from the voice heard most in their own scenes, {len(found)} utterances)")
    import judge

    cents = pick.refine(seeds, {w: [(np.array(g["vp"]), g["end"] - g["start"]) for _, g in pool[w]] for w in voices})

    # each voice's centroid, to judge a reference by how like the speaker its lines come out
    kept_cents = json.loads((GRAB / "centroids.json").read_text(encoding="utf-8")) if (GRAB / "centroids.json").exists() else {}
    kept_cents.update({w: [round(x, 5) for x in c.tolist()] for w, c in cents.items()})
    (GRAB / "centroids.json").write_text(json.dumps(kept_cents), encoding="utf-8")
    report = ["# The crews' references", "", "Made by `python scripts/voices/grab.py`. Listen to the candidates in `cache/grab/listen/<who>/`; put a wrong source or segment in the voice's `exclude` in sources.json, or choose your own with `--pick who=source@start`.", ""]
    for w in wanted:
        report += [f"## {w}", ""]
        if w not in cents and w in picks:  # segments named by hand need no voiceprint to find them by
            want = [(p.rpartition("@")[0], float(p.rpartition("@")[2])) for p in picks[w]]
            named = [g for s, g in pool[w] if any(s["id"] == sid and abs(g["start"] - t) < 0.05 for sid, t in want)]
            if named:
                cents[w] = pick.centre([np.array(g["vp"]) for g in named])
        if w not in cents:
            msg = f"{w}: nothing to start from: no site clip of them and no utterance says one of their quotes. Add a clip, a quote or a search to sources.json."
            print(msg)
            report += [msg, ""]
            continue
        cands = []
        for s, g in pool[w]:
            sim, margin = pick.identify(np.array(g["vp"]), w, cents)
            score = pick.segment_score(sim, margin, g["ovrl"], g["utmos"], g["halves"])
            cands.append({"source": s["id"], "title": s["title"], "start": g["start"], "end": g["end"], "text": g["text"], "sim": round(sim, 3), "margin": round(margin, 3), "halves": g["halves"], "ovrl": g["ovrl"], "bak": g["bak"], "utmos": g["utmos"], "clipped": g["clipped"], "score": round(score, 3)})
        cands.sort(key=lambda c: -c["score"])
        good = [c for c in cands if c["margin"] > 0.05 and c["clipped"] < 0.002 and 1.5 <= c["end"] - c["start"] <= pick.LONGEST + 0.5]
        # the best of them a stretch at a time: a short line from someone else at one end
        # hardly moves a segment's voiceprint, but the stretch it's in isn't the speaker
        kept = []
        for c in good[:CHECKED]:
            sims = [float(judge.voiceprint(piece) @ cents[w]) for piece in stretched(c, vocals)]
            c["purity"] = round(min(sims), 3)
            if pick.pure(sims, c["sim"]):
                kept.append(c)
        good = kept
        if w in picks:
            want = [(p.rpartition("@")[0], float(p.rpartition("@")[2])) for p in picks[w]]
            chosen = sorted([c for c in cands if any(c["source"] == s and abs(c["start"] - t) < 0.05 for s, t in want)], key=lambda c: c["start"])
            if len(chosen) != len(want):
                sys.exit(f"{w}: --pick names a segment that isn't among the candidates; the report lists them")
        else:
            chosen = pick.choose(good)
        if not chosen:
            msg = f"{w}: no candidate is surely them (margin over the other voices); see the report and add sources"
            print(msg)
            report += [msg, ""]
            continue
        same = [(c["source"], c["start"], c["end"]) for c in chosen]
        before = json.loads((REFS / f"{w}.json").read_text(encoding="utf-8")) if (REFS / f"{w}.json").exists() else {}
        if (REFS / f"{w}.wav").exists() and [(c["source"], c["start"], c["end"]) for c in before.get("chosen", [])] == same:
            # the same segments as last time: keep the reference and its transcript (which may have been corrected)
            seconds, heard = sum(c["end"] - c["start"] for c in chosen) + 0.25 * (len(chosen) - 1), (REFS / f"{w}.txt").read_text(encoding="utf-8").strip()
        else:
            seconds, heard = build(w, chosen, vocals)
            (REFS / f"{w}.json").write_text(json.dumps({"chosen": chosen, "heard": heard}, indent=1), encoding="utf-8")
        print(f"{w}: {seconds:.1f}s from {chosen[0]['source']} ({chosen[0]['title'][:60]}), heard “{heard}”")

        listen = GRAB / "listen" / w
        shutil.rmtree(listen, ignore_errors=True)
        listen.mkdir(parents=True)
        for i, c in enumerate(good[:12], 1):
            wav = read(vocals[c["source"]], HI)
            write(listen / f"{i:02d} {name(c)} {c['score']:.2f}.wav", wav[int(c["start"] * HI) : int(c["end"] * HI)], HI)
        starts = sorted({f"{q} ({s['id']})" if q else s["id"] for s, _, q in seeded[w]})
        head = ["| # | segment | s | sim | margin | halves | purity | DNSMOS | bak | UTMOS | score | said |", "|---|---|---|---|---|---|---|---|---|---|---|---|"]
        report += [
            f"**Reference** `refs/{w}.wav`, {seconds:.1f}s from “{chosen[0]['title']}” ({', '.join(name(c) for c in chosen)}), heard: “{heard}”",
            "",
            f"Started from {len(seeds[w])} utterances: {'; '.join(starts)}",
            "",
            "The speaker all the way through, best first (what the reference is chosen from, and what's in `listen/`):",
            "",
            *head,
            *table(good, chosen),
            "",
            "Every candidate, best first:",
            "",
            *head,
            *table(cands, chosen),
            "",
        ]
    (GRAB / "report.md").write_text("\n".join(report), encoding="utf-8")
    print(f"\nReport: {GRAB / 'report.md'}")


if __name__ == "__main__":
    main()
