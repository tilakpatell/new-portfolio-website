"""The contract tests' ears (VOICES_JUDGE=fake) and worker (VOICES_ENGINE=fake),
which stand in for Whisper, WavLM, UTMOS and the TTS engines, and the seams
generate.py picks them through:
python -m unittest discover -s scripts/voices -p "test_judge_fake.py"
"""

import json
import os
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

import common
import generate

FAKES = Path(__file__).resolve().parents[1] / "ai-e2e" / "fakes"


class FakeEars(unittest.TestCase):
    def setUp(self):
        self.dir = Path(tempfile.mkdtemp())
        self.old = os.environ.get("VOICES_JUDGE")
        os.environ["VOICES_JUDGE"] = "fake"

    def tearDown(self):
        if self.old is None:
            os.environ.pop("VOICES_JUDGE", None)
        else:
            os.environ["VOICES_JUDGE"] = self.old

    def say(self, text):
        jobs = self.dir / "jobs.json"
        out = self.dir / "han" / f"{abs(hash(text))}.0.wav"
        jobs.write_text(json.dumps({"voices": {}, "items": [{"who": "han", "text": text, "out": str(out), "seed": 1}]}), encoding="utf-8")
        r = subprocess.run([sys.executable, str(FAKES / "voices_worker.py"), str(jobs)], capture_output=True, text=True)
        self.assertEqual(r.stdout.strip(), f"ok\t{out}")
        return out

    def test_the_ears_are_the_fake_when_asked_and_need_no_torch(self):
        ears = common.ears()
        self.assertEqual(Path(ears.__file__).name, "voices_judge.py")
        self.assertNotIn("torch", sys.modules)

    def test_a_good_take_is_heard_as_its_line_in_the_speakers_voice(self):
        ears = common.ears()
        ears.listening(None)
        ref = ears.voiceprint(None)
        take = self.say("Never tell me the odds.")
        ears.listening(take)
        self.assertEqual(ears.hear(None), "Never tell me the odds.")
        self.assertAlmostEqual(float(ears.voiceprint(None) @ ref), 0.9, places=6)
        self.assertEqual(ears.naturalness(None), 4.0)
        self.assertEqual(ears.wer("Never tell me the odds.", ears.hear(None)), 0.0)

    def test_a_take_of_a_line_that_mumbles_is_wrong_in_words_and_voice(self):
        ears = common.ears()
        ears.listening(None)
        ref = ears.voiceprint(None)
        ears.listening(self.say("Han mumbles about the Kessel Run."))
        self.assertGreater(ears.wer("Han mumbles about the Kessel Run.", ears.hear(None)), 0.34)
        self.assertAlmostEqual(float(ears.voiceprint(None) @ ref), 0.3, places=6)

    def test_the_take_lasts_as_long_as_its_words_take_to_say(self):
        import soundfile as sf

        wav, rate = sf.read(str(self.say("one two three four five")))
        self.assertAlmostEqual(len(wav) / rate, 2.0, places=2)


class FakeEngine(unittest.TestCase):
    def test_every_voice_is_made_by_the_fake_when_asked(self):
        old = os.environ.get("VOICES_ENGINE")
        os.environ["VOICES_ENGINE"] = "fake"
        try:
            self.assertEqual(generate.engines_for("han", {"han": {"engine": "qwen"}}, None), ["fake"])
        finally:
            if old is None:
                os.environ.pop("VOICES_ENGINE", None)
            else:
                os.environ["VOICES_ENGINE"] = old


if __name__ == "__main__":
    unittest.main()
