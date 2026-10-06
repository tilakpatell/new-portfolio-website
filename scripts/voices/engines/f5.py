"""F5-TTS v1 (SWivid/F5-TTS, 24 kHz): the first engine the site's voices were made with."""

import tempfile
from pathlib import Path

from worker import seed_all, serve


def load(jobs):
    import soundfile as sf
    from f5_tts.api import F5TTS

    f5 = F5TTS()
    tmp = Path(tempfile.mkdtemp()) / "take.wav"

    def say(voice, text, seed):
        seed_all(seed)
        f5.infer(ref_file=voice["wav"], ref_text=voice["text"], gen_text=text, file_wave=str(tmp), remove_silence=True, seed=seed, nfe_step=32, speed=float(voice.get("speed", 1.0)), show_info=lambda *a, **k: None, progress=None)
        wav, sr = sf.read(str(tmp), dtype="float32")
        return wav, sr

    return say


if __name__ == "__main__":
    serve(load)
