# The engines

generate.py makes each take with a worker script here, run with the Python of
the engine's own venv, so one model's pinned packages never break another's.
`python scripts/voices/engines/__init__.py` lists which are set up. Each venv
needs the CUDA 12.8 build of PyTorch 2.8 (an RTX 50-series card needs 12.8 or
newer; set `VOICES_PY_<ENGINE>` to use a Python somewhere else).

With [uv](https://docs.astral.sh/uv/) (`winget install astral-sh.uv`), where
`IDX` is `--index-url https://pypi.org/simple --extra-index-url https://download.pytorch.org/whl/cu128 --index-strategy unsafe-best-match`:

| engine | venv | install | model |
|---|---|---|---|
| `voxcpm2` | `~/.venvs/voxcpm` | `uv venv ~/.venvs/voxcpm --python 3.12` then `uv pip install --python ~/.venvs/voxcpm/Scripts/python.exe $IDX "torch==2.8.0+cu128" "torchaudio==2.8.0+cu128" voxcpm` | [VoxCPM2](https://github.com/OpenBMB/VoxCPM), 2B, 48 kHz, Apache-2.0 |
| `qwen` | `~/.venvs/qwen` | the same with `qwen-tts` in place of `voxcpm` | [Qwen3-TTS 1.7B Base](https://github.com/QwenLM/Qwen3-TTS), 24 kHz, Apache-2.0 |
| `f5` | `~/.venvs/voices` | the pipeline's own venv (../README.md) | [F5-TTS v1](https://github.com/SWivid/F5-TTS), 24 kHz, CC-BY-NC weights |

Each downloads its model from Hugging Face the first time (a few GB).

**Fish Audio S2 Pro** (`fish`, 44.1 kHz, the Fish Audio Research licence: free
for personal use) only runs on Linux, so it runs under WSL from a
fish-speech checkout in the distro's home (`$VOICES_WSL_FISH="distro:path"`
to put it elsewhere; the default is `Ubuntu-24.04:~/fish-speech`):

```
# in WSL
curl -LsSf https://astral.sh/uv/install.sh | sh
git clone https://github.com/fishaudio/fish-speech ~/fish-speech && cd ~/fish-speech
uv sync --python 3.12 --extra cu128
uv pip install --python .venv/bin/python "huggingface_hub[hf_xet]" soundfile
.venv/bin/hf download fishaudio/s2-pro --local-dir checkpoints/s2-pro
```

Its worker reads the references and writes the takes on the Windows side
through `/mnt/c`.

A voice can have more than one engine (`"engine": ["qwen", "fish"]` in
refs.json): each line then keeps the best take of them all.
`generate.py --again` chooses every line again from its takes, making the
ones a newly added engine is missing.

A new engine is a script here that calls `worker.serve(load)`, where
`load(jobs)` loads the model and returns `say(voice, text, seed) -> (samples, rate)`;
then add it to `VENVS` and `PREFERENCE` in `__init__.py`. Name the script
something other than the package it imports (it's first on the path).
