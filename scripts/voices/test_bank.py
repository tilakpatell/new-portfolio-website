import unittest

import numpy as np

from bank import chosen


def unit(*xs):
    v = np.asarray(xs, dtype=np.float32)
    return v / np.linalg.norm(v)


class TestBank(unittest.TestCase):
    cents = {"han": unit(1, 0, 0), "luke": unit(0, 1, 0)}

    def seg(self, vp, start=0.0, end=3.0, **kw):
        return {"start": start, "end": end, "text": "x", "vp": unit(*vp).tolist(), "halves": None, "clipped": 0.0, **kw}

    def test_keeps_lines_that_are_surely_the_speaker(self):
        got = chosen({"a": [self.seg((1, 0.1, 0)), self.seg((0.1, 1, 0))]}, "han", self.cents)
        self.assertEqual(len(got), 1)
        self.assertGreater(got[0][2], 0.9)

    def test_leaves_out_lines_too_like_someone_else(self):
        self.assertEqual(chosen({"a": [self.seg((1, 0.9, 0))]}, "han", self.cents), [])

    def test_leaves_out_two_speakers_clipping_and_odd_lengths(self):
        segs = [self.seg((1, 0, 0), halves=0.2), self.seg((1, 0, 0), clipped=0.01), self.seg((1, 0, 0), end=0.5), self.seg((1, 0, 0), end=30.0)]
        self.assertEqual(chosen({"a": segs}, "han", self.cents), [])

    def test_best_first(self):
        got = chosen({"a": [self.seg((1, 0.3, 0)), self.seg((1, 0.05, 0))]}, "han", self.cents)
        self.assertGreater(got[0][2], got[1][2])


if __name__ == "__main__":
    unittest.main()
