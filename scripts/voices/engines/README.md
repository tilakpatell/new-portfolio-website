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

A new engine is a script here that calls `worker.serve(load)`, where
`load(jobs)` loads the model and returns `say(voice, text, seed) -> (samples, rate)`;
then add it to `VENVS` and `PREFERENCE` in `__init__.py`. Name the script
something other than the package it imports (it's first on the path).
