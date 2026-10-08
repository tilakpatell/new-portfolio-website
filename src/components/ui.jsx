import { Fragment, useEffect, useRef, useState } from 'react';
import { onceVisible } from '../lib/observe';
import { IconClose, IconCopy, IconDone } from './icons';

// Marks the element with data-<attr>="true" the first time it is seen.
// Set directly on the DOM so it costs no React re-render.
// eslint-disable-next-line react-refresh/only-export-components
export function useOnceVisible(attr = 'in') {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    return onceVisible(el, () => {
      el.dataset[attr] = 'true';
    });
  }, [attr]);
  return ref;
}

// Fades content up the first time it scrolls into view.
export function Reveal({ as: Tag = 'div', delay = 0, className = '', style, children, ...rest }) {
  const ref = useOnceVisible('in');
  return (
    <Tag ref={ref} className={`reveal ${className}`} style={delay ? { ...style, transitionDelay: `${delay}ms` } : style} {...rest}>
      {children}
    </Tag>
  );
}

// A stop on the page's route line. Place it inside a positioned content column.
export function Waypoint({ top, ...data }) {
  return <span className="waypoint" data-waypoint="" style={top ? { '--wp-top': top } : undefined} {...data} />;
}

// A lightsaber rule: a small hilt and a blade in the theme's kyber colour that
// ignites the first time it scrolls into view.
export function Saber({ className = '' }) {
  const ref = useOnceVisible('lit');
  return (
    <div ref={ref} className={`saber ${className}`} aria-hidden="true">
      <span className="saber-hilt">
        <i />
        <i />
        <i />
      </span>
      <span className="saber-blade" />
    </div>
  );
}

export function SectionHeading({ eyebrow, title, children, id, waypoint = true, className = '' }) {
  return (
    <div className={`relative ${className}`}>
      {waypoint && <Waypoint />}
      {eyebrow && <p className="eyebrow">{eyebrow}</p>}
      {title && (
        <h2 id={id} className="title mt-3">
          {title}
        </h2>
      )}
      {children && <div className="lead mt-4 max-w-2xl">{children}</div>}
    </div>
  );
}

export function Chips({ items, className = '' }) {
  return (
    <ul className={`flex flex-wrap gap-2 ${className}`}>
      {items.map((item) => (
        <li key={item} className="chip">
          {item}
        </li>
      ))}
    </ul>
  );
}

// Points in a list, each behind a short accent dash.
export function Bullets({ items, className = '' }) {
  return (
    <ul className={`grid gap-4 ${className}`}>
      {items.map((b, i) => (
        <Reveal as="li" key={i} delay={i * 50} className="grid grid-cols-[1.25rem_1fr] gap-2 leading-relaxed text-body">
          <span className="mt-[0.7em] h-[2px] w-3 rounded-full" style={{ background: 'var(--accent)' }} aria-hidden="true" />
          <span>{b}</span>
        </Reveal>
      ))}
    </ul>
  );
}

// Copies some words, and says so for two seconds. Without a clipboard (an old
// browser, a page not served over https) `onFail` gets the words instead; with
// none, nothing happens and the words are on the page to select.
export function CopyButton({ text, label = 'Copy', onFail, className = 'btn btn-ghost btn-sm', ...rest }) {
  const [done, setDone] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setDone(true);
      setTimeout(() => setDone(false), 2000);
    } catch {
      onFail?.(text);
    }
  };
  return (
    <button type="button" className={className} onClick={copy} {...rest}>
      {done ? <IconDone className="h-4 w-4 text-accent" aria-hidden="true" /> : <IconCopy className="h-4 w-4" aria-hidden="true" />}
      <span aria-live="polite">{done ? 'Copied' : label}</span>
    </button>
  );
}

// The X on anything that floats. Its name says what it closes when the
// panel's own title doesn't ("Close the guide"); otherwise "Close".
export function CloseButton({ label = 'Close', className = '', ...rest }) {
  return (
    <button type="button" className={`close-btn ${className}`} aria-label={label} {...rest}>
      <IconClose className="h-5 w-5" aria-hidden="true" />
    </button>
  );
}

// A title that may hold a path (github/awesome-copilot): it can break after
// each slash, instead of in the middle of a word.
export function Breakable({ text }) {
  const parts = String(text).split('/');
  return parts.map((part, i) => (
    <Fragment key={i}>
      {part}
      {i < parts.length - 1 && (
        <>
          /<wbr />
        </>
      )}
    </Fragment>
  ));
}

// A big title shrinks only as far as it must for its longest word to fit its
// column, instead of breaking the word in two (Albuquerqu / e). It is measured,
// so a title that already fits keeps its size exactly; it checks again when the
// column changes width and once the fonts have loaded.
// eslint-disable-next-line react-refresh/only-export-components
export function useFitTitle() {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === 'undefined') return undefined;
    let frame = 0;
    const fit = () => {
      frame = 0;
      el.style.removeProperty('font-size');
      const words = el.textContent.split(/[\s/\-–—]+/).filter(Boolean);
      if (!words.length || !el.clientWidth) return;
      const longest = words.reduce((a, b) => (b.length > a.length ? b : a));
      // the word on one line, in the title's own styles (first-letter tiles and all)
      const probe = el.cloneNode(false);
      probe.removeAttribute('id');
      probe.setAttribute('aria-hidden', 'true');
      probe.textContent = longest;
      probe.style.cssText = 'position:absolute;visibility:hidden;white-space:nowrap;width:auto;max-width:none;left:0;top:0;margin:0';
      el.parentElement.appendChild(probe);
      const need = probe.getBoundingClientRect().width;
      probe.remove();
      if (need > el.clientWidth) el.style.fontSize = `${(parseFloat(getComputedStyle(el).fontSize) * el.clientWidth * 0.98) / need}px`;
    };
    const later = () => {
      if (!frame) frame = requestAnimationFrame(fit);
    };
    const ro = new ResizeObserver(later);
    ro.observe(el.parentElement);
    document.fonts?.ready.then(later);
    later();
    return () => {
      ro.disconnect();
      cancelAnimationFrame(frame);
    };
  }, []);
  return ref;
}
