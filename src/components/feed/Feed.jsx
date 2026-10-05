import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useNavigationType } from 'react-router-dom';
import { RiArrowDownLine, RiArrowUpLine, RiRocketLine, RiTerminalBoxLine } from 'react-icons/ri';
import { PageContext } from '../../lib/page';
import { prefersReducedMotion } from '../../lib/hooks';
import { FEED, byId, categoryAt, feedState, isFeedMove, nextOf, placeOf } from './feed';
import './feed.css';

// The portfolio as a feed. The six portfolio pages are one page each at
// their own address, as ever, but reach the end of one and the next begins
// under it, and the address, the nav, the tab's title and the theme follow
// the one on screen. See docs/superpowers/specs/2026-10-05-feed-design.md.
//
// One Feed is the element of all six routes. It keeps a stack of the pages
// mounted so far, starting at the one in the address: a sentinel a viewport
// above the bottom of the last one appends the next (its chunk is fetched as
// soon as it is next, so the append is a render, not a download). Whichever
// page holds the middle of the screen is current: when that changes, the
// address is replaced (one history entry for the whole scroll; Back goes
// where you came from) with state.feed, which is how the rest of the app
// tells the feed's own moves from a visitor's click. Any other move to a
// different category starts the feed over there, at the top, as a navigation
// always has.

const LOAD = {
  home: () => import('../../pages/Home'),
  experience: () => import('../../pages/Experience'),
  projects: () => import('../../pages/Projects'),
  resume: () => import('../../pages/Resume'),
  travel: () => import('../../pages/Travel'),
  contact: () => import('../../pages/Contact'),
};
const PAGES = Object.fromEntries(Object.entries(LOAD).map(([id, load]) => [id, lazy(load)]));

export default function Feed() {
  const location = useLocation();
  const navType = useNavigationType();
  const entry = categoryAt(location.pathname);
  const [run, setRun] = useState(() => ({ key: 0, entry: entry?.id ?? FEED[0].id }));
  // the page the running feed says is current, so a page's own search-param
  // update (a filter, a tab) or the same link again doesn't start it over
  const current = useRef(run.entry);
  const onCurrent = useCallback((id) => {
    current.current = id;
  }, []);

  useEffect(() => {
    if (!entry || isFeedMove(location, navType) || entry.id === current.current) return;
    current.current = entry.id;
    setRun((r) => ({ key: r.key + 1, entry: entry.id }));
  }, [entry, location, navType]);

  return <FeedRun key={run.key} entry={run.entry} onCurrent={onCurrent} />;
}

function FeedRun({ entry, onCurrent }) {
  const navigate = useNavigate();
  const [stack, setStack] = useState(() => [entry]);
  const [ready, setReady] = useState(() => ({}));
  const [active, setActive] = useState(entry);
  const current = useRef(entry);
  // each page's search string while it is off the address (a filter, a tab),
  // put back when it is current again
  const searches = useRef({});
  const remembers = useMemo(() => Object.fromEntries(FEED.map((c) => [c.id, (s) => (searches.current[c.id] = s)])), []);
  const contexts = useMemo(() => Object.fromEntries(FEED.map((c) => [c.id, { active: c.id === active, remember: remembers[c.id] }])), [active, remembers]);

  const onMiddle = useCallback(
    (id) => {
      if (id === current.current) return;
      current.current = id;
      onCurrent(id);
      setActive(id);
      const search = searches.current[id];
      navigate(`${byId(id).to}${search ? `?${search}` : ''}`, { replace: true, state: feedState });
    },
    [navigate, onCurrent],
  );
  const onReady = useCallback((id) => setReady((r) => (r[id] ? r : { ...r, [id]: true })), []);
  const append = useCallback(() => setStack((s) => (s.length < FEED.length ? [...s, nextOf(s[s.length - 1]).id] : s)), []);

  // the next page's chunk, before it is wanted
  const last = stack[stack.length - 1];
  useEffect(() => {
    if (stack.length < FEED.length) LOAD[nextOf(last).id]().catch(() => {});
  }, [last, stack.length]);

  const done = stack.length === FEED.length && ready[last];
  return (
    <div className="feed page-enter" data-feed-entry={entry}>
      {stack.map((id, i) => (
        <FeedPage
          key={id}
          id={id}
          entry={entry}
          first={i === 0}
          context={contexts[id]}
          onMiddle={onMiddle}
          onReady={onReady}
          onMore={i === stack.length - 1 && ready[id] && stack.length < FEED.length ? append : null}
        />
      ))}
      {done && <FeedEnd />}
    </div>
  );
}

function FeedPage({ id, entry, first, context, onMiddle, onReady, onMore }) {
  const Page = PAGES[id];
  const ref = useRef(null);
  // a page mounted a viewport ahead would play its hero animation unseen:
  // the wrapper waits (feed.css pauses .hero-in under it) until it is in sight
  const [wait, setWait] = useState(!first);

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') return undefined;
    // the middle of the screen (the line the theme follows, too)
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) onMiddle(id);
      },
      { rootMargin: '-50% 0px -50% 0px' },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [id, onMiddle]);

  useEffect(() => {
    if (!wait) return undefined;
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') {
      setWait(false);
      return undefined;
    }
    const io = new IntersectionObserver(([e]) => e.isIntersecting && setWait(false));
    io.observe(el);
    return () => io.disconnect();
  }, [wait]);

  return (
    <div ref={ref} className="feed-page" data-feed-page={id} data-active={context.active || undefined} data-wait={wait || undefined}>
      {!first && <FeedDivider id={id} place={placeOf(entry, id)} />}
      <PageContext.Provider value={context}>
        <Suspense fallback={<div className="feed-loading" aria-hidden="true" />}>
          <Page />
          <Mounted id={id} onMount={onReady} />
        </Suspense>
      </PageContext.Provider>
      {onMore && <Sentinel onNear={onMore} />}
    </div>
  );
}

// Inside the page's Suspense, so it runs once the page has rendered, not
// while its fallback is up: the sentinel that mounts the next page waits for
// it, so a tall fallback never chains every page in at once.
function Mounted({ id, onMount }) {
  useEffect(() => onMount(id), [id, onMount]);
  return null;
}

// A viewport above the bottom of the last page: the next one is appended.
function Sentinel({ onNear }) {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    if (typeof IntersectionObserver === 'undefined') {
      onNear();
      return undefined;
    }
    const io = new IntersectionObserver(
      ([e]) => {
        if (!e.isIntersecting) return;
        io.disconnect();
        onNear();
      },
      { rootMargin: '100% 0px' },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [onNear]);
  return <div ref={ref} className="feed-sentinel" aria-hidden="true" />;
}

// Between two pages: where you are in the feed, and what comes next.
function FeedDivider({ id, place }) {
  const cat = byId(id);
  return (
    <div className="feed-divider" role="separator" aria-label={`Next: ${cat.label}`}>
      <div className="shell feed-divider-inner">
        <p className="feed-divider-count">
          <RiArrowDownLine aria-hidden="true" /> Keep scrolling · {place} of {FEED.length}
        </p>
        <p className="feed-divider-title display">{cat.label}</p>
        <p className="feed-divider-blurb">{cat.blurb}</p>
      </div>
    </div>
  );
}

// After the sixth page.
function FeedEnd() {
  const top = () => window.scrollTo({ top: 0, behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
  return (
    <section className="feed-end" aria-labelledby="feed-end-title">
      <div className="shell feed-end-inner">
        <p className="eyebrow">End of the feed</p>
        <h2 id="feed-end-title" className="display mt-5 text-[clamp(2.2rem,1.3rem+3.4vw,4.4rem)]">
          That’s everything, top to bottom.
        </h2>
        <p className="lead mt-6 max-w-2xl">Six pages, one scroll. The rest of the site is out in space: the universe map, the hidden worlds and a terminal.</p>
        <div className="mt-9 flex flex-wrap gap-3">
          <button type="button" className="btn btn-primary btn-lg" onClick={top}>
            <RiArrowUpLine className="h-4 w-4" aria-hidden="true" /> Back to the top
          </button>
          <Link to="/universe" className="btn btn-ghost btn-lg">
            <RiRocketLine className="h-4 w-4" aria-hidden="true" /> Fly the universe
          </Link>
          <Link to="/terminal" className="btn btn-ghost btn-lg">
            <RiTerminalBoxLine className="h-4 w-4" aria-hidden="true" /> Terminal
          </Link>
        </div>
      </div>
    </section>
  );
}
