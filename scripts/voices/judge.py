"""Ears for the voice scripts, since nobody can listen to a thousand takes:
what Whisper hears in a clip, who it sounds like (a WavLM voiceprint), and
how clean and natural it sounds (DNSMOS and UTMOS).

grab.py uses them to pick each voice's reference out of a pile of clips, and
generate.py to keep the best of several takes of a line. Every model loads
the first time it's asked for, on the GPU when there is one.
All audio in and out of here is 16 kHz mono float32.
"""

import re
from functools import lru_cache
from pathlib import Path

import numpy as np
import torch

from common import CACHE

SR = 16000
DEVICE = "cuda" if torch.cuda.is_available() else "cpu"
HALF = torch.float16 if DEVICE == "cuda" else torch.float32


@lru_cache(None)
def _whisper():
    from transformers import pipeline

    return pipeline("automatic-speech-recognition", model="openai/whisper-large-v3", dtype=HALF, device=DEVICE)


def hear(wav, words=False):
    """What's said: the text, or (text, [(word, start, end), ...]) with each word's time in seconds."""
    from pick import uncensor, windows

    asr = _whisper()
    if len(wav) < SR * 0.3:
        return ("", []) if words else ""
    kw = {"generate_kwargs": {"language": "en", "task": "transcribe"}}
    if not words:
        if len(wav) > SR * 30:
            kw["chunk_length_s"], kw["batch_size"] = 30, 8
        return uncensor(asr({"raw": wav, "sampling_rate": SR}, **kw)["text"].strip())
    # Word times a window of at most 28 seconds at a time, cut where nobody's
    # talking: the pipeline's own chunking held 40 GB for a two-minute scene.
    texts, ws = [], []
    for a, b in windows(speech(wav), len(wav) / SR):
        out = asr({"raw": wav[int(a * SR) : int(b * SR)], "sampling_rate": SR}, return_timestamps="word", **kw)
        texts.append(uncensor(out["text"].strip()))
        for c in out.get("chunks", []):
            s, e = c["timestamp"]
            if c["text"].strip() and s is not None:
                ws.append((uncensor(c["text"].strip()), a + s, a + (e if e is not None else s)))
    return " ".join(t for t in texts if t), ws


def plain(text):
    """Text as Whisper's own English normaliser has it, for comparing what was said with what was meant."""
    tok = _whisper().tokenizer
    t = re.sub(r"\[[^\]]*\]", " ", text)
    return tok.normalize(t) if hasattr(tok, "normalize") else re.sub(r"[^a-z0-9' ]+", " ", t.lower()).strip()


def wer(meant, heard_text):
    """Word error rate of what was heard against what was meant (0 is word-perfect)."""
    import jiwer

    a, b = plain(meant), plain(heard_text)
    if not a:
        return 0.0 if not b else 1.0
    return min(1.0, jiwer.wer(a, b or "<nothing>"))


# The speaker model TTS papers measure similarity (SIM) with: WavLM-large
# under an ECAPA head, from Seed-TTS-eval. On the site's own clips it told
# the speakers apart far better than speechbrain's ECAPA (AUC 0.84 to 0.72).
SV = ("bezzam/wavlm_large_finetune_seed_tts_eval", "wavlm_large_finetune.pth", "51f07e3b94d9e0262a6a675ef5a087be3dd09e8c62e9d886827f44f82fe7f94b")


@lru_cache(None)
def _sv():
    import hashlib

    from f5_tts.eval.ecapa_tdnn import ECAPA_TDNN_SMALL
    from huggingface_hub import hf_hub_download

    repo, name, sha = SV
    path = Path(hf_hub_download(repo, name))
    seen = CACHE / "models" / "sv.checked"
    stamp = f"{path.stat().st_size} {path.stat().st_mtime_ns}"
    if not seen.exists() or seen.read_text() != stamp:
        if hashlib.sha256(path.read_bytes()).hexdigest() != sha:
            raise RuntimeError(f"{path} isn't the checkpoint it should be (sha256 differs): delete it and run again")
        seen.parent.mkdir(parents=True, exist_ok=True)
        seen.write_text(stamp)
    model = ECAPA_TDNN_SMALL(feat_dim=1024, feat_type="wavlm_large", config_path=None)
    model.load_state_dict(torch.load(path, weights_only=True, map_location="cpu")["model"], strict=False)
    return model.to(DEVICE).eval()


def voiceprint(wav):
    """Who's speaking, as a unit vector: the dot product of two is how alike the voices are (1 the same, about 0 strangers)."""
    with torch.inference_mode():
        e = _sv()(torch.from_numpy(np.ascontiguousarray(wav)).float().unsqueeze(0).to(DEVICE)).squeeze().float()
    return (e / e.norm()).cpu().numpy()


def cleanliness(wav):
    """DNSMOS (P.835), each 1 to 5: sig how clean the voice itself is, bak how quiet everything behind it is, ovrl the two together."""
    from torchmetrics.functional.audio.dnsmos import deep_noise_suppression_mean_opinion_score as dnsmos

    _p808, sig, bak, ovrl = dnsmos(torch.from_numpy(np.ascontiguousarray(wav)), SR, False).tolist()
    return {"sig": round(sig, 2), "bak": round(bak, 2), "ovrl": round(ovrl, 2)}


@lru_cache(None)
def _utmos():
    return torch.hub.load("tarepan/SpeechMOS:v1.2.0", "utmos22_strong", trust_repo=True).to(DEVICE).eval()


def naturalness(wav):
    """UTMOS, 1 to 5: how natural the speech sounds (TTS papers' usual measure)."""
    with torch.inference_mode():
        return round(float(_utmos()(torch.from_numpy(np.ascontiguousarray(wav)).float().unsqueeze(0).to(DEVICE), SR)), 2)


@lru_cache(None)
def _vad():
    from silero_vad import load_silero_vad

    return load_silero_vad()


def speech(wav, gap=0.3):
    """Where there's speech: [(start, end), ...] in seconds (Silero VAD)."""
    from silero_vad import get_speech_timestamps

    ts = get_speech_timestamps(torch.from_numpy(np.ascontiguousarray(wav)), _vad(), sampling_rate=SR, return_seconds=True, min_silence_duration_ms=int(gap * 1000), speech_pad_ms=80)
    return [(float(t["start"]), float(t["end"])) for t in ts]


def clipped(wav):
    """The share of samples at full scale: a clipped recording clones as distortion."""
    return float(np.mean(np.abs(wav) > 0.985))
