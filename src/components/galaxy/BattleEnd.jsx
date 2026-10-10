import { useEffect, useRef, useState } from 'react';
import { END, cardTime, endCard } from './warText';

// The card over the galaxy's view when the battle you're in is decided
// (warfront.js's info.result, the director's: the same end for every pilot
// here): Victory or Defeat for your side, why in words ('The reactor went',
// 'Six transports got away', 'Held out to the end'), what you did in it and
// the points it got you. It shows for END.show seconds from the end, and not
// at all to a pilot who came in after (the line over the galaxy, WarHud.jsx,
// says who won there and when the next battle's on). `front()`: warfront's
// info, or null; warText.js has the words and the timing (END, cardTime).

export function BattleEndCard({ card }) {
  return (
    <section className="galaxy-battleend" data-tone={card.tone ?? undefined} role="status" aria-live="polite">
      <h2 className="galaxy-battleend-title">{card.title}</h2>
      <p className="galaxy-battleend-why">{card.why}</p>
      <p className="galaxy-battleend-yours">
        {card.yours}
        <span className="galaxy-battleend-points">{card.points}</span>
      </p>
    </section>
  );
}

export default function BattleEnd({ front }) {
  const [card, setCard] = useState(null);
  const seen = useRef(null); // the battle whose end's been shown (once a battle)
  useEffect(() => {
    let hide = null;
    const look = () => {
      const info = front?.();
      if (!info?.result || !info.on || seen.current === info.on.id) return;
      seen.current = info.on.id;
      const left = cardTime(info);
      if (left <= 0) return;
      setCard(endCard(info));
      clearTimeout(hide);
      hide = setTimeout(() => setCard(null), left * 1000);
    };
    look();
    const id = setInterval(look, END.every);
    return () => {
      clearInterval(id);
      clearTimeout(hide);
    };
  }, [front]);
  return card ? <BattleEndCard card={card} /> : null;
}
