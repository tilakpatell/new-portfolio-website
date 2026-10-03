import { useEffect, useRef } from 'react';
import { prefersReducedMotion } from '../lib/hooks';

// The name, which flickers through Aurebesh and back when you point at it.
export default function Wordmark({ text = 'Tilak Patel' }) {
  const ref = useRef(null);
  const timers = useRef([]);

  const flip = () => {
    if (prefersReducedMotion()) return;
    const chars = ref.current?.querySelectorAll('.ch');
    if (!chars) return;
    timers.current.forEach(clearTimeout);
    timers.current = [];
    chars.forEach((el, i) => {
      if (!el.textContent.trim()) return;
      timers.current.push(setTimeout(() => el.classList.add('flip'), i * 35));
      timers.current.push(setTimeout(() => el.classList.remove('flip'), 420 + i * 35));
    });
  };

  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  return (
    <span ref={ref} onPointerEnter={flip} onFocus={flip}>
      {[...text].map((c, i) => (
        <span key={i} className="ch" aria-hidden="true">
          {c === ' ' ? ' ' : c}
        </span>
      ))}
      <span className="sr-only">{text}</span>
    </span>
  );
}

// A line written in Aurebesh that reads as English on hover or focus.
export function AurebeshLine({ children, className = '', as: Tag = 'span' }) {
  return (
    <Tag className={`aurebesh aurebesh-reveal ${className}`} tabIndex={0} title={typeof children === 'string' ? children : undefined}>
      {children}
    </Tag>
  );
}
