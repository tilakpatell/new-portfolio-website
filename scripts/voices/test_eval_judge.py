"""The hearing judge's evaluation (eval_judge.py), run against the fake ears
over takes the fake worker makes: the numbers it reports and the lines it
holds the judge to.
python -m unittest discover -s scripts/voices -p "test_eval_judge.py"
"""

import json
import os
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

import eval_judge

FAKES = Path(__file__).resolve().parents[1] / "ai-e2e" / "fakes"


def say(folder, name, text):
    """A take of `text` from the fake worker, at folder/name.wav, with its sidecar."""
    jobs = folder / f"{name}.jobs.json"
    out = folder / f"{name}.wav"
    jobs.write_text(json.dumps({"voices": {}, "items": [{"who": "x", "text": text, "out": str(out), "seed": 1}]}), encoding="utf-8")
    subprocess.run([sys.executable, str(FAKES / "voices_worker.py"), str(jobs)], check=True, capture_output=True)
    jobs.unlink()
    return out


class Evaluate(unittest.TestCase):
    def setUp(self):
        self.dir = Path(tempfile.mkdtemp())
        self.old = os.environ.get("VOICES_JUDGE")
        os.environ["VOICES_JUDGE"] = "fake"
        (self.dir / "refs").mkdir()
        for who in ("han", "rick"):
            say(self.dir / "refs", who, "a reference of some length to hear")
        labels = {}
        for name, who, text in (("han-1", "han", "Never tell me the odds."), ("han-2", "han", "Laugh it up, fuzzball."), ("rick-1", "rick", "Wubba lubba dub dub, Morty.")):
            say(self.dir, name, text)
            labels[f"{name}.wav"] = {"who": who, "text": text, "good": True}
        # a take in someone else's voice: the right words, the wrong mouth
        say(self.dir, "other", "Get in the car, Morty.")
        Path(f"{self.dir / 'other.wav'}.said.json").write_text(json.dumps({"said": "Get in the car, Morty.", "sim": 0.3}), encoding="utf-8")
        labels["other.wav"] = {"who": "rick", "text": "Get in the car, Morty.", "good": False}
        # a mumbled take: the words wrong
        say(self.dir, "mumbled", "Han mumbles something about the Kessel Run.")
        labels["mumbled.wav"] = {"who": "han", "text": "Han mumbles something about the Kessel Run.", "good": False}
        (self.dir / "labels.json").write_text(json.dumps(labels), encoding="utf-8")

    def tearDown(self):
        if self.old is None:
            os.environ.pop("VOICES_JUDGE", None)
        else:
            os.environ["VOICES_JUDGE"] = self.old

    def test_the_good_takes_are_heard_word_for_word_and_in_their_own_voices(self):
        r = eval_judge.evaluate(self.dir)
        self.assertEqual(r["good"], 3)
        self.assertEqual(r["wer"], 0.0)
        self.assertEqual(r["speaker_first"], 1.0)

    def test_a_line_is_heard_against_what_the_engine_was_asked_to_say(self):
        # the label keeps the line as the site has it (curly quotes, a bracketed aside); the judge
        # hears it against speakable(), as generate.py does, so neither counts as a wrong word
        labels = json.loads((self.dir / "labels.json").read_text(encoding="utf-8"))
        labels["han-1.wav"]["text"] = "Never tell me the odds. [Grins.]"
        labels["han-2.wav"]["text"] = "Laugh it up, fuzzball’s friend."
        Path(f"{self.dir / 'han-2.wav'}.said.json").write_text(json.dumps({"said": "Laugh it up, fuzzball's friend.", "sim": 0.9}), encoding="utf-8")
        (self.dir / "labels.json").write_text(json.dumps(labels), encoding="utf-8")
        r = eval_judge.evaluate(self.dir)
        self.assertEqual(r["wer"], 0.0)

    def test_every_bad_take_scores_under_every_good_one(self):
        r = eval_judge.evaluate(self.dir)
        self.assertTrue(r["ordered"])
        rows = {x["take"]: x for x in r["rows"]}
        self.assertIsNone(rows["mumbled.wav"]["score"])
        self.assertLess(rows["other.wav"]["score"], min(rows[t]["score"] for t in ("han-1.wav", "han-2.wav", "rick-1.wav")))

    def test_the_lines_say_what_fell_short(self):
        self.assertEqual(eval_judge.short({"wer": 0.05, "speaker_first": 0.95, "ordered": True}), [])
        self.assertEqual(eval_judge.short({"wer": 0.2, "speaker_first": 0.8, "ordered": False}), ["word error rate 20% on the good takes, over 10%", "the right speaker first for 80%, under 90%", "a bad take scored over a good one"])


if __name__ == "__main__":
    unittest.main()
