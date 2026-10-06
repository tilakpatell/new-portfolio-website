"""engines/worker.serve, with a stand-in model:
python -m unittest discover -s scripts/voices -p "test_*.py"
"""

import io
import json
import shutil
import sys
import tempfile
import unittest
from contextlib import redirect_stdout
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parent / "engines"))
import worker  # noqa: E402


class Serve(unittest.TestCase):
    def setUp(self):
        self.dir = Path(tempfile.mkdtemp())
        self.calls = []

    def tearDown(self):
        shutil.rmtree(self.dir, ignore_errors=True)

    def jobs(self, items):
        f = self.dir / "jobs.json"
        f.write_text(json.dumps({"voices": {"walt": {"wav": "w", "text": "w"}, "han": {"wav": "h", "text": "h"}}, "items": items}), encoding="utf-8")
        return f

    def item(self, who, n):
        return {"who": who, "text": f"line {n}", "out": str(self.dir / who / f"{n}.wav"), "seed": n}

    def serve(self, load, items):
        out = io.StringIO()
        with redirect_stdout(out):
            worker.serve(load, self.jobs(items))
        return out.getvalue().splitlines()

    def test_one_at_a_time(self):
        def load(jobs):
            def say(voice, text, seed):
                self.calls.append([text])
                return np.zeros(100, dtype=np.float32), 24000

            return say

        said = self.serve(load, [self.item("walt", 1), self.item("walt", 2)])
        self.assertEqual(said, [f"ok\t{self.dir / 'walt' / '1.wav'}", f"ok\t{self.dir / 'walt' / '2.wav'}"])
        self.assertEqual(self.calls, [["line 1"], ["line 2"]])

    def test_a_model_that_takes_batches_gets_them_a_voice_at_a_time(self):
        def load(jobs):
            def say(voice, text, seed):
                raise AssertionError("should be batched")

            def many(voice, texts, seeds):
                self.calls.append(texts)
                return [(np.zeros(100, dtype=np.float32), 24000) for _ in texts]

            say.many, say.batch = many, 2
            return say

        items = [self.item("walt", 1), self.item("walt", 2), self.item("walt", 3), self.item("han", 4)]
        said = self.serve(load, items)
        self.assertEqual(self.calls, [["line 1", "line 2"], ["line 3"], ["line 4"]])
        self.assertEqual(len([s for s in said if s.startswith("ok\t")]), 4)
        self.assertTrue((self.dir / "han" / "4.wav").exists())

    def test_a_worker_elsewhere_reads_and_writes_its_own_paths_but_reports_the_jobs(self):
        elsewhere = self.dir / "elsewhere"

        def load(jobs):
            def say(voice, text, seed):
                return np.zeros(100, dtype=np.float32), 24000

            return say

        it = {"who": "walt", "text": "line 1", "out": "C:\\takes\\walt\\1.wav", "seed": 1}
        out = io.StringIO()
        with redirect_stdout(out):
            worker.serve(load, self.jobs([it]), local=lambda p: str(elsewhere / Path(p.replace("\\", "/")).name))
        self.assertEqual(out.getvalue().splitlines(), ["ok\tC:\\takes\\walt\\1.wav"])
        self.assertTrue((elsewhere / "1.wav").exists())

    def test_wsl_paths(self):
        self.assertEqual(worker.wsl_path("C:\\Users\\tilak\\x y\\a.wav"), "/mnt/c/Users/tilak/x y/a.wav")
        self.assertEqual(worker.wsl_path("/home/tilak/a.wav"), "/home/tilak/a.wav")

    def test_a_batch_that_fails_fails_each_of_its_lines(self):
        def load(jobs):
            def say(voice, text, seed):
                return np.zeros(100, dtype=np.float32), 24000

            def many(voice, texts, seeds):
                raise RuntimeError("out of memory")

            say.many, say.batch = many, 4
            return say

        said = self.serve(load, [self.item("walt", 1), self.item("walt", 2)])
        self.assertEqual([s.split("\t")[0] for s in said], ["fail", "fail"])


if __name__ == "__main__":
    unittest.main()
