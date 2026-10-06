"""The TTS engines generate.py can make lines with. Each is a worker script
here (worker.py says what they share) run with the Python of its own venv, so
one engine's pinned packages never break another's; README.md here says how
to set each up."""

import os
import subprocess
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
# engine: the venv under ~/.venvs it runs in
VENVS = {"voxcpm2": "voxcpm", "qwen": "qwen", "f5": "voices"}
# the order to fall back in when a voice's engine isn't set up here: the bake-off's order on this
# project (generate.py --bakeoff), Qwen3 best on every voice by the judge's score
PREFERENCE = ["qwen", "voxcpm2", "f5"]


def python(name):
    """The Python to run an engine with ($VOICES_PY_<ENGINE>, or its venv under ~/.venvs), or None if it isn't set up."""
    given = os.environ.get(f"VOICES_PY_{name.upper()}")
    if given:
        return given if Path(given).exists() else None
    base = Path.home() / ".venvs" / VENVS[name]
    return next((str(p) for p in (base / "Scripts" / "python.exe", base / "bin" / "python") if p.exists()), None)


def available():
    return [e for e in PREFERENCE if python(e)]


def start(name, jobs, log):
    """The worker for `name` making the takes in the JOBS file `jobs`, its chatter going to `log`; read its stdout for "ok <file>" or "fail <file> <why>" (tab-separated)."""
    env = {**os.environ, "PYTHONIOENCODING": "utf-8", "PYTHONWARNINGS": "ignore", "HF_HUB_DISABLE_SYMLINKS_WARNING": "1"}
    return subprocess.Popen([python(name), str(HERE / f"{name}.py"), str(jobs)], stdout=subprocess.PIPE, stderr=open(log, "a", encoding="utf-8"), text=True, encoding="utf-8", errors="replace", env=env, cwd=str(HERE))


if __name__ == "__main__":
    for e in PREFERENCE:
        print(f"{e}: {python(e) or 'not set up'}", file=sys.stdout)
