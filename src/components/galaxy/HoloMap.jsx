import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { RiCloseLine, RiRocket2Fill, RiArrowGoBackLine } from 'react-icons/ri';
import { CORE, ERAS, FILMS, FILM_ORDER, GRID, LANES, REGIONS, RIM, SYSTEMS, UNKNOWN, edgeAt, eraById, eraOf, erasOf, filmLabel, gridAt, jumpSeconds, lightYears, systemById, yearLabel } from './systems';

// The galaxy map, the way a holotable shows it: the galaxy's disc (its
// spiral arms, the glow of the Deep Core), the regions in rings out from the
// middle (they reach further to the south), the Unknown Regions off to the
// west, the atlas's grid (A to U across, 1 to 21 down), the great hyperspace
// routes, and every system you can jump to, in its own colour. Pick one and
// it shows where it is, its era and its films, how far it is and how long
// the jump takes, and who's flying there now (online); Jump sends you. The
// eras and the films filter what's lit (the rest dim), so it doubles as a
// timeline: the prequels' worlds, the originals', the sequels'.
//
// Drawn once into a canvas (the stars of the disc), with an SVG over it for
// the lines and the names, and buttons over that for the systems (so the
// keyboard and screen readers have them: Tab through, Enter to pick, Enter
// again to jump).

const SIZE = 21; // the map is GRID squares across, in its own units
const TAU = Math.PI * 2;

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

export default function HoloMap({ current, online, onJump, onClose, onLeave }) {
  const here = systemById(current);
  const [pick, setPick] = useState(null);
  const [era, setEra] = useState('all');
  const [film, setFilm] = useState(null);
  const canvas = useRef(null);
  const box = useRef(null);
  const close = useRef(null);
  const picked = pick ? systemById(pick) : null;

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
  const choose = (id) => {
    if (id === current) return setPick(null);
    if (pick === id) onJump(id);
    else setPick(id);
  };
  const pct = (v) => `${(v / SIZE) * 100}%`;

  return (
    <div className="holomap dark-scope" role="dialog" aria-modal="true" aria-labelledby="holomap-title">
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
              {FILMS[id].episode ?? 'R1'}
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
              {/* the course */}
              {picked && <line x1={here.pos[0]} y1={here.pos[1]} x2={picked.pos[0]} y2={picked.pos[1]} className="holomap-course" />}
            </svg>
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
            {/* the systems */}
            <ul className="holomap-systems" aria-label="Star systems">
              {SYSTEMS.map((s) => (
                <li key={s.id} style={{ left: pct(s.pos[0]), top: pct(s.pos[1]), '--c': s.accent }} data-dim={!lit(s) || undefined}>
                  <button type="button" className="holomap-system" aria-pressed={pick === s.id} aria-current={s.id === current ? 'location' : undefined} onClick={() => choose(s.id)} onDoubleClick={() => s.id !== current && onJump(s.id)}>
                    <span className="holomap-dot" aria-hidden="true" />
                    <span className="holomap-name">{s.name}</span>
                    {pilots[s.id] > 0 && (
                      <span className="holomap-pilots" title={`${pilots[s.id]} online`}>
                        {pilots[s.id]}
                      </span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          </div>

          <aside className="holomap-side" aria-live="polite">
            {picked ? (
              <>
                <p className="holomap-kicker">Course plotted</p>
                <h3 className="holomap-sys" style={{ color: picked.accent }}>
                  {picked.name}
                </h3>
                <p className="holomap-meta">
                  {picked.region} · Grid {picked.grid ?? gridAt(picked.pos)}
                </p>
                <p className="holomap-meta">
                  {eraById(eraOf(picked)).name} · {picked.films.map((f) => FILMS[f].episode ?? 'Rogue One').join(', ')}
                </p>
                <dl className="holomap-stats">
                  <div>
                    <dt>Distance</dt>
                    <dd>{lightYears(here, picked).toLocaleString('en-US')} light-years</dd>
                  </div>
                  <div>
                    <dt>In hyperspace</dt>
                    <dd>{jumpSeconds(here, picked).toFixed(1)} s (the navicomputer’s fast)</dd>
                  </div>
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
                  {pilots[picked.id] > 0 && (
                    <div>
                      <dt>Online</dt>
                      <dd>
                        {pilots[picked.id]} {pilots[picked.id] === 1 ? 'pilot' : 'pilots'} there now
                      </dd>
                    </div>
                  )}
                </dl>
                <button type="button" className="btn btn-primary holomap-jump" onClick={() => onJump(picked.id)}>
                  <RiRocket2Fill className="h-4 w-4" aria-hidden="true" /> Jump to lightspeed
                </button>
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
                <p className="mt-3 text-sm leading-relaxed text-body">Pick a system to plot a course, then jump. Filter by era or film to see the galaxy as it was then.</p>
                <p className="mt-3 text-xs leading-relaxed text-muted">The grid squares and regions are the films’ own atlas, where it gives them; the Unknown Regions are, well, unknown.</p>
              </>
            )}
            <button type="button" className="universe-back mt-5" onClick={onLeave}>
              <RiArrowGoBackLine className="mr-1 inline h-4 w-4" aria-hidden="true" /> Leave the galaxy, back to the universe
            </button>
          </aside>
        </div>
      </div>
    </div>
  );
}
