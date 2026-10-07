import { useEffect, useState } from 'react';
import { audioContext } from '../../../lib/audio';
import { local } from '../../../lib/hooks';
import { sayVoiced, stopVoiced } from '../../../lib/voiced';
import Gif from '../../Gif';
import TitleCard from '../TitleCard';
import { SAUL } from '../people';
import { UPGRADES, buy, rankFor } from '../metherria/rules';
import { CAREER, readCareer } from './career';
import '../../../styles/lazy/albuquerque.css';

// The two places that aren't a game of their own: Walt's house (how the
// career's going, and the title card) and Saul's office (his card, and the
// upgrades, bought with what's been cooked). Both read and write the career
// Metherria keeps.

export function Home() {
  const c = readCareer();
  const rank = rankFor(c.points);
  const best = local.get('tp-hector-best', null);
  const stats = [
    ['Day', c.day],
    ['In the bag', `$${c.money}`],
    ['Title', rank.title],
    ['Orders served', c.served],
    ['Best order', c.bestOrder ? `${c.bestOrder}%` : '–'],
    ['Face Off best', best ?? '–'],
  ];
  return (
    <div className="grid gap-8">
      <dl className="abq-stats">
        {stats.map(([k, v]) => (
          <div key={k}>
            <dt>{k}</dt>
            <dd>{v}</dd>
          </div>
        ))}
      </dl>
      <TitleCard id="abq-name-home" />
    </div>
  );
}

export function Saul() {
  const [career, setCareer] = useState(readCareer);
  const [call, setCall] = useState(false);
  const [said, setSaid] = useState('');
  useEffect(() => stopVoiced, []);
  const purchase = (u) => {
    audioContext();
    const c = buy(career, u.id);
    if (c === career) return;
    local.set(CAREER, c);
    setCareer(c);
    import('../../../lib/sfx').then((s) => s.coin());
    if (u.id === 'billboard') import('../../../lib/clips').then((m) => m.playClip('callSaul', { when: 0.25 }));
    setSaid(u.id === 'superlab' ? SAUL.superlab : SAUL.bought(u.name));
    if (u.id === 'superlab') sayVoiced('saul', SAUL.superlab); // in his own voice, where it's been made (lib/voiced.js)
  };
  return (
    <div className="grid items-start gap-10 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
      <div>
        <div className="saul-card">
          <p className="saul-big">Better Call Saul!</p>
          <p className="saul-name">Saul Goodman · Attorney at Law</p>
          <p className="saul-small">Injuries · Criminal defense · Whatever you need</p>
        </div>
        <button type="button" className="btn btn-ghost mt-6" onClick={() => setCall((v) => !v)} aria-pressed={call}>
          {call ? 'Hang up' : 'Call Saul'}
        </button>
        {call && (
          <div className="mt-5 max-w-sm">
            <Gif name="bcsBestDecision" size="medium" eager />
          </div>
        )}
      </div>
      <div>
        <p className="lead max-w-[46ch]">“You’ve got cash, I’ve got solutions.” Spend what you’ve cooked: every one of these carries into the next shift.</p>
        <p className="abq-cash mt-4">
          In the bag: <b>${career.money}</b>
        </p>
        <ul className="abq-shop mt-5">
          {UPGRADES.map((u) => {
            const owned = career.upgrades.includes(u.id);
            return (
              <li key={u.id} data-owned={owned || undefined}>
                <div>
                  <p className="abq-shop-name">{u.name}</p>
                  <p className="abq-shop-text">{u.text}</p>
                </div>
                <button type="button" className={`btn ${owned ? 'btn-ghost' : 'btn-primary'}`} disabled={owned || career.money < u.cost} onClick={() => purchase(u)}>
                  {owned ? 'Yours' : `$${u.cost}`}
                </button>
              </li>
            );
          })}
        </ul>
        <p className="mt-4 min-h-[1.5em] text-sm text-body" role="status">
          {said}
        </p>
      </div>
    </div>
  );
}
