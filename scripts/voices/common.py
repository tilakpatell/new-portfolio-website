"""What the voice scripts share: where things go, ffmpeg, and reading and writing audio."""

import os
import re
import shutil
import subprocess
import sys
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parents[2]
HERE = ROOT / "scripts" / "voices"
OUT = ROOT / "public" / "audio" / "voiced"
CACHE = HERE / "cache"
REFS = HERE / "refs"
AUDIO = {".wav", ".mp3", ".m4a", ".flac", ".ogg", ".opus", ".webm", ".aac"}
# who has a voice to make (scripts/voices/export-lines.mjs keeps the same list)
VOICED = ["rick", "morty", "luke", "han", "walt", "jesse", "hank"]
# and the worlds' speakers with voices of their own (export-lines.mjs's WORLD_VOICED)
WORLD_VOICED = ["gandalf", "aragorn", "sam", "frodo", "galadriel", "boromir", "pippin", "gimli", "saruman", "gollum", "elrond", "merry", "butterbur", "theoden", "legolas", "arwen", "bilbo", "hama", "haldir", "denethor", "grima", "celeborn", "michael", "jim", "erin"]

_ffmpeg = None


def ffmpeg(given=None):
    """ffmpeg's path: --ffmpeg, $FFMPEG, the PATH, or where winget puts it."""
    global _ffmpeg
    if _ffmpeg and not given:
        return _ffmpeg
    winget = Path(os.environ.get("LOCALAPPDATA", "")) / "Microsoft" / "WinGet" / "Links" / "ffmpeg.exe"
    path = given or os.environ.get("FFMPEG") or shutil.which("ffmpeg") or (str(winget) if winget.exists() else None)
    if not path:
        sys.exit("ffmpeg isn't on the PATH: install it (winget install Gyan.FFmpeg), or pass --ffmpeg C:/path/to/ffmpeg.exe")
    # pydub (F5-TTS's silence trimming) and yt-dlp look for it on the PATH too
    os.environ["PATH"] = str(Path(path).resolve().parent) + os.pathsep + os.environ.get("PATH", "")
    _ffmpeg = path
    return path


def console():
    """The lines' curly quotes, on a Windows console."""
    for s in (sys.stdout, sys.stderr):
        if hasattr(s, "reconfigure"):
            s.reconfigure(encoding="utf-8", errors="replace")


def run(cmd):
    r = subprocess.run([str(c) for c in cmd], stdout=subprocess.DEVNULL, stderr=subprocess.PIPE, text=True, errors="replace")
    if r.returncode:
        raise RuntimeError(f"{Path(str(cmd[0])).name} failed:\n{r.stderr[-1500:]}")


def duration(f):
    """Seconds long, from what ffmpeg says about the file (ffprobe may not be there)."""
    r = subprocess.run([ffmpeg(), "-hide_banner", "-i", str(f)], stdout=subprocess.DEVNULL, stderr=subprocess.PIPE, text=True, errors="replace")
    m = re.search(r"Duration: (\d+):(\d+):([\d.]+)", r.stderr)
    return int(m[1]) * 3600 + int(m[2]) * 60 + float(m[3]) if m else 0.0


def read(f, sr=16000):
    """Any audio file as mono float32 samples at `sr`."""
    r = subprocess.run([ffmpeg(), "-v", "error", "-i", str(f), "-f", "f32le", "-ac", "1", "-ar", str(sr), "-"], capture_output=True)
    if r.returncode:
        raise RuntimeError(f"ffmpeg couldn't read {f}:\n{r.stderr.decode(errors='replace')[-800:]}")
    return np.frombuffer(r.stdout, dtype=np.float32).copy()


def write(f, wav, sr):
    import soundfile as sf

    Path(f).parent.mkdir(parents=True, exist_ok=True)
    sf.write(str(f), np.clip(wav, -1, 1), sr, subtype="PCM_16")


def resample(wav, sr_from, sr_to):
    if sr_from == sr_to:
        return wav
    import torch
    import torchaudio.functional as AF

    return AF.resample(torch.from_numpy(np.ascontiguousarray(wav)), sr_from, sr_to).numpy()


def speakable(text):
    """A line as a model should read it: no bracketed asides, plain punctuation."""
    t = re.sub(r"\[[^\]]*\]", "", text)
    for a, b in (("…", "..."), ("—", ", "), ("–", ", "), ("’", "'"), ("‘", "'"), ("“", '"'), ("”", '"')):
        t = t.replace(a, b)
    return re.sub(r"\s+", " ", t).strip(" ,")
