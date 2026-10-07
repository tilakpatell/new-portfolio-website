"""The TTS engines generate.py can make lines with. Each is a worker script
here (worker.py says what they share) run with the Python of its own venv, so
one engine's pinned packages never break another's; an engine that only runs
on Linux runs under WSL. README.md here says how to set each up."""

import os
import shlex
import subprocess
import sys
from functools import lru_cache
from pathlib import Path

from .worker import wsl_path

HERE = Path(__file__).resolve().parent
# engine: the venv under ~/.venvs it runs in
VENVS = {"voxcpm2": "voxcpm", "qwen": "qwen", "f5": "voices", "qwenft": "qwen"}
# engine: (WSL distro, its checkout there, with its venv in .venv), for the ones only Linux runs;
# $VOICES_WSL_<ENGINE> as "distro:path" puts it elsewhere
WSL = {"fish": ("Ubuntu-24.04", "~/fish-speech"), "auk": ("Ubuntu-24.04", "~/auk"), "dots": ("Ubuntu-24.04", "~/dots-tts"), "longcat": ("Ubuntu-24.04", "~/longcat")}
# the order to fall back in when a voice's engine isn't set up here: the bake-off's order on this
# project (generate.py --bakeoff), Qwen3 best on every voice by the judge's score
PREFERENCE = ["qwen", "auk", "longcat", "dots", "fish", "voxcpm2", "f5"]
# and the ones a voice only has once it's been made for them (qwenft: finetune.py), never fallen back on
ENGINES = list(VENVS) + list(WSL)


def wsl(name):
    given = os.environ.get(f"VOICES_WSL_{name.upper()}")
    return tuple(given.split(":", 1)) if given else WSL[name]


@lru_cache(None)
def python(name):
    """How to run an engine: its Python ($VOICES_PY_<ENGINE>, or its venv under ~/.venvs), "wsl"
    for one under WSL, or None if it isn't set up here."""
    if name in WSL:
        distro, where = wsl(name)
        try:
            r = subprocess.run(["wsl.exe", "-d", distro, "-e", "bash", "-lc", f"test -x {where}/.venv/bin/python"], capture_output=True, timeout=60)
        except (OSError, subprocess.TimeoutExpired):
            return None
        return "wsl" if r.returncode == 0 else None
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
    if name in WSL:
        distro, where = wsl(name)
        script, jobs_there = shlex.quote(wsl_path(str(HERE / f"{name}.py"))), shlex.quote(wsl_path(str(jobs)))
        cmd = ["wsl.exe", "-d", distro, "-e", "bash", "-lc", f"cd {where} && PYTHONIOENCODING=utf-8 PYTHONWARNINGS=ignore exec .venv/bin/python {script} {jobs_there}"]
    else:
        cmd = [python(name), str(HERE / f"{name}.py"), str(jobs)]
    return subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=open(log, "a", encoding="utf-8"), text=True, encoding="utf-8", errors="replace", env=env, cwd=str(HERE))


if __name__ == "__main__":
    for e in PREFERENCE:
        print(f"{e}: {python(e) or 'not set up'}", file=sys.stdout)
