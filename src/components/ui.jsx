import { useEffect, useRef } from 'react';
import { onceVisible } from '../lib/observe';

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
