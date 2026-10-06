"""The choices grab.py and generate.py make, without any models:
python -m unittest discover -s scripts/voices -p "test_*.py"
"""

import unittest

from pick import choose, normal, quoted, segment_score, take_score, utterances


def words(text, start=0.0, each=0.3, pauses=None):
    """Word timings for `text`, `each` seconds a word, with extra silence after the words named in `pauses`."""
    out, t = [], start
    for i, w in enumerate(text.split()):
        out.append((w, t, t + each))
        t += each + (pauses or {}).get(i, 0.0)
    return out


class Utterances(unittest.TestCase):
    def test_a_long_pause_splits(self):
        got = utterances(words("I am the one who knocks. Say my name now", pauses={5: 0.5}))
        self.assertEqual([u[2] for u in got], ["I am the one who knocks.", "Say my name now"])
        self.assertAlmostEqual(got[1][0], 6 * 0.3 + 0.5)

    def test_a_short_pause_does_not(self):
        got = utterances(words("I am the one who knocks. Say my name now", pauses={5: 0.2}))
        self.assertEqual(len(got), 1)

    def test_too_short_is_dropped(self):
        got = utterances(words("Yo. Science bitch, that is what this is all about", pauses={0: 0.6}))
        self.assertEqual([u[2] for u in got], ["Science bitch, that is what this is all about"])

    def test_a_long_run_splits_at_a_sentence_end(self):
        text = "one two three four five six seven eight nine ten. " * 5
        got = utterances(words(text.strip()), longest=11.5)
        self.assertTrue(all(e - s <= 11.5 for s, e, _ in got))
        self.assertTrue(all(t.endswith(".") for _, _, t in got[:-1]))
        self.assertEqual(" ".join(t for _, _, t in got), text.strip())


class Quotes(unittest.TestCase):
    def test_normal(self):
        self.assertEqual(normal("Nobody exists — on purpose, Morty!"), "nobody exists on purpose morty")

    def test_finds_a_quote_inside_more_talk(self):
        self.assertEqual(quoted("Well, nobody exists on purpose, Morty.", ["Nobody exists on purpose."]), "Nobody exists on purpose.")

    def test_tolerates_a_misheard_word(self):
        self.assertEqual(quoted("nobody exist on purpose", ["Nobody exists on purpose."]), "Nobody exists on purpose.")

    def test_unrelated_talk_is_no_quote(self):
        self.assertIsNone(quoted("I am the danger", ["Nobody exists on purpose."]))


class Scores(unittest.TestCase):
    def test_a_better_voice_match_scores_higher(self):
        self.assertGreater(segment_score(0.7, 0.3, 3.0, 3.0, 0.6), segment_score(0.5, 0.3, 3.0, 3.0, 0.6))

    def test_two_voices_in_one_segment_cost(self):
        self.assertLess(segment_score(0.7, 0.3, 3.0, 3.0, 0.1), segment_score(0.7, 0.3, 3.0, 3.0, 0.6))

    def test_a_take_with_wrong_words_is_rejected(self):
        self.assertIsNone(take_score(wer=0.5, sim=0.7, utmos=3.5, wps=2.5))

    def test_a_take_at_the_wrong_pace_is_rejected(self):
        self.assertIsNone(take_score(wer=0.0, sim=0.7, utmos=3.5, wps=9.0))
        self.assertIsNone(take_score(wer=0.0, sim=0.7, utmos=3.5, wps=0.5))

    def test_a_good_take_scores(self):
        self.assertGreater(take_score(wer=0.0, sim=0.7, utmos=3.5, wps=2.5), take_score(wer=0.1, sim=0.7, utmos=3.5, wps=2.5))


def seg(source, start, end, score):
    return {"source": source, "start": start, "end": end, "score": score}


class Choose(unittest.TestCase):
    def test_keeps_to_one_source_and_the_limit(self):
        segs = [seg("a", 0, 4, 1.0), seg("a", 5, 9, 0.9), seg("a", 10, 14, 0.8), seg("b", 0, 3, 1.2)]
        got = choose(segs, longest=11.5)
        self.assertEqual({s["source"] for s in got}, {"a"})
        self.assertLessEqual(sum(s["end"] - s["start"] for s in got), 11.5)
        self.assertEqual(len(got), 2)

    def test_in_the_order_they_were_said(self):
        got = choose([seg("a", 5, 9, 1.0), seg("a", 0, 4, 0.95)])
        self.assertEqual([s["start"] for s in got], [0, 5])

    def test_one_long_good_segment_beats_padding_with_poor_ones(self):
        got = choose([seg("a", 0, 9, 1.0), seg("b", 0, 3, 0.2), seg("b", 4, 7, 0.2), seg("b", 8, 11, 0.2)])
        self.assertEqual(got, [seg("a", 0, 9, 1.0)])

    def test_nothing_to_choose_from(self):
        self.assertEqual(choose([]), [])


if __name__ == "__main__":
    unittest.main()
