"""The choices the voice scripts make, kept apart from the models so they can be
tested: where speech splits into utterances, which known quote a transcript
holds, how a candidate segment or a take of a line scores, and which segments
make a voice's reference. test_pick.py beside this file tests them.
"""

import re
from difflib import SequenceMatcher
from itertools import combinations

import numpy as np

# A reference longer than this F5-TTS cuts, leaving its transcript describing
# audio it no longer has; the other engines are happy with it too.
LONGEST = 11.5


def utterances(words, gap=0.35, shortest=1.2, longest=LONGEST):
    """Speech as utterances, from Whisper's word timings [(word, start, end), ...]:
    split where the speaker pauses for `gap` seconds or more, and where a run is
    longer than `longest` at its last sentence end that fits (or its last word).
    Ones shorter than `shortest` are dropped. Returns [(start, end, text), ...]."""
    runs, run = [], []
    for w in words:
        if run and w[1] - run[-1][2] >= gap:
            runs.append(run)
            run = []
        run.append(w)
    if run:
        runs.append(run)

    out = []
    for run in runs:
        while run:
            fits = [i for i, w in enumerate(run) if w[2] - run[0][1] <= longest] or [0]
            last = fits[-1]
            if last < len(run) - 1:
                ends = [i for i in fits if run[i][0].endswith((".", "?", "!"))]
                last = ends[-1] if ends else last
            piece, run = run[: last + 1], run[last + 1 :]
            start, end = piece[0][1], piece[-1][2]
            # (a lone word longer than `longest` is Whisper stretching it over a silence: dropped)
            if shortest <= end - start + 1e-6 and end - start <= longest:
                out.append((start, end, " ".join(w[0] for w in piece)))
    return out


def windows(spans, total, longest=28.0):
    """Where to cut a long recording so Whisper hears it a window at a time:
    [(start, end), ...] covering 0..total, none longer than `longest` seconds,
    cut in the silences between the speech `spans` [(start, end), ...] where it can."""
    gaps = [(e + s) / 2 for (_, e), (s, _) in zip(spans, spans[1:])]
    cuts = [0.0]
    while total - cuts[-1] > longest:
        fits = [g for g in gaps if cuts[-1] < g <= cuts[-1] + longest]
        cuts.append(max(fits) if fits else cuts[-1] + longest)
    return list(zip(cuts, cuts[1:] + [total]))


# Whisper stars out swearing ("f***"), but a clone's transcript has to say
# what the audio says, and a take's words are checked against the line's.
SWEARS = {("f", 3): "uck", ("s", 3): "hit", ("b", 4): "itch", ("a", 2): "ss", ("d", 3): "ick"}


def uncensor(text):
    """Whisper's starred-out swearing written out again."""

    def back(m):
        rest = SWEARS.get((m[1].lower(), len(m[2])))
        return m[1] + rest + m[3] if rest else m[0]

    return re.sub(r"\b([A-Za-z])(\*{2,})([A-Za-z']*)", back, text)


def normal(text):
    """Text as plain lowercase words, for matching what was heard against what was meant."""
    t = text.lower().replace("’", "'").replace("‘", "'")
    return " ".join(re.sub(r"[^a-z0-9']+", " ", t).split())


# Names Whisper writes its own way: compared as the lines spell them, so a take
# isn't failed for saying "Artoo" right
ALIASES = [(r"\br2[- ]?d2\b", "artoo detoo"), (r"\br2\b", "artoo"), (r"\bbird person\b", "birdperson"), (r"\bface[- ]planted\b", "faceplanted"), (r"\bchewy\b", "chewie")]


def spoken(text):
    """`normal`, with the aliases above spelled as the lines spell them."""
    t = text.lower()
    for a, b in ALIASES:
        t = re.sub(a, b, t)
    return normal(t)


def quoted(text, quotes, at_least=0.8):
    """The quote (as given) that `text` says, allowing for a misheard word or two, or None."""
    heard = normal(text).split()
    best, found = at_least, None
    for q in quotes:
        want = normal(q).split()
        if not want:
            continue
        n = len(want)
        windows = [heard[i : i + k] for k in (n - 1, n, n + 1) if k > 0 for i in range(max(1, len(heard) - k + 1))]
        for w in windows:
            r = SequenceMatcher(None, " ".join(w), " ".join(want)).ratio()
            if r >= best:
                best, found = r, q
    return found


def segment_score(sim, margin, ovrl, utmos, halves=None):
    """How good a candidate is as reference audio: mostly how surely it's the
    speaker (similarity to their voiceprint, and margin over every other crew
    voice), then how clean (DNSMOS overall) and natural (UTMOS) it sounds, less
    a cost when its two halves sound like different people."""
    split = 0.5 * max(0.0, 0.35 - halves) if halves is not None else 0.0
    return sim + 0.5 * margin + 0.15 * (ovrl - 3) + 0.1 * (utmos - 3) - split


def stretches(seconds, size=1.5, hop=0.5):
    """The overlapping stretches [(start, end), ...] a segment is checked a piece at a time in."""
    if seconds <= size:
        return [(0.0, seconds)]
    n = int((seconds - size) / hop + 1e-9)
    starts = [i * hop for i in range(n + 1)]
    if starts[-1] + size < seconds - 1e-9:
        starts.append(seconds - size)
    return [(round(a, 3), round(a + size, 3)) for a in starts]


def pure(sims, sim, floor=0.2, share=0.45):
    """Whether a segment is the speaker all the way through: no stretch of it
    (`sims`, each stretch's similarity to their voice) falls below `share` of
    the whole segment's similarity `sim`, or below `floor`. A short line from
    someone else at one end is lost in the whole segment's voiceprint, not in its stretch's."""
    return min(sims, default=sim) >= max(floor, share * sim)


def too_long(seconds, text):
    """Whether a take has run on far past its line (slower than take_score's slowest pace, and then
    some): not worth hearing out, and a minute of audio is more than the voiceprint model can hold."""
    return seconds > len(normal(text).split()) / 0.8 + 3


def take_score(wer, sim, utmos, wps):
    """How good a take of a line is, or None when it isn't usable: wrong words
    (WER over a third), a pace no one talks at (words per second), or a voice
    that isn't the speaker's (similarity to the reference under 0.3)."""
    if wer > 0.34 or not 0.8 <= wps <= 6.0 or sim < 0.3:
        return None
    # sounding like them counts most: a natural take that isn't quite them is the wrong take
    return 1.5 * sim + 0.1 * (utmos - 3) - 1.5 * wer


def centre(prints):
    """The voiceprint at the middle of several, as a unit vector."""
    m = np.mean(prints, axis=0)
    return m / np.linalg.norm(m)


def dominant(prints, known, alike=0.65, least=8.0, apart=0.6):
    """Seeds for a voice no clip or quote can start from: the voice heard most, by seconds, in
    their own scenes ([(voiceprint, seconds), ...] from their own searches: "Andy Bernard talking
    heads" are mostly Andy), that isn't one of the `known` voices ({who: centroid}). Its
    utterances, or [] when no one speaks there for `least` seconds."""
    vps = [np.asarray(v, dtype=np.float32) for v, _ in prints]
    secs = np.array([t for _, t in prints], dtype=np.float32)
    if not vps:
        return []
    sims = np.stack(vps) @ np.stack(vps).T
    for i in np.argsort(-((sims >= alike) * secs).sum(1)):
        near = [j for j in range(len(vps)) if sims[i, j] >= alike]
        if secs[near].sum() < least:
            return []
        c = centre([vps[j] for j in near])
        if all(float(c @ k) < apart for k in known.values()):
            return [vps[j] for j in near]
    return []


def identify(vp, who, centroids):
    """(similarity, margin): how like `who` a voiceprint is, and by how much more
    than like the nearest other voice."""
    sim = float(vp @ centroids[who])
    return sim, sim - max((float(vp @ c) for w, c in centroids.items() if w != who), default=0.0)


def refine(seeds, pool, rounds=2, top=8, shortest=2.0):
    """Each voice's voiceprint centroid, from a few sure examples (`seeds`: the
    site's clips of them and segments saying their known quotes) grown with the
    `top` candidates from their `pool` [(voiceprint, seconds), ...] most like
    them and more like them than anyone else. Voices with no seed are left out:
    better no reference than somebody else's."""
    cents = {w: centre(s) for w, s in seeds.items() if len(s)}
    for _ in range(rounds):
        new = {}
        for who in cents:
            ranked = sorted(((identify(v, who, cents), v) for v, secs in pool.get(who, []) if secs >= shortest), key=lambda x: -x[0][0])
            new[who] = centre(list(seeds[who]) + [v for (_, margin), v in ranked if margin > 0][:top])
        cents = new
    return cents


# Titles that mean someone other than the character is talking: reactions,
# parodies, toys, impressions, made-up voices, people talking about the show.
AVOID = [r"\breact", r"\blego\b", r"\bparody\b", r"\bai\b", r"\bfan ?made\b", r"\bimpression", r"\bvoice actor\b", r"\binterview\b", r"\bpodcast\b", r"\bexplained\b", r"\bbehind the scenes\b", r"\bremix\b", r"\bcover\b", r"\bsings?\b", r"\bdubbed\b", r"\bfandub", r"\bfortnite\b"]
# Longer than this it's a compilation or a whole episode: slow to clean and full of other voices
LONGEST_SOURCE = 480


def video_id(url):
    """A YouTube video's id, from its URL or as given, or None."""
    m = re.search(r"(?:v=|youtu\.be/|shorts/|embed/)([\w-]{11})", url) or re.fullmatch(r"([\w-]{11})", url)
    return m[1] if m else None


def usable(title, seconds, avoid):
    """Whether a search result is worth fetching: not a reaction, parody or the
    like (nor anything in `avoid`), and not longer than LONGEST_SOURCE."""
    if seconds is not None and seconds > LONGEST_SOURCE:
        return False
    t = title.lower()
    return not any(re.search(a, t) for a in AVOID) and not any(a.lower() in t for a in avoid)


def excluded(source, start, rules):
    """Whether a segment is ruled out by sources.json's "exclude": a source's id
    (with or without its "yt-"), or "id@start" for one segment of it."""
    bare = source.removeprefix("yt-")
    for r in rules:
        name, _, at = r.partition("@")
        if name.removeprefix("yt-") == bare and (not at or abs(float(at) - start) < 0.05):
            return True
    return False


def choose(segments, longest=LONGEST, enough=7.0, most=3):
    """The segments a reference is made of: up to `most` from one source, at
    most `longest` seconds in all, with the best duration-weighted score, less
    a cost for falling short of `enough` seconds. In the order they were said."""
    best, value = [], float("-inf")
    for source in {s["source"] for s in segments}:
        mine = sorted((s for s in segments if s["source"] == source), key=lambda s: -s["score"])[:10]
        for k in range(1, most + 1):
            for group in combinations(mine, k):
                total = sum(s["end"] - s["start"] for s in group)
                if total > longest:
                    continue
                mean = sum(s["score"] * (s["end"] - s["start"]) for s in group) / total
                v = mean - 0.6 * max(0.0, enough - total) / enough
                if v > value:
                    best, value = list(group), v
    return sorted(best, key=lambda s: s["start"])


# How each direction a line can be given (delivery.json) feels, as how far from the speaker's own
# usual it sits in arousal, dominance and valence (judge.feeling), in spreads of theirs: a
# shout is far more aroused and forceful than they usually are, a sad line quieter and unhappier.
FEELINGS = {
    "neutral": (0.0, 0.0, 0.0),
    "warm": (-0.5, -0.2, 1.0),
    "cheerful": (0.6, 0.2, 1.2),
    "excited": (1.4, 0.6, 1.0),
    "amused": (0.3, 0.2, 0.9),
    "sarcastic": (0.0, 0.6, -0.3),
    "smug": (-0.2, 0.9, 0.4),
    "irritated": (0.7, 0.8, -0.9),
    "angry": (1.3, 1.2, -1.3),
    "urgent": (1.3, 0.8, -0.3),
    "shouting": (1.8, 1.3, -0.3),
    "scared": (1.2, -1.2, -1.2),
    "nervous": (0.5, -1.0, -0.6),
    "sad": (-0.9, -0.8, -1.3),
    "weary": (-1.0, -0.5, -0.6),
    "disgusted": (0.4, 0.6, -1.3),
    "surprised": (1.2, 0.0, 0.2),
    "whispered": (-1.5, -0.8, 0.0),
    "commanding": (0.6, 1.5, -0.2),
    "pleading": (0.6, -1.0, -0.8),
}
# how far each intensity (1 mild, 2 clear, 3 strong) takes it
STRENGTH = {1: 0.6, 2: 1.0, 3: 1.5}


def feel_target(emotion, intensity, mean, spread):
    """The (arousal, dominance, valence) a line given `emotion` at `intensity` should come out
    with, for a speaker who usually sounds `mean`, give or take `spread`; None for a direction
    that isn't one of FEELINGS."""
    if emotion not in FEELINGS:
        return None
    k = STRENGTH.get(int(intensity), 1.0)
    return tuple(min(1.0, max(0.0, m + k * z * s)) for m, z, s in zip(mean, FEELINGS[emotion], spread))


def feel_distance(avd, target, spread):
    """How far a take's feeling is from where its line should be, in the speaker's spreads."""
    return float(np.sqrt(sum(((a - t) / s) ** 2 for a, t, s in zip(avd, target, spread))))


def closest_feeling(rows, target, spread):
    """The row (each with its "avd") whose feeling is nearest `target`."""
    return min(rows, key=lambda r: feel_distance(r["avd"], target, spread))
