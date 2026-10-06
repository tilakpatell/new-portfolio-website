"""generate.make's rounds of takes, with a stand-in engine and judge (no models):
python -m unittest discover -s scripts/voices -p "test_*.py"
"""

import json
import shutil
import subprocess
import sys
import tempfile
import textwrap
import unittest
from pathlib import Path

import generate

# A worker that "says" every line as a tenth of a second of silence, the way the
# real ones report: "ok<TAB>file" (or "fail" for any line asking for it).
FAKE = textwrap.dedent('''
    import json, os, sys
    import numpy as np, soundfile as sf
    jobs = json.load(open(sys.argv[1], encoding="utf-8"))
    for it in jobs["items"]:
        if "fail" in it["text"]:
            print("fail\\t" + it["out"] + "\\tno", flush=True)
            continue
        os.makedirs(os.path.dirname(it["out"]), exist_ok=True)
        sf.write(it["out"], np.zeros(2400, dtype="float32"), 24000)
        print("ok\\t" + it["out"], flush=True)
''')


class Make(unittest.TestCase):
    def setUp(self):
        self.dir = Path(tempfile.mkdtemp())
        self.takes = self.dir / "cache" / "takes"  # not made yet: make() has to
        self.old = generate.TAKES, generate.engines.start
        generate.TAKES = self.takes
        fake = self.dir / "fake.py"
        fake.write_text(FAKE, encoding="utf-8")
        self.asked = []

        def start(name, jobs, log):
            self.asked.append(json.loads(Path(jobs).read_text(encoding="utf-8"))["items"])
            return subprocess.Popen([sys.executable, str(fake), str(jobs)], stdout=subprocess.PIPE, text=True, encoding="utf-8")

        generate.engines.start = start
        self.voices = {"walt": {"wav": "walt.wav", "text": "x"}}

    def tearDown(self):
        generate.TAKES, generate.engines.start = self.old
        shutil.rmtree(self.dir, ignore_errors=True)

    def judge(self, passing):
        """A judge passing take k of a line when k is in passing[line id] (scoring higher k higher)."""

        def score(who, text, path):
            lid, k = Path(path).stem.split(".")
            k = int(k)
            ok = k in passing.get(lid, ())
            return {"take": str(Path(path).relative_to(self.takes)), "wer": 0.0 if ok else 1.0, "sim": 0.5, "utmos": 3.0, "score": k if ok else None, "speech": None}

        return score

    def run_make(self, lines, passing, takes=2):
        done = []
        generate.make("fake", lines, self.voices, self.judge(passing), takes, lambda l, d, ok: done.append((l["id"], d and d["take"], ok)))
        return done

    def test_the_best_passing_take_is_kept(self):
        done = self.run_make([{"id": "0000000a", "who": "walt", "text": "Say my name."}], {"0000000a": {0, 1}})
        self.assertEqual(done, [("0000000a", str(Path("fake") / "walt" / "0000000a.1.wav"), True)])
        self.assertEqual(len(self.asked), 1)

    def test_a_line_with_no_passing_take_gets_a_second_round(self):
        done = self.run_make([{"id": "0000000b", "who": "walt", "text": "Jesse."}], {"0000000b": {4}})
        self.assertEqual(done, [("0000000b", str(Path("fake") / "walt" / "0000000b.4.wav"), True)])
        self.assertEqual([len(a) for a in self.asked], [2, 4])  # takes 0-1, then 2-5

    def test_after_the_last_round_the_fewest_wrong_words_is_kept_and_flagged(self):
        done = self.run_make([{"id": "0000000c", "who": "walt", "text": "Tread lightly."}], {})
        self.assertEqual(len(done), 1)
        self.assertFalse(done[0][2])

    def test_takes_already_made_are_not_made_again(self):
        line = {"id": "0000000d", "who": "walt", "text": "We need to cook."}
        self.run_make([line], {"0000000d": {0, 1}})
        self.asked.clear()
        done = self.run_make([line], {"0000000d": {0, 1}})
        self.assertEqual(self.asked, [])
        self.assertTrue(done[0][2])

    def test_a_line_made_again_gets_new_takes_not_the_old_ones(self):
        line = {"id": "0000000f", "who": "walt", "text": "Say my name."}
        self.run_make([line], {"0000000f": {0, 1}})
        forgot, salts = [], {}

        class Forgets:
            def forget(self, take):
                forgot.append(Path(take).name)

        generate.redo(line, "fake", Forgets(), salts)
        self.assertEqual(sorted(forgot), ["0000000f.0.wav", "0000000f.1.wav"])
        self.assertEqual(list((self.takes / "fake" / "walt").glob("0000000f.*")), [])
        self.assertEqual(salts, {"0000000f": 1})
        self.asked.clear()
        self.run_make([{**line, "salt": 1}], {"0000000f": {0, 1}})
        self.assertNotIn(generate.seed(line, 0), [it["seed"] for it in self.asked[0]])

    def test_with_two_engines_a_line_keeps_the_better_engines_take(self):
        line = {"id": "00000010", "who": "walt", "text": "Say my name."}
        base = self.judge({"00000010": {0, 1}})

        def judge(who, text, path):  # engine "b" sounds better
            d = dict(base(who, text, path))
            d["score"] = d["score"] + (10 if Path(path).parts[-3] == "b" else 0)
            return d

        done = []
        generate.make_all([line], {"walt": ["a", "b"]}, self.voices, judge, 2, lambda l, d, ok: done.append((l["id"], d["take"], ok)))
        self.assertEqual(done, [("00000010", str(Path("b") / "walt" / "00000010.1.wav"), True)])

    def test_with_two_engines_a_passing_take_beats_a_failing_one(self):
        line = {"id": "00000011", "who": "walt", "text": "Jesse."}
        a = self.judge({"00000011": {1}})

        def judge(who, text, path):  # engine "b" never passes
            return a(who, text, path) if Path(path).parts[-3] == "a" else {**a(who, text, path), "score": None, "wer": 0.9}

        done = []
        generate.make_all([line], {"walt": ["a", "b"]}, self.voices, judge, 2, lambda l, d, ok: done.append((d["take"], ok)))
        self.assertEqual(done, [(str(Path("a") / "walt" / "00000011.1.wav"), True)])

    def test_a_take_the_engine_fails_counts_as_failed(self):
        done = self.run_make([{"id": "0000000e", "who": "walt", "text": "fail"}], {"0000000e": {0, 1, 2, 3, 4, 5}})
        self.assertEqual(done, [("0000000e", None, False)])


if __name__ == "__main__":
    unittest.main()
