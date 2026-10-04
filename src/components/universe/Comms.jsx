import { useEffect, useImperativeHandle, useRef, useState } from 'react';
import { linesFor } from './crews';
import { playClip } from '../../lib/clips';
import { arrivalSound, boostSound, bumpSound, fireSound, speak } from './sounds';
import Face from './Faces';

// The ship's comms: what the crew says as you fly, one line at a time with
// the speaker's face and voice (their own recording where the line has one),
// over the open part of the map. Reaching a world for the first time this
// visit plays its sound bite and then the crew's exchange about it;
// launching, boosting, bumping into things and reaching the edge get a line
// now and then (not every time); three hard bumps in a row, sitting still a
// while and flying into the sun get one of their own. Shots are just sound.
// The page hands events over through `control.current.handle(event)`.

const GAP = { boost: 25000, bump: 12000, edge: 20000, crash: 60000 }; // ms before the same kind of line again
const COMMS = { name: 'On the comms', color: '#9fb0d0', voice: null }; // a voice on the radio that isn't the crew's

export default function Comms({ crew, reduced, control }) {
  const [line, setLine] = useState(null); // { who, text, n }
  const queue = useRef([]);
  const busy = useRef(false);
  const said = useRef(new Set()); // what's been said this visit
  const lastAt = useRef({});
  const lastSound = useRef({});
  const hardBumps = useRef([]);
  const timer = useRef(0);
  const alive = useRef(true);
  const n = useRef(0);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      clearTimeout(timer.current);
    };
  }, []);

  // a new crew starts fresh
  useEffect(() => {
    queue.current = [];
    said.current = new Set();
    lastAt.current = {};
    clearTimeout(timer.current);
    busy.current = false;
    setLine(null);
  }, [crew]);

  const wait = (ms) =>
    new Promise((r) => {
      clearTimeout(timer.current);
      timer.current = setTimeout(r, ms);
    });

  const run = async () => {
    if (busy.current) return;
    busy.current = true;
    while (queue.current.length && alive.current) {
      const [who, text, clip] = queue.current.shift();
      const speaker = who === 'comms' ? COMMS : crew?.speakers[who];
      if (!speaker) continue;
      n.current += 1;
      setLine({ who, text, n: n.current });
      const least = 1200 + text.length * 32;
      if (clip) {
        // their own voice: the line stays up while it plays
        const started = performance.now();
        const h = await playClip(clip);
        if (h) await Promise.race([h.ended, new Promise((r) => setTimeout(r, 7000))]);
        await wait(Math.max(300, least - (performance.now() - started)));
      } else await wait(Math.max(speaker.voice ? speak(speaker.voice, text) : 0, 1500 + text.length * 42));
    }
    if (alive.current) {
      await wait(400);
      if (!queue.current.length && alive.current) setLine(null);
    }
    busy.current = false;
    if (queue.current.length && alive.current) run();
  };

  const say = (exchange, { urgent = false } = {}) => {
    if (!exchange?.length) return;
    if (urgent) queue.current = [...exchange];
    else if (busy.current) return; // something's already being said
    else queue.current = [...exchange];
    run();
  };

  const often = (kind, now) => {
    if (now - (lastAt.current[kind] ?? -Infinity) < GAP[kind]) return false;
    lastAt.current[kind] = now;
    return true;
  };
  const soundOnce = (kind, ms, now) => {
    if (now - (lastSound.current[kind] ?? -Infinity) < ms) return false;
    lastSound.current[kind] = now;
    return true;
  };

  useImperativeHandle(
    control,
    () => ({
      async handle(e) {
        const now = performance.now();
        if (e.type === 'arrive') {
          const key = `arrive:${e.id}`;
          if (said.current.has(key)) return;
          said.current.add(key);
          await arrivalSound(e.id);
          if (alive.current) say(linesFor(crew, 'arrive', e.id), { urgent: true });
        } else if (e.type === 'launch') {
          if (said.current.has('launch')) return;
          said.current.add('launch');
          say(linesFor(crew, 'launch'));
        } else if (e.type === 'boost') {
          if (soundOnce('boost', 1200, now)) boostSound(crew?.id, e.first);
          if (e.first || often('boost', now)) say(linesFor(crew, 'boost'));
        } else if (e.type === 'bump') {
          if (soundOnce('bump', 500, now)) bumpSound();
          if (!e.hard) return;
          if (e.id === 'sun' && !said.current.has('sun')) {
            // straight into the sun: once a visit
            said.current.add('sun');
            say([['comms', 'Oh shit, mother—', 'ohShit']], { urgent: true });
            return;
          }
          hardBumps.current = [...hardBumps.current.filter((at) => now - at < 30000), now];
          if (hardBumps.current.length >= 3 && linesFor(crew, 'crash') && often('crash', now)) {
            hardBumps.current = [];
            say(linesFor(crew, 'crash'), { urgent: true });
          } else if (often('bump', now)) say(linesFor(crew, 'bump'), { urgent: true });
        } else if (e.type === 'edge') {
          if (often('edge', now)) say(linesFor(crew, 'edge'));
        } else if (e.type === 'idle') {
          if (said.current.has('idle')) return;
          said.current.add('idle');
          say(linesFor(crew, 'idle'));
        } else if (e.type === 'fire') {
          if (soundOnce('fire', 150, now)) fireSound(crew?.id);
        }
      },
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [crew],
  );

  const speaker = line && (line.who === 'comms' ? COMMS : crew?.speakers[line.who]);
  return (
    <div className="universe-comms" aria-live="polite" data-motion={reduced ? undefined : ''}>
      {speaker && (
        <p key={line.n} className="universe-line" style={{ '--who': speaker.color }}>
          {line.who !== 'comms' && <Face who={line.who} className="universe-face" />}
          <span>
            <span className="universe-who">{speaker.name}</span>
            <span className="universe-said">{line.text}</span>
          </span>
        </p>
      )}
    </div>
  );
}
