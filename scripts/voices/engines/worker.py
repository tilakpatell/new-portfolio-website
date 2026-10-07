"""What every engine's worker does, whatever model it runs: read the jobs
generate.py wrote, make each take that isn't made yet, and say so line by
line ("ok <file>" or "fail <file> <why>", tab-separated) for generate.py to follow.

    python engines/<engine>.py JOBS.json

JOBS.json: {"voices": {who: {"wav": reference, "text": its transcript}},
            "items": [{"who", "text", "out", "seed"}, ...]}

Only the standard library, numpy and soundfile here: each engine runs in a
venv of its own (engines/README.md), with whatever else its model pins.
"""

import json
import os
import sys
import traceback
from pathlib import Path

import numpy as np
import soundfile as sf


def wsl_path(p):
    """A Windows path as WSL sees it (C:\\x\\y -> /mnt/c/x/y); anything else as it is."""
    if len(p) > 2 and p[1] == ":" and p[2] in "\\/":
        return f"/mnt/{p[0].lower()}/" + p[3:].replace("\\", "/")
    return p


def serve(load, jobs_file=None, local=lambda p: p):
    """`load(jobs)` loads the model and returns say(voice, text, seed) -> (samples, rate).
    A model that's quicker in batches gives say.many(voice, texts, seeds) -> [(samples, rate), ...]
    too, and say.batch, the most it takes at once: it then gets the takes a voice at a time, in order;
    with say.mixed set too, many() gets a list of voices, one a take, and takes in any voices together.
    One that can be told how to say a line sets say.styled, and gets say(voice, text, seed, style=...)
    with the line's direction ("urgent: barked at Chewie"), or None.
    `local` turns the jobs' paths into this worker's own (wsl_path, for one running under WSL);
    what it reports back are the jobs' paths as given."""
    for s in (sys.stdout, sys.stderr):
        if hasattr(s, "reconfigure"):
            s.reconfigure(encoding="utf-8", errors="replace")
    jobs = json.loads(Path(jobs_file or sys.argv[1]).read_text(encoding="utf-8"))
    jobs["voices"] = {w: {**v, "wav": local(v["wav"])} for w, v in jobs["voices"].items()}
    todo = [it for it in jobs["items"] if not Path(local(it["out"])).exists()]
    if not todo:
        return
    say = load(jobs)
    size = getattr(say, "batch", 1) if hasattr(say, "many") else 1
    # a model that can say a batch in several voices at once (say.mixed) gets any takes together;
    # otherwise a batch is one voice's
    mixed = getattr(say, "mixed", False)
    groups = []
    for it in todo:
        if groups and len(groups[-1]) < size and (mixed or groups[-1][0]["who"] == it["who"]):
            groups[-1].append(it)
        else:
            groups.append([it])
    for group in groups:
        voice, texts, seeds = jobs["voices"][group[0]["who"]], [it["text"] for it in group], [int(it["seed"]) for it in group]
        try:
            if size > 1 and mixed:
                made = say.many([jobs["voices"][it["who"]] for it in group], texts, seeds)
            elif size > 1:
                made = say.many(voice, texts, seeds)
            elif getattr(say, "styled", False):  # a model told how to say it: the line's direction
                made = [say(voice, texts[0], seeds[0], style=group[0].get("style"))]
            else:
                made = [say(voice, texts[0], seeds[0])]
        except Exception as e:  # one bad line (or batch) shouldn't stop the rest
            traceback.print_exc(file=sys.stderr)
            for it in group:
                print(f"fail\t{it['out']}\t{type(e).__name__}: {e}".replace("\n", " "), flush=True)
            continue
        for it, (wav, sr) in zip(group, made):
            keep(it["out"], Path(local(it["out"])), wav, sr)


def keep(name, out, wav, sr):
    wav = np.asarray(wav, dtype=np.float32).squeeze()
    if not wav.size:
        print(f"fail\t{name}\tRuntimeError: no audio", flush=True)
        return
    out.parent.mkdir(parents=True, exist_ok=True)
    tmp = out.with_name(out.stem + ".part.wav")
    sf.write(str(tmp), np.clip(wav, -1, 1), int(sr), subtype="PCM_16")
    os.replace(tmp, out)
    print(f"ok\t{name}", flush=True)


def seed_all(seed):
    import random

    import torch

    random.seed(seed)
    np.random.seed(seed % 2**32)
    torch.manual_seed(seed)
