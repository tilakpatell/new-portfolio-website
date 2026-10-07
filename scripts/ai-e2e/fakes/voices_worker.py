"""The fake TTS worker (VOICES_ENGINE=fake): what generate.py runs in place of
Qwen3, Fish or F5 in a contract test. It speaks the worker protocol
(scripts/voices/engines/worker.py: read the jobs, "ok<TAB>file" per take) and
writes each take as a tone as long as the line would take to say, with a
sidecar (<take>.said.json) saying what the fake ears will hear in it.

A line with the word "mumbles" in it comes out wrong, the way a bad take
does: its words scrambled and in someone else's voice, so the judge's rounds
and the doubtful report are tested too. (A marker in brackets would not do:
the site's spoken() and the pipeline's speakable() both drop bracketed asides.)

Only numpy and soundfile, like the real workers' shared part.

    python scripts/ai-e2e/fakes/voices_worker.py JOBS.json
"""

import json
import sys
from pathlib import Path

import numpy as np
import soundfile as sf

RATE = 24000
WORDS_PER_SECOND = 2.5


def take(text, seed):
    words = text.split()
    seconds = max(0.6, len(words) / WORDS_PER_SECOND)
    t = np.arange(int(seconds * RATE)) / RATE
    tone = 0.3 * np.sin(2 * np.pi * (180 + seed % 60) * t)
    bad = "mumbles" in text.lower()
    said = " ".join(reversed(words)) + " uh" if bad else text
    return tone.astype("float32"), {"said": said, "sim": 0.3 if bad else 0.9}


def main(jobs_file):
    jobs = json.loads(Path(jobs_file).read_text(encoding="utf-8"))
    for it in jobs["items"]:
        out = Path(it["out"])
        if out.exists():
            continue
        wav, said = take(it["text"], int(it["seed"]))
        out.parent.mkdir(parents=True, exist_ok=True)
        sf.write(str(out), wav, RATE, subtype="PCM_16")
        Path(f"{out}.said.json").write_text(json.dumps(said), encoding="utf-8")
        print(f"ok\t{it['out']}", flush=True)


if __name__ == "__main__":
    main(sys.argv[1])
