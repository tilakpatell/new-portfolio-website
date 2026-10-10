"""The choices grab.py and generate.py make, without any models:
python -m unittest discover -s scripts/voices -p "test_*.py"
"""

import unittest

import numpy as np

from pick import FEELINGS, centre, dominant, closest_feeling, feel_distance, feel_target, choose, excluded, identify, normal, pure, spoken, quoted, refine, segment_score, stretches, take_score, too_long, uncensor, usable, utterances, video_id, windows


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

    def test_a_word_whisper_stretched_over_a_silence_is_dropped(self):
        got = utterances([("Yeah.", 0.0, 40.0), ("Science,", 40.2, 40.6), ("bitch!", 40.7, 41.4)])
        self.assertTrue(all(e - s <= 11.5 for s, e, _ in got))
        self.assertEqual([t for _, _, t in got], ["Science, bitch!"])  # the words after it are kept

    def test_a_long_run_splits_at_a_sentence_end(self):
        text = "one two three four five six seven eight nine ten. " * 5
        got = utterances(words(text.strip()), longest=11.5)
        self.assertTrue(all(e - s <= 11.5 for s, e, _ in got))
        self.assertTrue(all(t.endswith(".") for _, _, t in got[:-1]))
        self.assertEqual(" ".join(t for _, _, t in got), text.strip())


class Windows(unittest.TestCase):
    def test_short_audio_is_one_window(self):
        self.assertEqual(windows([(1.0, 5.0)], 12.0), [(0.0, 12.0)])

    def test_cuts_fall_between_speech(self):
        spans = [(0.5, 10.0), (11.0, 20.0), (21.0, 27.0), (29.0, 40.0)]
        got = windows(spans, 45.0, longest=28.0)
        self.assertEqual(got[0][0], 0.0)
        self.assertEqual(got[-1][1], 45.0)
        self.assertTrue(all(b - a <= 28.0 for a, b in got))
        for (_, b), (a, _) in zip(got, got[1:]):
            self.assertEqual(a, b)
            self.assertFalse(any(s < b < e for s, e in spans), f"cut at {b} is inside speech")

    def test_one_long_run_is_cut_anyway(self):
        got = windows([(0.0, 70.0)], 70.0, longest=28.0)
        self.assertTrue(all(b - a <= 28.0 for a, b in got))
        self.assertEqual((got[0][0], got[-1][1]), (0.0, 70.0))


class Quotes(unittest.TestCase):
    def test_uncensor(self):
        self.assertEqual(uncensor("You can go f*** yourself."), "You can go fuck yourself.")
        self.assertEqual(uncensor("F***ing magnets, b****!"), "Fucking magnets, bitch!")
        self.assertEqual(uncensor("Holy s***, it's 5 * 3"), "Holy shit, it's 5 * 3")
        self.assertEqual(uncensor("q*** stays"), "q*** stays")

    def test_names_whisper_spells_its_own_way(self):
        self.assertEqual(spoken("Hang on, R2!"), spoken("Hang on, Artoo!"))
        self.assertEqual(spoken("Bye, bird person!"), spoken("Bye, Birdperson!"))
        self.assertEqual(spoken("Yo, it just face-planted."), spoken("Yo, it just faceplanted."))
        self.assertEqual(spoken("R2-D2, where are you?"), "artoo detoo where are you")

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

    def test_someone_else_in_one_stretch_makes_it_impure(self):
        self.assertFalse(pure([-0.06, 0.6, 0.61, 0.83], 0.95))  # Summer's "You're not my brother?" before Morty

    def test_one_voice_throughout_is_pure(self):
        self.assertTrue(pure([0.6, 0.61, 0.83], 0.95))
        self.assertTrue(pure([0.31, 0.35], 0.66))  # a noisier scene, judged against its own level
        self.assertTrue(pure([], 0.8))

    def test_stretches_cover_a_segment(self):
        self.assertEqual(stretches(1.0), [(0.0, 1.0)])
        got = stretches(4.0, size=1.5, hop=0.5)
        self.assertEqual(got[0], (0.0, 1.5))
        self.assertEqual(got[-1], (2.5, 4.0))
        self.assertTrue(all(b - a == 1.5 for a, b in got))

    def test_a_take_with_wrong_words_is_rejected(self):
        self.assertIsNone(take_score(wer=0.5, sim=0.7, utmos=3.5, wps=2.5))

    def test_a_take_at_the_wrong_pace_is_rejected(self):
        self.assertIsNone(take_score(wer=0.0, sim=0.7, utmos=3.5, wps=9.0))
        self.assertIsNone(take_score(wer=0.0, sim=0.7, utmos=3.5, wps=0.5))

    def test_a_take_that_runs_on_is_too_long(self):
        self.assertTrue(too_long(60.0, "A black hole, Jesse."))
        self.assertFalse(too_long(2.5, "A black hole, Jesse."))
        self.assertFalse(too_long(8.0, "A binary pair. The smaller one is pulling gas off the larger. Chemistry, Jesse, on a scale you can see."))

    def test_a_take_that_isnt_the_speaker_is_rejected(self):
        self.assertIsNone(take_score(wer=0.0, sim=-0.02, utmos=4.4, wps=2.5))

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


def unit(v):
    v = np.asarray(v, dtype=float)
    return v / np.linalg.norm(v)


class Speakers(unittest.TestCase):
    def setUp(self):
        rng = np.random.default_rng(7)
        self.rick, self.morty = unit(rng.normal(size=32)), unit(rng.normal(size=32))
        self.near = lambda c, k: [unit(c + rng.normal(scale=0.35, size=32)) for _ in range(k)]

    def test_margin_is_over_the_nearest_other_voice(self):
        sim, margin = identify(self.rick, "rick", {"rick": self.rick, "morty": self.morty})
        self.assertAlmostEqual(sim, 1.0)
        self.assertAlmostEqual(margin, 1.0 - float(self.rick @ self.morty))

    def test_refining_moves_towards_the_speaker_and_not_the_other(self):
        seed = unit(self.morty + 1.2 * unit(np.ones(32)))  # one poor clip of Morty
        pool = {"morty": [(v, 3.0) for v in self.near(self.morty, 12) + self.near(self.rick, 12)],
                "rick": [(v, 3.0) for v in self.near(self.rick, 12)]}
        got = refine({"morty": [seed], "rick": [self.rick]}, pool)
        self.assertGreater(float(got["morty"] @ self.morty), float(seed @ self.morty))
        self.assertLess(float(got["morty"] @ self.rick), 0.5)

    def test_a_voice_with_no_seed_has_no_centroid(self):
        got = refine({"morty": [], "rick": [self.rick]}, {"morty": [], "rick": []})
        self.assertNotIn("morty", got)


class Sources(unittest.TestCase):
    def test_video_ids(self):
        self.assertEqual(video_id("https://www.youtube.com/watch?v=r1yYJBzf1VQ&t=3s"), "r1yYJBzf1VQ")
        self.assertEqual(video_id("https://youtu.be/r1yYJBzf1VQ"), "r1yYJBzf1VQ")
        self.assertEqual(video_id("r1yYJBzf1VQ"), "r1yYJBzf1VQ")
        self.assertIsNone(video_id("https://example.com/clip.mp3"))

    def test_a_reaction_or_a_sequel_is_no_source(self):
        self.assertFalse(usable("Luke Skywalker REACTION | The Last Jedi", 200, ["last jedi"]))
        self.assertFalse(usable("Star Wars LEGO Luke", 200, []))

    def test_too_long_or_unknown_length_is_no_source(self):
        self.assertFalse(usable("Hank Schrader best moments", 1800, []))
        self.assertTrue(usable("Hank Schrader best moments", None, []))
        self.assertTrue(usable("Breaking Bad - Jesus Christ Marie! They're Minerals!", 42, []))

    def test_a_catchphrase_is_not_a_dub(self):
        self.assertTrue(usable("Rick and Morty - Wubba Lubba Dub Dub scene", 60, []))
        self.assertFalse(usable("Rick and Morty Spanish dubbed", 60, []))
        self.assertFalse(usable("Morty fandub", 60, []))

    def test_ai_in_a_word_is_not_an_ai_voice(self):
        self.assertTrue(usable("Han Solo said it again", 60, []))
        self.assertFalse(usable("Han Solo AI voice sings", 60, []))

    def test_excluded(self):
        rules = ["yt-abc", "yt-def@12.3", "ghi"]
        self.assertTrue(excluded("yt-abc", 40.0, rules))
        self.assertTrue(excluded("yt-def", 12.31, rules))
        self.assertFalse(excluded("yt-def", 20.0, rules))
        self.assertTrue(excluded("yt-ghi", 1.0, rules))
        self.assertFalse(excluded("clip-im-in", 0.0, rules))


class TestFeeling(unittest.TestCase):
    mean, spread = (0.5, 0.6, 0.45), (0.14, 0.12, 0.14)

    def test_a_shout_is_more_aroused_and_forceful_than_a_mild_line(self):
        loud = feel_target("shouting", 3, self.mean, self.spread)
        mild = feel_target("neutral", 1, self.mean, self.spread)
        self.assertGreater(loud[0], mild[0] + 0.2)
        self.assertGreater(loud[1], mild[1])

    def test_sad_is_low_and_unhappy(self):
        sad = feel_target("sad", 2, self.mean, self.spread)
        self.assertLess(sad[0], self.mean[0])
        self.assertLess(sad[2], self.mean[2])

    def test_targets_stay_in_range(self):
        for e in FEELINGS:
            for i in (1, 2, 3):
                self.assertTrue(all(0.0 <= x <= 1.0 for x in feel_target(e, i, self.mean, self.spread)))

    def test_an_unknown_direction_is_no_target(self):
        self.assertIsNone(feel_target("bemused", 2, self.mean, self.spread))

    def test_distance_is_in_spreads(self):
        self.assertAlmostEqual(feel_distance((0.64, 0.6, 0.45), (0.5, 0.6, 0.45), self.spread), 1.0, places=3)

    def test_closest_reference(self):
        rows = [{"avd": (0.4, 0.5, 0.5), "id": "calm"}, {"avd": (0.85, 0.85, 0.3), "id": "yell"}]
        target = feel_target("angry", 3, self.mean, self.spread)
        self.assertEqual(closest_feeling(rows, target, self.spread)["id"], "yell")


class TestDominant(unittest.TestCase):
    def unit(self, *xs):
        v = np.asarray(xs, dtype=np.float32)
        return v / np.linalg.norm(v)

    def test_the_voice_most_heard_in_their_own_scenes(self):
        andy = [(self.unit(1, 0.05 * i, 0), 3.0) for i in range(5)]
        dwight = [(self.unit(0, 1, 0.05 * i), 3.0) for i in range(2)]
        got = dominant(andy + dwight, {})
        self.assertEqual(len(got), 5)
        self.assertGreater(float(centre(got) @ self.unit(1, 0, 0)), 0.95)

    def test_not_someone_already_known(self):
        michael = [(self.unit(1, 0.05 * i, 0), 3.0) for i in range(6)]
        andy = [(self.unit(0, 0, 1 + 0.05 * i), 3.0) for i in range(3)]
        got = dominant(michael + andy, {"michael": self.unit(1, 0, 0)})
        self.assertGreater(float(centre(got) @ self.unit(0, 0, 1)), 0.95)

    def test_nothing_when_no_one_speaks_enough(self):
        self.assertEqual(dominant([(self.unit(1, 0, 0), 2.0)], {}), [])


if __name__ == "__main__":
    unittest.main()
