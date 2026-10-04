import { useCallback, useEffect, useRef, useState } from 'react';
import { useAchievements } from '../Achievements';
import { audioContext } from '../../lib/audio';
import { local, useFrameLoop, useInView, useReducedMotion } from '../../lib/hooks';
import {
  CUSTOMERS,
  LAB,
  UPGRADES,
  bagScore,
  breakScore,
  buy,
  cookScore,
  grade,
  mixScore,
  newCareer,
  newDay,
  payFor,
  pointsFor,
  rankFor,
  waitScore,
} from './lab';
import Face from './lab/Face';
import { BagStation, BreakStation, CookStation, MixStation } from './lab/Stations';
import { buzz, useKeys } from './lab/keys';

// The superlab, cooked to order. Customers come to the door through the shift
// with an order each: take it, then mix, cook, break and bag it, and serve.
// Every station is scored against the ticket, the wait counts too, and the
// pay buys upgrades between shifts. Your career (day, cash, title, upgrades)
// is kept between visits.

const sfx = () => import('../../lib/sfx');
const STORE = 'tp-lab';
const STAGES = [
  ['mix', 'Mix'],
  ['cook', 'Cook'],
  ['break', 'Break'],
  ['bag', 'Bag'],
];
const SCORE_NAMES = { mix: 'Mix', cook: 'Cook', break: 'Break', bag: 'Bag', wait: 'Wait' };
const RAID_FROM = 3; // Hank starts dropping by on day three
const RAID_SECONDS = 3.2;

const moodFor = (waited, id, upgrades) => {
  const w = waitScore(waited, id, upgrades);
  return w >= 100 ? 'wait' : w > 70 ? 'restless' : 'bad';
};
const describe = (o) => [`${o.trays} ${o.trays === 1 ? 'tray' : 'trays'}`, LAB.tints[o.tint].label, `${o.purity}%+`, o.chili ? 'Chili P' : 'No Chili P', LAB.cuts[o.cut].label, LAB.packs[o.pack].label];

function Ticket({ entry, big = false }) {
  const o = entry.order;
  return (
    <div className="lab-ticket" data-big={big || undefined}>
      <p className="lab-ticket-head">
        <span>{CUSTOMERS[o.customer].name}</span>
        <span>#{entry.id.split('-')[1] * 1 + 1}</span>
      </p>
      <ul>
        {describe(o).map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
      <span className="lab-ticket-swatch" style={{ background: LAB.tints[o.tint].color }} aria-hidden="true" />
    </div>
  );
}

export default function Lab() {
  const { unlock } = useAchievements();
  const reduced = useReducedMotion();
  const [viewRef, inView] = useInView({ rootMargin: '0px' });
  const [career, setCareer] = useState(() => newCareer(local.get(STORE, null)));
  const [phase, setPhase] = useState('intro'); // intro | shift | summary
  const [view, setView] = useState('counter'); // counter | ticket | station | result
  const [shop, setShop] = useState(false);
  const shift = useRef(null);
  const [, setTick] = useState(0);
  const refresh = useCallback(() => setTick((n) => n + 1), []);
  const [activeId, setActiveId] = useState(null);
  const [result, setResult] = useState(null);
  const [raid, setRaid] = useState(null); // { left, ticket } while Hank is at the door
  const [rankUp, setRankUp] = useState(null);
  const [shake, setShake] = useState(0);
  const box = useRef(null);

  // a little shake on a near-perfect station, without remounting anything
  useEffect(() => {
    if (!shake || reduced) return;
    box.current?.animate?.(
      [{ transform: 'translate(0,0)' }, { transform: 'translate(-3px,1px)' }, { transform: 'translate(3px,-1px)' }, { transform: 'translate(-2px,0)' }, { transform: 'translate(0,0)' }],
      { duration: 260, easing: 'ease-out' },
    );
  }, [shake, reduced]);

  const save = (c) => {
    setCareer(c);
    local.set(STORE, c);
  };
  const upgrades = career.upgrades;
  const s = shift.current;
  const active = s?.tickets.find((t) => t.id === activeId) ?? null;
  const running = phase === 'shift' && inView;

  // the shift clock: it only runs while the lab is on screen
  const lastRefresh = useRef(0);
  useFrameLoop((ms) => {
    const sh = shift.current;
    if (!sh || raid) return;
    sh.clock += ms / 1000;
    // nothing to do and someone's due: open the door for them now
    const idle = !sh.lobby.length && !sh.tickets.length && sh.next < sh.day.queue.length;
    if (idle) sh.clock = Math.max(sh.clock, sh.day.queue[sh.next].arrive);
    let changed = false;
    while (sh.next < sh.day.queue.length && sh.day.queue[sh.next].arrive <= sh.clock) {
      sh.lobby.push(sh.day.queue[sh.next]);
      sh.next += 1;
      changed = true;
      sfx().then((x) => x.knock(undefined, undefined, 0.02));
    }
    // Hank, once a shift from day three, mid-cook
    if (sh.raidAt != null && sh.clock >= sh.raidAt && view === 'station' && active) {
      sh.raidAt = null;
      setRaid({ left: RAID_SECONDS, ticket: active.id });
      sfx().then((x) => x.alarm());
      buzz(120);
    }
    if (changed || sh.clock - lastRefresh.current > 0.5) {
      lastRefresh.current = sh.clock;
      refresh();
    }
  }, running);

  // Hank's countdown
  useFrameLoop((ms) => {
    setRaid((r) => (r ? { ...r, left: r.left - ms / 1000 } : r));
  }, running && !!raid && raid.left > 0);
  useEffect(() => {
    if (!raid || raid.left > 0 || raid.done) return;
    // too slow: he finds the batch, and it goes down the drain
    const t = shift.current?.tickets.find((x) => x.id === raid.ticket);
    if (t) {
      t.stage = 'mix';
      t.scores = {};
    }
    setRaid({ ...raid, done: 'caught' });
    sfx().then((x) => x.buzz());
  }, [raid]);
  const hide = () => {
    if (!raid || raid.done) return;
    setRaid({ ...raid, done: 'hidden' });
    sfx().then((x) => x.zip());
    buzz(30);
  };

  const startShift = () => {
    audioContext(); // in the click, so the lab can be heard
    const day = newDay(career);
    const raidAt = career.day >= RAID_FROM && Math.random() < 0.7 ? 25 + Math.random() * 40 : null;
    shift.current = { day, clock: 0, next: 0, lobby: [], tickets: [], served: [], earned: 0, raidAt };
    setActiveId(null);
    setResult(null);
    setRaid(null);
    setShop(false);
    setView('counter');
    setPhase('shift');
    box.current?.focus({ preventScroll: true });
  };

  const take = (entry) => {
    const sh = shift.current;
    if (!sh) return;
    audioContext();
    sh.lobby = sh.lobby.filter((e) => e.id !== entry.id);
    const ticket = { ...entry, takenAt: sh.clock, stage: 'mix', scores: {} };
    sh.tickets.push(ticket);
    setActiveId(ticket.id);
    setView('ticket');
    sfx().then((x) => x.ding());
    refresh();
  };

  const advance = (ticket, key, score, next) => {
    ticket.scores[key] = score;
    ticket.stage = next;
    refresh();
    if (score >= 95) setShake((n) => n + 1);
  };

  const serve = (ticket, weights) => {
    const sh = shift.current;
    ticket.scores.bag = bagScore(ticket.order, weights, upgrades);
    ticket.scores.wait = waitScore(sh.clock - ticket.arrive, ticket.order.customer, upgrades);
    const { total, mood } = grade(ticket.scores);
    const pay = payFor(ticket.order, total, upgrades);
    sh.tickets = sh.tickets.filter((t) => t.id !== ticket.id);
    const done = { ...ticket, total, mood, pay };
    sh.served.push(done);
    sh.earned += pay;
    const before = rankFor(career.points);
    const c = { ...career, money: career.money + pay, points: career.points + pointsFor(total), served: career.served + 1, bestOrder: Math.max(career.bestOrder, total) };
    const after = rankFor(c.points);
    save(c);
    if (after.index > before.index) {
      setRankUp(after.title);
      sfx().then((x) => x.victory());
      if (after.title === 'Heisenberg') import('../../lib/clips').then((cl) => cl.playClip('sayMyName'));
    }
    if (total >= 95) unlock('bluesky');
    sfx().then((x) => (mood === 'great' ? x.applause() : mood === 'bad' ? x.buzz() : x.coin()));
    buzz(mood === 'great' ? 40 : 20);
    setResult(done);
    setActiveId(sh.tickets[0]?.id ?? null);
    setView('result');
    refresh();
  };

  const shiftOver = () => {
    const sh = shift.current;
    return sh && sh.next >= sh.day.queue.length && !sh.lobby.length && !sh.tickets.length;
  };
  const afterResult = () => {
    setResult(null);
    setRankUp(null);
    if (shiftOver()) {
      const sh = shift.current;
      save({ ...career, bestDay: Math.max(career.bestDay, sh.earned) });
      setPhase('summary');
      return;
    }
    setView(shift.current?.tickets.length && !shift.current.lobby.length ? 'station' : 'counter');
  };
  const nextDay = () => {
    save({ ...career, day: career.day + 1 });
    setPhase('intro');
    setShop(false);
  };
  const purchase = (id) => {
    const c = buy(career, id);
    if (c !== career) {
      save(c);
      sfx().then((x) => x.coin());
    }
  };
  const pickTicket = (id) => {
    setActiveId(id);
    setView('station');
  };

  // Enter moves things along at the counter, the ticket and the result
  useKeys(running && view !== 'station' && !raid, (k) => {
    if (k !== 'Enter') return false;
    const sh = shift.current;
    if (view === 'counter' && sh?.lobby.length) take(sh.lobby[0]);
    else if (view === 'counter' && sh?.tickets.length) pickTicket(sh.tickets[0].id);
    else if (view === 'ticket') setView('station');
    else if (view === 'result') afterResult();
    return true;
  });
  useKeys(running && !!raid && !raid.done, (k) => {
    if (k === 'h' || k === 'H' || k === 'Enter') {
      hide();
      return true;
    }
    return false;
  });

  const rank = rankFor(career.points);
  const toNext = rank.next == null ? 1 : (career.points - rank.from) / (rank.next - rank.from);
  const superlab = upgrades.includes('superlab');

  const station = () => {
    if (!active) return <p className="lab-empty">Pick a ticket from the rail, or take an order at the counter.</p>;
    const key = `${active.id}-${active.stage}`;
    const props = { order: active.order, upgrades, active: running && !raid };
    if (active.stage === 'mix') return <MixStation key={key} {...props} onDone={(m) => advance(active, 'mix', mixScore(active.order, m, upgrades), 'cook')} />;
    if (active.stage === 'cook') return <CookStation key={key} {...props} onDone={(purity) => advance(active, 'cook', cookScore(active.order, purity), 'break')} />;
    if (active.stage === 'break') return <BreakStation key={key} {...props} onDone={({ hits, cracks, wild }) => advance(active, 'break', breakScore(hits, cracks, wild), 'bag')} />;
    return <BagStation key={key} {...props} onDone={(w) => serve(active, w)} />;
  };

  return (
    <div ref={viewRef}>
      <div ref={box} className="lab" data-place={superlab ? 'superlab' : 'rv'} tabIndex={-1}>
        <header className="lab-bar">
          <span className="lab-day">Day {career.day}</span>
          <span className="lab-cash">${career.money}</span>
          <span className="lab-rank" title={rank.next == null ? 'The top' : `${rank.next - career.points} points to the next title`}>
            {rank.title}
            <span className="lab-rank-bar" aria-hidden="true">
              <span style={{ transform: `scaleX(${Math.min(1, toNext)})` }} />
            </span>
          </span>
          <span className="lab-place">{superlab ? 'The superlab' : 'The RV'}</span>
        </header>

        {phase === 'intro' && !shop && (
          <div className="lab-card">
            <p className="lab-card-title">{career.served ? `Day ${career.day}. Back to work.` : 'Cook to order.'}</p>
            <p className="lab-card-text">
              Customers come to the door all shift. Take each order, then mix, cook, break and bag it the way the ticket says, and serve. Every station is scored, and so is how long they waited. Good work pays; pay buys upgrades.
            </p>
            <div className="lab-faces" aria-label="Who might come by today">
              {Object.keys(CUSTOMERS)
                .filter((id) => CUSTOMERS[id].from <= career.day)
                .map((id) => (
                  <span key={id} className="lab-face-chip">
                    <Face who={id} mood={CUSTOMERS[id].from === career.day && career.day > 1 ? 'great' : 'wait'} />
                    {CUSTOMERS[id].name}
                    {CUSTOMERS[id].from === career.day && career.day > 1 && <b>New</b>}
                  </span>
                ))}
            </div>
            <div className="lab-controls">
              <button type="button" className="btn btn-primary" onClick={startShift}>
                Open for the day
              </button>
              <button type="button" className="btn btn-ghost" onClick={() => setShop(true)}>
                Upgrades
              </button>
            </div>
            {career.bestOrder > 0 && (
              <p className="lab-small-print">
                Served {career.served}. Best order {career.bestOrder}%. Best day ${career.bestDay}.
              </p>
            )}
          </div>
        )}

        {shop && (
          <div className="lab-card">
            <p className="lab-card-title">Upgrades</p>
            <ul className="lab-shop">
              {UPGRADES.map((u) => {
                const owned = upgrades.includes(u.id);
                return (
                  <li key={u.id} data-owned={owned || undefined}>
                    <div>
                      <p className="lab-shop-name">{u.name}</p>
                      <p className="lab-shop-text">{u.text}</p>
                    </div>
                    <button type="button" className="btn btn-ghost btn-sm" disabled={owned || career.money < u.cost} onClick={() => purchase(u.id)}>
                      {owned ? 'Yours' : `$${u.cost}`}
                    </button>
                  </li>
                );
              })}
            </ul>
            <div className="lab-controls">
              <button type="button" className="btn btn-primary" onClick={() => (phase === 'summary' ? nextDay() : setShop(false))}>
                {phase === 'summary' ? `Open for day ${career.day + 1}` : 'Back'}
              </button>
            </div>
          </div>
        )}

        {phase === 'shift' && s && (
          <>
            <div className="lab-rail" role="group" aria-label="Orders on the rail">
              <button type="button" className="lab-rail-counter" data-on={view === 'counter' || undefined} onClick={() => setView('counter')}>
                Counter
                {s.lobby.length > 0 && <b>{s.lobby.length}</b>}
              </button>
              {s.tickets.map((t) => (
                <button key={t.id} type="button" className="lab-rail-ticket" data-on={(view !== 'counter' && t.id === activeId) || undefined} onClick={() => pickTicket(t.id)}>
                  <Face who={t.order.customer} mood={moodFor(s.clock - t.arrive, t.order.customer, upgrades)} />
                  <span>
                    {CUSTOMERS[t.order.customer].name}
                    <small>{STAGES.find(([k]) => k === t.stage)?.[1]}</small>
                  </span>
                </button>
              ))}
              <span className="lab-rail-left">
                {s.day.queue.length - s.served.length} left today
              </span>
            </div>

            <div className="lab-body">
              {view === 'counter' && (
                <div className="lab-counter">
                  {s.lobby.length ? (
                    <ul className="lab-lobby">
                      {s.lobby.map((e, i) => (
                        <li key={e.id}>
                          <Face who={e.customer} mood={moodFor(s.clock - e.arrive, e.customer, upgrades)} className="lab-face-big" />
                          <p className="lab-lobby-name">{CUSTOMERS[e.customer].name}</p>
                          <button type="button" className="btn btn-primary btn-sm" onClick={() => take(e)}>
                            Take the order{i === 0 ? ' ⏎' : ''}
                          </button>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="lab-empty">{s.tickets.length ? 'Nobody at the door. Back to the orders on the rail.' : 'Waiting on the next knock.'}</p>
                  )}
                  {s.tickets.length > 0 && (
                    <div className="lab-controls">
                      <button type="button" className="btn btn-ghost" onClick={() => pickTicket(activeId ?? s.tickets[0].id)}>
                        Back to the cook
                      </button>
                    </div>
                  )}
                </div>
              )}

              {view === 'ticket' && active && (
                <div className="lab-take">
                  <Face who={active.order.customer} mood="good" className="lab-face-big" />
                  <Ticket entry={active} big />
                  <div className="lab-controls">
                    <button type="button" className="btn btn-primary" onClick={() => setView('station')}>
                      Get cooking ⏎
                    </button>
                    {s.lobby.length > 0 && (
                      <button type="button" className="btn btn-ghost" onClick={() => setView('counter')}>
                        Take another order first
                      </button>
                    )}
                  </div>
                </div>
              )}

              {view === 'station' && (
                <div className="lab-work">
                  {active && (
                    <ol className="lab-steps" aria-label="Where this order is">
                      {STAGES.map(([k, label]) => (
                        <li key={k} data-now={active.stage === k || undefined} data-done={active.scores[k] != null || undefined}>
                          {label}
                          {active.scores[k] != null && <small>{active.scores[k]}</small>}
                        </li>
                      ))}
                    </ol>
                  )}
                  <div className="lab-work-main">
                    {active && <Ticket entry={active} />}
                    {station()}
                  </div>
                </div>
              )}

              {view === 'result' && result && (
                <div className="lab-result" data-mood={result.mood}>
                  <Face who={result.order.customer} mood={result.mood} className="lab-face-big" />
                  <div>
                    <p className="lab-quote">“{CUSTOMERS[result.order.customer].lines[result.mood]}”</p>
                    <p className="lab-who">{CUSTOMERS[result.order.customer].name}</p>
                    <ul className="lab-scores">
                      {Object.keys(SCORE_NAMES).map((k) => (
                        <li key={k}>
                          <span>{SCORE_NAMES[k]}</span>
                          <b>{result.scores[k]}</b>
                        </li>
                      ))}
                    </ul>
                    <p className="lab-total">
                      {result.total}% <span className="lab-pay">+${result.pay}</span>
                    </p>
                    {rankUp && <p className="lab-rankup">You’re {rankUp === 'Heisenberg' ? 'Heisenberg now. Say my name.' : `${rankUp} now.`}</p>}
                    <div className="lab-controls">
                      <button type="button" className="btn btn-primary" onClick={afterResult}>
                        {shiftOver() ? 'Close up for the day ⏎' : 'Next ⏎'}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {raid && (
                <div className="lab-raid" role="alertdialog" aria-label="Hank is here">
                  {!raid.done ? (
                    <>
                      <p className="lab-raid-title">Hank’s in the laundry.</p>
                      <p className="lab-raid-text">“Mind if I take a look around?” Hide the batch.</p>
                      <span className="lab-raid-clock">{Math.max(0, raid.left).toFixed(1)}</span>
                      <button type="button" className="btn btn-primary" onClick={hide} autoFocus>
                        Hide the batch <kbd>H</kbd>
                      </button>
                    </>
                  ) : (
                    <>
                      <p className="lab-raid-title">{raid.done === 'hidden' ? 'He finds a lot of laundry.' : 'You dumped the batch to be safe.'}</p>
                      <p className="lab-raid-text">{raid.done === 'hidden' ? '“Huh. Smells like… soap.” He heads out.' : 'Back to the mix on that order.'}</p>
                      <button type="button" className="btn btn-primary" onClick={() => setRaid(null)} autoFocus>
                        Back to work
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
          </>
        )}

        {phase === 'summary' && !shop && s && (
          <div className="lab-card">
            <p className="lab-card-title">Day {career.day}, done. ${s.earned} today.</p>
            <ul className="lab-day-list">
              {s.served.map((t) => (
                <li key={t.id}>
                  <Face who={t.order.customer} mood={t.mood} />
                  <span>{CUSTOMERS[t.order.customer].name}</span>
                  <span>{t.total}%</span>
                  <span>${t.pay}</span>
                </li>
              ))}
            </ul>
            <p className="lab-card-text">
              {rank.next == null ? `${rank.title}. There is nowhere higher.` : `${rank.title}. ${rank.next - career.points} points to the next title.`}
            </p>
            <div className="lab-controls">
              <button type="button" className="btn btn-primary" onClick={nextDay}>
                Open for day {career.day + 1}
              </button>
              <button type="button" className="btn btn-ghost" onClick={() => setShop(true)}>
                Upgrades
              </button>
            </div>
          </div>
        )}
      </div>
      <p className="mt-3 text-xs text-muted">
        Space holds the pour, the heat and the scale, and strikes the hammer. 1 2 3 pour base, blue and Chili P. Enter moves on.
      </p>
    </div>
  );
}
