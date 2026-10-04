import { useEffect, useImperativeHandle, useRef, useState } from 'react';
import { linesFor } from './crews';
import { arrivalSound, boostSound, bumpSound, speak } from './sounds';
import Face from './Faces';

// The ship's comms: what the crew says as you fly, one line at a time with
// the speaker's face and voice, over the open part of the map. Reaching a
// world for the first time this visit plays its sound bite and then the
// crew's exchange about it; launching, boosting, bumping into a planet and
// reaching the edge get a line now and then (not every time). The page
// hands events over through `control.current.handle(event)`.

const GAP = { boost: 25000, bump: 12000, edge: 20000 }; // ms before the same kind of line again

export default function Comms({ crew, reduced, control }) {
  const [line, setLine] = useState(null); // { who, text, n }
  const queue = useRef([]);
  const busy = useRef(false);
  const said = useRef(new Set()); // what's been said this visit
  const lastAt = useRef({});
  const lastSound = useRef({});
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
      const [who, text] = queue.current.shift();
      const speaker = crew?.speakers[who];
      if (!speaker) continue;
      n.current += 1;
      setLine({ who, text, n: n.current });
      const ms = speak(speaker.voice, text);
      await wait(Math.max(ms, 1500 + text.length * 42));
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
          if (e.hard && often('bump', now)) say(linesFor(crew, 'bump'), { urgent: true });
        } else if (e.type === 'edge') {
          if (often('edge', now)) say(linesFor(crew, 'edge'));
        }
      },
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [crew],
  );

  const speaker = line && crew?.speakers[line.who];
  return (
    <div className="universe-comms" aria-live="polite" data-motion={reduced ? undefined : ''}>
      {speaker && (
        <p key={line.n} className="universe-line" style={{ '--who': speaker.color }}>
          <Face who={line.who} className="universe-face" />
          <span>
            <span className="universe-who">{speaker.name}</span>
            <span className="universe-said">{line.text}</span>
          </span>
        </p>
      )}
    </div>
  );
}
