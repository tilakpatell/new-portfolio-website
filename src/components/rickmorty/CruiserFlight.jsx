import { useEffect, useRef, useState } from 'react';
import { use3D } from '../../lib/gpu';
import { prefersReducedMotion } from '../../lib/hooks';
import PortalSwirl from './PortalSwirl';
import { TALL, along, breakage, cruiserAt, flight, riftAt } from './flight';
import { approach } from '../../lib/ease';

// Rick and Morty in the Space Cruiser, flying down the page with you, as the
// paper plane does on the Office's page: it keeps to the middle of the screen
// as you scroll and swoops from side to side, a trail of exhaust behind it.
// It comes out of the hero's portal ([data-rm-launch]); at each thing marked
// [data-rm-jump] the page cracks open beside it, a portal opens in the hole,
// the cruiser dives in, and it comes out of another below on the other side.
// The geometry is ./flight.js. It sits over the page but never takes a click.
// Where 3D is on the cruiser is the 3D one (./cruiser3d.js), turned to fly
// the way it's going; the flat drawing below is for everywhere else, and
// while the 3D one loads.
//
// Every frame changes transforms and two custom properties per portal only,
// and the trail is shown down to the cruiser by a window sliding down while
// its contents slide up (as the plane's is). A portal's swirl only runs while
// the cruiser is near it.

const NEAR = 1000; // how near (px) a portal is to the cruiser to run its swirl
const AHEAD = 40; // how far on (px) to look to see which way it's turning
const FOLLOW = 7.67; // the cruiser's follow (1/s): −60·ln(1 − 0.12), the 0.12 a frame it had at 60 Hz

// which way it's flying at y: across (-1 left … 1 right) and down (0 … 1)
const heading = (geo, y) => {
  const p = along(geo.X, geo.Y, y);
  const l = Math.hypot(p.dx, p.dy) || 1;
  return { p, h: p.dx / l, v: p.dy / l };
};

export default function CruiserFlight() {
  const box = useRef(null);
  const win = useRef(null);
  const inner = useRef(null);
  const ship = useRef(null);
  const rifts = useRef([]);
  const host = useRef(null);
  const solid = useRef(null); // the 3D cruiser, once it's going
  const [geo, setGeo] = useState(null);
  const [near, setNear] = useState('');
  const [is3D, setIs3D] = useState(false);
  const { on: want3D } = use3D();

  // the 3D cruiser: loaded only where 3D is on; it breathes (the crew's
  // clip, the exhaust) only while the tab is in view, and holds still for
  // reduced motion; anything wrong and it's the drawing
  useEffect(() => {
    if (!want3D || !host.current) return undefined;
    // a canvas of its own each time, so one being let go never takes
    // another's context with it
    const canvas = document.createElement('canvas');
    canvas.className = 'rm-cruiser-3d';
    host.current.appendChild(canvas);
    let gone = false;
    let raf = 0;
    const still = prefersReducedMotion();
    const frame = (t) => {
      raf = 0;
      if (gone || !solid.current) return;
      solid.current.render(t / 1000);
      if (!still && !document.hidden) raf = requestAnimationFrame(frame);
    };
    const onVisible = () => {
      if (!document.hidden && !raf && !still) raf = requestAnimationFrame(frame);
    };
    const onResize = () => solid.current?.fit();
    import('./cruiser3d')
      .then((m) => m.createCruiser3D(canvas))
      .then((c) => {
        if (gone) return c?.dispose();
        if (!c) return undefined;
        solid.current = c;
        setIs3D(true);
        raf = requestAnimationFrame(frame);
        document.addEventListener('visibilitychange', onVisible);
        window.addEventListener('resize', onResize);
        return undefined;
      })
      .catch(() => {});
    return () => {
      gone = true;
      cancelAnimationFrame(raf);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('resize', onResize);
      solid.current?.dispose();
      solid.current = null;
      canvas.remove();
      setIs3D(false);
    };
  }, [want3D]);

  // where everything is: the page's size, the hero's portal, the jumps
  useEffect(() => {
    const el = box.current;
    const page = el?.parentElement;
    if (!el || !page) return undefined;
    let raf = 0;
    const measure = () => {
      raf = 0;
      const b = el.getBoundingClientRect();
      const rel = (n) => {
        const r = n.getBoundingClientRect();
        return { x: r.left + r.width / 2 - b.left, y: r.top + r.height / 2 - b.top, top: r.top - b.top, bottom: r.bottom - b.top, left: r.left - b.left, right: r.right - b.left };
      };
      const launch = page.querySelector('[data-rm-launch]');
      const jumps = [...page.querySelectorAll('[data-rm-jump]')].map(rel);
      const w = el.clientWidth;
      const h = el.clientHeight;
      if (!w || !h) return;
      const f = flight(w, h, { launch: launch ? rel(launch) : null, jumps });
      const breaks = f.portals.map((p, i) => breakage(p.r, i + 1));
      setGeo((g) => (g && g.d === f.d && g.w === w && g.h === h ? g : { w, h, ...f, breaks }));
    };
    const later = () => {
      if (!raf) raf = requestAnimationFrame(measure);
    };
    measure();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(later) : null;
    if (ro) {
      ro.observe(el);
      for (const n of page.querySelectorAll('[data-rm-launch], [data-rm-jump]')) ro.observe(n);
    }
    window.addEventListener('resize', later);
    return () => {
      ro?.disconnect();
      window.removeEventListener('resize', later);
      cancelAnimationFrame(raf);
    };
  }, []);

  useEffect(() => {
    const el = box.current;
    if (!el || !geo || !ship.current) return undefined;
    const still = prefersReducedMotion();
    const H = geo.h;
    let shown = null;
    let raf = 0;
    let running = '';
    const place = (y) => {
      // leaving the page: React lets go of the elements before this effect
      // is cleaned up, and the scroll to the top in between still fires
      if (!ship.current || !win.current || !inner.current) return;
      const { p, h, v } = heading(geo, y);
      const c = cruiserAt(y, geo);
      const s = ship.current.style;
      const at = `translate3d(${p.x.toFixed(1)}px, ${p.y.toFixed(1)}px, 0)`;
      if (solid.current) {
        // the 3D one turns itself: nose the way it's going, banking into
        // the turn, rolling into a portal
        const bank = Math.max(-0.5, Math.min(0.5, (heading(geo, y + AHEAD).h - h) * 1.4));
        solid.current.pose({ h, v, bank, roll: (c.spin * Math.PI) / 180 });
        if (still) solid.current.render(0);
        s.transform = `${at} scale(${c.scale.toFixed(3)})`;
      } else {
        // nose the way it's flying, dipping a little as it drops
        const dir = p.dx >= 0 ? 1 : -1;
        const tilt = Math.max(2, Math.min(22, (Math.atan2(p.dy, Math.abs(p.dx) + 0.001) * 90) / Math.PI));
        s.transform = `${at} scaleX(${dir}) rotate(${(tilt + c.spin).toFixed(1)}deg) scale(${c.scale.toFixed(3)})`;
      }
      s.opacity = c.hidden ? '0' : '1';
      // the trail shows down to the cruiser
      win.current.style.transform = `translate3d(0, ${(y - H).toFixed(1)}px, 0)`;
      inner.current.style.transform = `translate3d(0, ${(H - y).toFixed(1)}px, 0)`;
      // the portals: how open, how cracked
      geo.portals.forEach((pt, i) => {
        const n = rifts.current[i];
        if (!n) return;
        const { open, crack } = riftAt(pt, y);
        n.style.visibility = open > 0 || crack > 0 ? 'visible' : 'hidden';
        n.style.setProperty('--open', open.toFixed(3));
        n.style.setProperty('--crack', crack.toFixed(3));
      });
      const want = geo.portals
        .map((pt, i) => (Math.abs(pt.y - y) < NEAR ? i : -1))
        .filter((i) => i >= 0)
        .join(',');
      if (want !== running) {
        running = want;
        setNear(want);
      }
    };
    // where the cruiser should be: the middle of the screen, in the page's coordinates
    const target = () => {
      const top = el.getBoundingClientRect().top + window.scrollY;
      return window.scrollY + window.innerHeight * 0.5 - top;
    };
    // (by the frame's time, so a 120 Hz screen eases at the 60 Hz pace it was
    // tuned at: 0.12 of the way a sixtieth of a second; a first frame after
    // a rest counts as one sixtieth)
    let last = 0;
    const tick = (now) => {
      const dt = last && now ? Math.min(0.1, (now - last) / 1000) : 1 / 60;
      last = now ?? 0;
      const goal = target();
      // it starts in the hero's portal and comes out to where it should be
      shown = shown == null ? (still ? goal : Math.min(goal, geo.start.y)) : still ? goal : approach(shown, goal, FOLLOW, dt);
      place(shown);
      raf = Math.abs(goal - shown) > 0.5 ? requestAnimationFrame(tick) : 0;
      if (!raf) last = 0;
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(tick);
    };
    tick();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      cancelAnimationFrame(raf);
    };
  }, [geo, is3D]);

  const on = new Set(near ? near.split(',').map(Number) : []);
  return (
    <>
      {/* the trail and the broken page sit behind the page's content; the cruiser flies over it */}
      <div ref={box} className="rm-flight rm-flight-back" aria-hidden="true">
        {geo && (
          <>
            <div ref={win} className="rm-trail-window" style={{ height: geo.h, transform: `translate3d(0, ${-geo.h}px, 0)` }}>
              <svg ref={inner} className="rm-trail-inner" width={geo.w} height={geo.h} viewBox={`0 0 ${geo.w} ${geo.h}`} style={{ transform: `translate3d(0, ${geo.h}px, 0)` }}>
                <path d={geo.d} className="rm-trail-glow" />
                <path d={geo.d} className="rm-trail-line" />
              </svg>
            </div>
            {geo.portals.map((p, i) => {
              const b = geo.breaks[i];
              const R = b.reach;
              const ry = p.r * TALL;
              const frame = { width: R * 2, height: R * 2, left: -R, top: -R };
              const view = `${-R} ${-R} ${R * 2} ${R * 2}`;
              return (
                <div
                  key={`${i}-${p.x}-${p.y}`}
                  ref={(n) => {
                    rifts.current[i] = n;
                  }}
                  className="rm-rift"
                  style={{ left: p.x, top: p.y, visibility: 'hidden' }}
                >
                  <svg className="rm-rift-cracks" viewBox={view} style={frame}>
                    {b.cracks.map((d, j) => (
                      <path key={j} d={d} pathLength="1" />
                    ))}
                  </svg>
                  <div className="rm-rift-gate">
                    <svg className="rm-rift-hole" viewBox={view} style={frame}>
                      <path d={b.hole} />
                    </svg>
                    <div className="rm-rift-swirl" style={{ width: p.r * 2.7, height: ry * 2.7, left: -p.r * 1.35, top: -ry * 1.35 }}>
                      {on.has(i) && <PortalSwirl seed={i * 1.7 + 0.4} size={[0.285, 0.37]} className="rm-rift-fill" />}
                    </div>
                  </div>
                  <svg className="rm-rift-shards" viewBox={view} style={frame}>
                    {b.shards.map((s, j) => {
                      const l = Math.hypot(s.x, s.y) || 1;
                      return <path key={j} d={s.d} style={{ '--sx': (s.x / l).toFixed(3), '--sy': (s.y / l).toFixed(3), '--turn': `${j % 2 ? 16 : -16}deg` }} />;
                    })}
                  </svg>
                </div>
              );
            })}
          </>
        )}
      </div>
      <div className="rm-flight rm-flight-front" aria-hidden="true">
        <div ref={ship} className={`rm-cruiser${is3D ? ' is-3d' : ''}`}>
          <div ref={host} />
          {!is3D && <Cruiser />}
        </div>
      </div>
    </>
  );
}

const INK = '#1b1424';

// The Space Cruiser from the side, nose to the right: Rick at the wheel,
// Morty behind him, a green flame out the back.
function Cruiser() {
  return (
    <svg viewBox="-100 -46 180 92" className="rm-cruiser-art">
      <g className="rm-cruiser-flame">
        <path d="M-60 2 C-72 -8 -92 -3 -100 3 C-92 9 -72 13 -60 5 Z" fill="#9ff25a" />
        <path d="M-60 3 C-68 -2 -80 0 -86 3.5 C-80 7 -68 8 -60 5 Z" fill="#effcc4" />
      </g>
      <path d="M-46 -2 L-62 -20 L-56 -21 L-34 -8 Z" fill="#aab4bb" stroke={INK} strokeWidth="2" strokeLinejoin="round" />
      {/* Morty, in the back */}
      <g stroke={INK} strokeWidth="1.6">
        <path d="M-16 -8 Q-6 -14 4 -8 Z" fill="#f3d84b" />
        <circle cx="-6" cy="-19" r="8.5" fill="#f2d3b8" />
        <path d="M-14.5 -20 Q-14 -29 -6 -29.5 Q2 -29 2.5 -20 Q-2 -24.5 -6 -24.5 Q-10 -24.5 -14.5 -20 Z" fill="#6a3d1f" />
        <circle cx="-3" cy="-18.5" r="2.6" fill="#fff" strokeWidth="1" />
        <circle cx="2.2" cy="-18.5" r="2.6" fill="#fff" strokeWidth="1" />
        <circle cx="-2.6" cy="-18.5" r="0.7" fill={INK} stroke="none" />
        <circle cx="2.6" cy="-18.5" r="0.7" fill={INK} stroke="none" />
        <path d="M-1 -13.5 Q0.5 -14.5 2 -13.5" fill="none" strokeWidth="1.2" />
      </g>
      {/* Rick, driving */}
      <g stroke={INK} strokeWidth="1.6" strokeLinejoin="round">
        <path d="M14 -8 Q24 -14 34 -8 Z" fill="#f4f3ee" />
        <path d="M18 -25 L4 -33 L13 -23 L0 -24 L12 -18 L3 -13 L16 -15 Z" fill="#a9d7e8" />
        <path d="M17 -26 Q24 -31 31 -26 L30 -14 Q24 -10 18 -14 Z" fill="#f2d3b8" />
        <path d="M19 -25.5 Q24 -28 30 -25.5" fill="none" stroke="#7d98a6" strokeWidth="2.4" strokeLinecap="round" />
        <circle cx="23" cy="-22" r="2.6" fill="#fff" strokeWidth="1" />
        <circle cx="28.4" cy="-22" r="2.6" fill="#fff" strokeWidth="1" />
        <circle cx="23.6" cy="-22" r="0.7" fill={INK} stroke="none" />
        <circle cx="29" cy="-22" r="0.7" fill={INK} stroke="none" />
        <path d="M24 -15.5 Q27 -14 30 -15.5" fill="none" strokeWidth="1.2" />
      </g>
      {/* the hull */}
      <path d="M-62 4 C-60 -7 -36 -10 -8 -10 L34 -10 C54 -10 70 -3 76 6 C70 16 44 20 4 20 L-38 20 C-54 18 -64 12 -62 4 Z" fill="#c4ccd2" stroke={INK} strokeWidth="2.2" strokeLinejoin="round" />
      <path d="M-58 12 C-36 19 40 21 70 11 C62 17 44 20.5 4 20.5 L-38 20.5 C-48 19.5 -55 16.5 -58 12 Z" fill="#8a949b" />
      <path d="M-54 5 L66 5" stroke="#5c6a74" strokeWidth="2" strokeLinecap="round" />
      <path d="M-30 -10 L-30 -3 M10 -10 L10 -3" stroke="#8a949b" strokeWidth="1.6" strokeLinecap="round" />
      <circle cx="69" cy="8" r="3.2" fill="#ffd34a" stroke={INK} strokeWidth="1.4" />
      <circle cx="-57" cy="2" r="2.4" fill="#ff5a4a" stroke={INK} strokeWidth="1.2" />
      {/* the windshield */}
      <path d="M36 -10 C40 -22 50 -24 56 -9 Z" fill="rgba(170, 225, 255, 0.55)" stroke={INK} strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M41 -12 C43 -17 46 -19 49 -18" fill="none" stroke="#fff" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}
