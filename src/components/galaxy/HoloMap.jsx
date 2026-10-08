import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import { RiCloseLine, RiRocket2Fill, RiArrowGoBackLine } from 'react-icons/ri';
import { systemLabel } from './warText';
import WarCard, { SystemWar } from './WarCard';
import WarLegend from './WarLegend';
import WarStrip from './WarStrip';
import { Fleets, Territory, WarLines } from './WarLayers';
import { SIDES, WARS } from './sides';
import { NAME_LEFT, badgeOf, opsOf } from './warMap';
import { mine, onWar, warNow } from './warState';
import './warmap.css';
import { CORE, ERAS, FILMS, FILM_ORDER, GRID, LANES, REGIONS, RIM, SYSTEMS, UNKNOWN, edgeAt, eraById, eraOf, erasOf, filmLabel, filmShort, gridAt, jumpSeconds, lightYears, systemById, yearLabel } from './systems';

// The galaxy map, the way a holotable shows it: the galaxy's disc (its
// spiral arms, the glow of the Deep Core), the regions in rings out from the
// middle (they reach further to the south), the Unknown Regions off to the
// west, the atlas's grid (A to U across, 1 to 21 down), the great hyperspace
// routes, and every system you can jump to, in its own colour. Pick one and
// it shows where it is, its era and its films, how far it is and how long
// the jump takes, and who's flying there now (online); Jump sends you. The
// eras and the films filter what's lit (the rest dim), so it doubles as a
// timeline: the prequels' worlds, the originals', the New Republic's (The
// Mandalorian's and Ahsoka's).
//
// And the galaxy's wars' table, Helldivers' galactic map (gcw.js, as the page
// knows it: warState.js), one war at a time (a switch over the map, for
// looking: the war you fight in is your oath's): each power's territory
// round the systems it holds, hatched where it's fought over, the borders
// where powers meet and the lanes the war runs along, each offensive an
// arrow with its fleet closing in (WarLayers.jsx), each system ringed in its
// holder's colour with the attacker's share of the ring growing (+ a front,
// − an attack, a dashed ring cut off from supply), its battle on now marked,
// the major order starred, and a dot where you fought; who holds what over the map's empty north (WarStrip.jsx)
// and a key (WarLegend.jsx); the war's own card when nothing's picked
// (WarCard.jsx: its phase, orders, news, battles and the nearest to join),
// and the war's part of a system's card.
//
// Drawn once into a canvas (the stars of the disc), with an SVG over it for
// the lines and the names, and buttons over that for the systems (so the
// keyboard and screen readers have them: Tab through, Enter to pick, Enter
// again to jump). It renders into <body>, over the nav (the page's <main>
// is its own stacking context).
//
// What's new in the war since you last looked is marked on its card: the
// newest event's time each war, kept in this browser (SEEN_KEY) for you
// alone, read when the map opens.

const SIZE = 21; // the map is GRID squares across, in its own units
const TAU = Math.PI * 2;
const SEEN_KEY = 'tp-gcw-seen';
const readSeen = () => {
  try {
    const v = JSON.parse(window.localStorage.getItem(SEEN_KEY) ?? 'null');
    return v && typeof v === 'object' && !Array.isArray(v) ? v : {};
  } catch {
    return {};
  }
};

// the disc's stars: two arms wound out from the core, a bulge, dust
function paintGalaxy(canvas) {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;
  canvas.width = Math.round(w * dpr);
  canvas.height = Math.round(h * dpr);
  const g = canvas.getContext('2d');
  if (!g) return;
  g.scale(dpr, dpr);
  const k = Math.min(w, h) / SIZE;
  const ox = (w - SIZE * k) / 2;
  const oy = (h - SIZE * k) / 2;
  const X = (x) => ox + x * k;
  const Y = (z) => oy + z * k;
  g.fillStyle = '#020611';
  g.fillRect(0, 0, w, h);
  // the glow of the disc and its core
  const disc = g.createRadialGradient(X(CORE[0]), Y(CORE[1]), 0, X(CORE[0]), Y(CORE[1]), RIM * k);
  disc.addColorStop(0, 'rgba(255,226,170,0.55)');
  disc.addColorStop(0.08, 'rgba(255,205,150,0.28)');
  disc.addColorStop(0.3, 'rgba(120,160,255,0.12)');
  disc.addColorStop(0.75, 'rgba(70,110,220,0.05)');
  disc.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = disc;
  g.fillRect(0, 0, w, h);
  // the arms: stars along two log spirals, scattered
  let s = 12345;
  const rand = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  g.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 5200; i++) {
    const arm = i % 2;
    const t = rand() ** 0.7;
    const r = 0.4 + t * RIM;
    const a = arm * Math.PI + Math.log(r + 0.6) * 2.6 + (rand() - 0.5) * (0.9 - t * 0.4) + 0.6;
    const spread = (rand() - 0.5) * (0.6 + t * 1.3);
    const x = CORE[0] + Math.cos(a) * r + Math.cos(a + Math.PI / 2) * spread;
    const z = CORE[1] + Math.sin(a) * r + Math.sin(a + Math.PI / 2) * spread;
    const b = 0.25 + rand() * 0.6;
    const warm = t < 0.25 ? 1 : 0.3;
    g.fillStyle = `rgba(${Math.round(170 + 85 * warm)},${Math.round(190 + 40 * warm)},255,${(b * (1 - t * 0.55)).toFixed(3)})`;
    const rr = rand() < 0.04 ? 1.3 : 0.6;
    g.fillRect(X(x), Y(z), rr, rr);
  }
  // and a scatter everywhere, thinner further out
  for (let i = 0; i < 1600; i++) {
    const r = Math.sqrt(rand()) * RIM * 1.05;
    const a = rand() * TAU;
    g.fillStyle = `rgba(200,215,255,${(0.15 + rand() * 0.35).toFixed(3)})`;
    g.fillRect(X(CORE[0] + Math.cos(a) * r), Y(CORE[1] + Math.sin(a) * r), 0.7, 0.7);
  }
  g.globalCompositeOperation = 'source-over';
}

// a region's edge, as an SVG path
const ring = (r) =>
  Array.from({ length: 73 }, (_, i) => {
    const a = (i / 72) * TAU;
    const d = edgeAt(r, a);
    return `${i ? 'L' : 'M'}${(CORE[0] + Math.cos(a) * d).toFixed(3)} ${(CORE[1] + Math.sin(a) * d).toFixed(3)}`;
  }).join(' ') + 'Z';

// the Unknown Regions' wedge, out west
const unknown = (() => {
  const pts = [];
  for (let i = 0; i <= 12; i++) {
    const a = Math.PI - UNKNOWN.half + (i / 12) * UNKNOWN.half * 2;
    const d = edgeAt(UNKNOWN.from, a);
    pts.push([CORE[0] + Math.cos(a) * d, CORE[1] + Math.sin(a) * d]);
  }
  for (let i = 12; i >= 0; i--) {
    const a = Math.PI - UNKNOWN.half + (i / 12) * UNKNOWN.half * 2;
    pts.push([CORE[0] + Math.cos(a) * 14, CORE[1] + Math.sin(a) * 14]);
  }
  return pts.map(([x, z], i) => `${i ? 'L' : 'M'}${x.toFixed(3)} ${z.toFixed(3)}`).join(' ') + 'Z';
})();

export default function HoloMap({ current, online, onJump, onClose, onLeave, oath = { war: 'gcw', side: null, sworn: 0, turncoat: false }, oaths = {}, suggested = null, onSwear, onTheatre }) {
  const here = systemById(current);
  const [pick, setPick] = useState(null);
  const [era, setEra] = useState('all');
  const [film, setFilm] = useState(null);
  const canvas = useRef(null);
  const box = useRef(null);
  const close = useRef(null);
  const picked = pick ? systemById(pick) : null;
  // the war the map shows (yours till you look at another), as it stands this
  // second (and when what the players did changes)
  const [view, setView] = useState(oath.war);
  useEffect(() => setView(oath.war), [oath.war]);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    const off = onWar(() => setNow(Date.now()));
    return () => (clearInterval(id), off());
  }, []);
  const war = useMemo(() => {
    const table = warNow(now, view);
    return { ...table, byId: Object.fromEntries(table.systems.map((r) => [r.id, r])) };
  }, [now, view]);
  const ops = useMemo(() => opsOf(war), [war]);
  // (where each system's + or − goes on its ring, clear of its neighbours and the arrows' ends)
  const badges = useMemo(() => Object.fromEntries(war.systems.map((r) => [r.id, badgeOf(r.id, ops)])), [war, ops]);
  const record = useMemo(() => mine(view, now), [view, now]);
  const fought = useMemo(() => new Set(record.systems.map((x) => x.id)), [record]);
  const pickedWar = picked ? war.byId[picked.id] : null;
  const w = WARS[view];
  // your oath in the war the map shows (the page's oath is for the war you fight in)
  const viewOath = view === oath.war ? oath : { war: view, side: oaths[view]?.side ?? null, sworn: oaths[view]?.sworn ?? 0, turncoat: oaths[view]?.turncoat ?? false };
  // what you'd seen of each war when the map opened; what's on it now is seen as of now
  const [seen] = useState(readSeen);
  const newest = war.events?.at(-1)?.at ?? null;
  useEffect(() => {
    if (newest === null) return;
    try {
      const v = readSeen();
      if (!(v[view] >= newest)) window.localStorage.setItem(SEEN_KEY, JSON.stringify({ ...v, [view]: newest }));
    } catch {
      // (private browsing: nothing's marked new next time, that's all)
    }
  }, [view, newest]);

  useEffect(() => {
    const c = canvas.current;
    if (!c) return undefined;
    const draw = () => paintGalaxy(c);
    draw();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(draw) : null;
    ro?.observe(c);
    return () => ro?.disconnect();
  }, []);
  useEffect(() => {
    close.current?.focus();
  }, []);

  // who's flying where (online)
  const pilots = useMemo(() => {
    const out = {};
    for (const p of online?.room?.peers ?? []) {
      const m = /^\/galaxy\/([a-z0-9-]+)/.exec(p.where ?? '');
      if (m && !p.blocked) out[m[1]] = (out[m[1]] ?? 0) + 1;
    }
    return out;
  }, [online?.room]);

  const lit = (s) => (film ? s.films.includes(film) : era === 'all' || erasOf(s).includes(era));
  // pick a system to plot a course to it, then again to jump; the one you're
  // at shows its own card (no course to plot), and again the war's
  const choose = (id) => {
    if (pick !== id) setPick(id);
    else if (id === current) setPick(null);
    else onJump(id);
  };
  const away = picked && picked.id !== current;
  const pct = (v) => `${(v / SIZE) * 100}%`;

  return createPortal(
    <div className="holomap dark-scope" role="dialog" aria-modal="true" aria-labelledby="holomap-title" style={{ '--btn-bg': picked?.accent ?? '#7fd6ff', '--btn-ink': '#03040a', '--accent': picked?.accent ?? '#7fd6ff', '--accent-text': picked?.accent ?? '#7fd6ff' }}>
      <div className="holomap-frame">
        <header className="holomap-head">
          <div>
            <p className="holomap-kicker">Navicomputer · Galactic Standard</p>
            <h2 id="holomap-title" className="holomap-title">
              Plot a course
            </h2>
          </div>
          <button ref={close} type="button" className="holomap-close" onClick={onClose} aria-label="Close the galaxy map">
            <RiCloseLine className="h-5 w-5" aria-hidden="true" />
          </button>
        </header>

        <div className="holomap-eras" role="group" aria-label="Era">
          <button type="button" aria-pressed={era === 'all' && !film} onClick={() => (setEra('all'), setFilm(null))}>
            Every era
          </button>
          {ERAS.map((e) => (
            <button key={e.id} type="button" aria-pressed={era === e.id && !film} style={{ '--era': e.color }} onClick={() => (setEra(e.id), setFilm(null))} title={e.about}>
              {e.name} <span>{e.span}</span>
            </button>
          ))}
        </div>
        <div className="holomap-films" role="group" aria-label="Film">
          {FILM_ORDER.map((id) => (
            <button key={id} type="button" aria-pressed={film === id} style={{ '--era': eraById(FILMS[id].era).color }} onClick={() => setFilm(film === id ? null : id)} title={`${filmLabel(id)} · ${yearLabel(FILMS[id].year)}`}>
              {filmShort(id)}
            </button>
          ))}
        </div>

        <div className="holomap-body">
          <div ref={box} className="holomap-map">
            <canvas ref={canvas} className="holomap-canvas" aria-hidden="true" />
            <svg className="holomap-svg" viewBox={`0 0 ${SIZE} ${SIZE}`} aria-hidden="true">
              {/* the grid */}
              {Array.from({ length: GRID.cols + 1 }, (_, i) => (
                <line key={`c${i}`} x1={i} y1={0} x2={i} y2={SIZE} className="holomap-grid" />
              ))}
              {Array.from({ length: GRID.rows + 1 }, (_, i) => (
                <line key={`r${i}`} x1={0} y1={i} x2={SIZE} y2={i} className="holomap-grid" />
              ))}
              {/* the war's territory */}
              <Territory table={war} />
              {/* the regions */}
              <path d={unknown} className="holomap-unknown" />
              {REGIONS.map((r) => (
                <path key={r.id} d={ring(r.r)} className="holomap-region" data-id={r.id} />
              ))}
              {REGIONS.slice(1).map((r) => (
                <text key={r.id} x={CORE[0]} y={CORE[1] - edgeAt(r.r, -Math.PI / 2) + 0.28} className="holomap-region-name">
                  {r.name}
                </text>
              ))}
              <text x={CORE[0] - 9.3} y={CORE[1] + 0.1} className="holomap-region-name holomap-unknown-name">
                Unknown Regions
              </text>
              {/* the routes */}
              {LANES.map((l) => (
                <polyline key={l.id} points={l.pts.map((p) => p.join(',')).join(' ')} className="holomap-lane">
                  <title>{l.name}</title>
                </polyline>
              ))}
              {/* the war's lanes, borders and offensives */}
              <WarLines table={war} ops={ops} />
              {/* the course */}
              {away && <line x1={here.pos[0]} y1={here.pos[1]} x2={picked.pos[0]} y2={picked.pos[1]} className="holomap-course" />}
            </svg>
            <Fleets ops={ops} />
            {/* the grid's letters and numbers */}
            <div className="holomap-axis holomap-axis-x" aria-hidden="true">
              {Array.from({ length: GRID.cols }, (_, i) => (
                <span key={i} style={{ left: pct(i + 0.5) }}>
                  {String.fromCharCode(65 + i)}
                </span>
              ))}
            </div>
            <div className="holomap-axis holomap-axis-y" aria-hidden="true">
              {Array.from({ length: GRID.rows }, (_, i) => (
                <span key={i} style={{ top: pct(i + 0.5) }}>
                  {i + 1}
                </span>
              ))}
            </div>
            {/* the war at a glance, and its key */}
            <WarStrip table={war} view={view} onView={setView} fighting={oath.war} />
            <WarLegend war={view} />
            {/* the systems */}
            <ul className="holomap-systems" aria-label="Star systems">
              {SYSTEMS.map((s) => {
                const row = war.byId[s.id];
                // (fought over: a front still to liberate, or an attack; the ring's the attacker's share and the holder's)
                const by = row?.attack ? row.attack.by : row?.front && row.owner !== w.liberator ? w.liberator : null;
                const ring = row ? { '--held': SIDES[row.owner].colour, ...(by && { '--by': SIDES[by].colour, '--take': 1 - row.control }) } : {};
                const you = row && fought.has(s.id);
                return (
                <li key={s.id} style={{ left: pct(s.pos[0]), top: pct(s.pos[1]), '--c': s.accent, ...ring }} data-dim={!lit(s) || undefined} data-side={NAME_LEFT.has(s.id) ? 'left' : undefined} data-badge={row ? badges[s.id] : undefined} data-held={row?.owner} data-front={(by && !row.attack) || undefined} data-attack={row?.attack ? '' : undefined} data-major={row?.major || undefined} data-decisive={row?.decisive || undefined} data-cut={row?.cut || undefined} data-fought={you || undefined}>
                  <button type="button" className="holomap-system" aria-pressed={pick === s.id} aria-current={s.id === current ? 'location' : undefined} onClick={() => choose(s.id)} onDoubleClick={() => s.id !== current && onJump(s.id)} aria-label={row ? systemLabel(row, now, you) : undefined}>
                    <span className="holomap-dot" aria-hidden="true">
                      {you && <i className="holomap-you" />}
                    </span>
                    <span className="holomap-name">
                      {s.name}
                      {row?.major && <b className="holomap-star" aria-hidden="true">★</b>}
                      {row?.battle?.fighting && <b className="holomap-fight" aria-hidden="true">⚔</b>}
                    </span>
                    {pilots[s.id] > 0 && (
                      <span className="holomap-pilots" title={`${pilots[s.id]} online`}>
                        {pilots[s.id]}
                      </span>
                    )}
                  </button>
                </li>
                );
              })}
            </ul>
          </div>

          <aside className="holomap-side">
            {picked ? (
              <>
                <div aria-live="polite">
                  <p className="holomap-kicker">{away ? 'Course plotted' : 'You are here'}</p>
                  <h3 className="holomap-sys" style={{ color: picked.accent }}>
                    {picked.name}
                  </h3>
                </div>
                <p className="holomap-meta">
                  {picked.region} · Grid {picked.grid ?? gridAt(picked.pos)}
                </p>
                <p className="holomap-meta">
                  {eraById(eraOf(picked)).name} · {picked.films.map((f) => FILMS[f].episode ?? FILMS[f].title).join(', ')}
                </p>
                <dl className="holomap-stats">
                  {away && (
                    <>
                      <div>
                        <dt>Distance</dt>
                        <dd>{lightYears(here, picked).toLocaleString('en-US')} light-years</dd>
                      </div>
                      <div>
                        <dt>In hyperspace</dt>
                        <dd>{jumpSeconds(here, picked).toFixed(1)} s (the navicomputer’s fast)</dd>
                      </div>
                    </>
                  )}
                  <div>
                    <dt>There now</dt>
                    <dd>{picked.moment.title}</dd>
                  </div>
                  <div>
                    <dt>Mission</dt>
                    <dd>
                      {picked.game.title} {picked.game.status === 'live' ? '(play now)' : '(coming soon)'}
                    </dd>
                  </div>
                  <SystemWar row={pickedWar} war={view} now={now} side={viewOath.side} yours={view === oath.war} />
                  {pilots[picked.id] > 0 && (
                    <div>
                      <dt>Online</dt>
                      <dd>
                        {pilots[picked.id]} {pilots[picked.id] === 1 ? 'pilot' : 'pilots'} there now
                      </dd>
                    </div>
                  )}
                </dl>
                {away ? (
                  <button type="button" className="btn btn-primary holomap-jump" onClick={() => onJump(picked.id)}>
                    <RiRocket2Fill className="h-4 w-4" aria-hidden="true" /> Jump to lightspeed
                  </button>
                ) : (
                  <button type="button" className="btn btn-primary holomap-jump" onClick={() => setPick(null)}>
                    Back to the war
                  </button>
                )}
                <Link to={`/galaxy/${picked.id}/mission`} className="btn btn-ghost mt-2 w-full justify-center">
                  Read its mission briefing
                </Link>
              </>
            ) : (
              <>
                <p className="holomap-kicker">You are here</p>
                <h3 className="holomap-sys" style={{ color: here.accent }}>
                  {here.name}
                </h3>
                <p className="holomap-meta">
                  {here.region} · Grid {here.grid ?? gridAt(here.pos)}
                </p>
                {/* the war's own card: the oath, the major order, the battles on now, the areas */}
                <WarCard table={war} now={now} oath={oath} viewOath={viewOath} suggested={suggested} record={record} seen={seen[view] ?? null} onSwear={onSwear} onTheatre={onTheatre} onPick={setPick} onGo={(id) => (id === current ? onClose() : onJump(id))} current={current} />
                <p className="mt-3 text-sm leading-relaxed text-body">Pick a system to plot a course, then jump. Or skip the map: every system’s star is out there in the sky, so point your nose at one and press J. Filter by era or film to see the galaxy as it was then.</p>
                <p className="mt-3 text-xs leading-relaxed text-muted">The grid squares and regions are the films’ own atlas, where it gives them; the Unknown Regions are, well, unknown.</p>
              </>
            )}
            <button type="button" className="universe-back mt-5" onClick={onLeave}>
              <RiArrowGoBackLine className="mr-1 inline h-4 w-4" aria-hidden="true" /> Leave the galaxy, back to the universe
            </button>
          </aside>
        </div>
      </div>
    </div>,
    document.body,
  );
}
