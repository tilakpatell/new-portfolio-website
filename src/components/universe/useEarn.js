import { useCallback, useEffect, useRef, useState } from 'react';
import { useEconomy } from './EconomyProvider';
import { earnNote } from './economy';
import { createPayLedger, createPayQueue } from './earnRules';

const NOTE_MS = 2500; // a "+40 ¢" up long enough to read
const LEVEL_MS = 4500; // and a level reached, a while longer

// Earning, for a page whose scene pays into the wallet (economy.js through
// EconomyProvider): pay(what, n, side) earns it and puts up a short note,
// "+40 ¢" or "+40 ¢ · Level 4 · Wingmate", for the page's EarnNote. What's
// earned before the wallet has loaded (it comes in its own chunk) is kept
// and paid once it's there, so a kill in the first second isn't lost.
// Given the online client, an alliance made pays allyMade, once a pilot a
// visit (made, ended and made again is still one).
//
// useEarn({ client }) → { pay(what, n = 1, side = null), note: { text,
// level, n } | null }
export function useEarn({ client = null } = {}) {
  const { economy } = useEconomy();
  const [queue] = useState(createPayQueue); // (earnRules.js: kept till the wallet's there)
  const timer = useRef(0);
  const [note, setNote] = useState(null);
  const [allied] = useState(createPayLedger); // (the pilots allied with this visit)
  useEffect(() => () => clearTimeout(timer.current), []);

  const show = useCallback((got) => {
    const said = earnNote(got);
    if (!said) return;
    setNote((was) => ({ ...said, n: (was?.n ?? 0) + 1 }));
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setNote(null), said.level ? LEVEL_MS : NOTE_MS);
  }, []);
  useEffect(() => {
    if (!economy) return undefined;
    for (const got of queue.attach(economy)) show(got);
    if (!import.meta.env.DEV) return undefined;
    // (in development, for checking from a browser: put on the scene's hook,
    // the universe map's or the galaxy's, which the wallet often beats up, so wait for it)
    const hook = () => {
      for (const d of [window.__universeDebug, window.__galaxyDebug]) if (d && !d.economy) d.economy = economy;
    };
    hook();
    const every = setInterval(hook, 500);
    return () => clearInterval(every);
  }, [economy, queue, show]);

  const pay = useCallback(
    (what, n = 1, side = null) => {
      for (const got of queue.pay(what, n, side)) show(got);
    },
    [queue, show],
  );

  useEffect(() => {
    if (!client) return undefined;
    return client.on((e) => {
      if (e.type === 'allied' && allied.once(e.id)) pay('allyMade');
    });
  }, [client, allied, pay]);

  return { pay, note };
}
