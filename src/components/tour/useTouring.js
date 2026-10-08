import { useEffect, useState } from 'react';

// Whether a tour's running (html[data-touring], set by Tour.jsx), for what
// the shell does differently under one: the universe's panel comes out of
// hiding, and achievement toasts wait their turn until it ends.
const touring = () => typeof document !== 'undefined' && 'touring' in document.documentElement.dataset;

export function useTouring() {
  const [on, setOn] = useState(touring);
  useEffect(() => {
    const watch = new MutationObserver(() => setOn(touring()));
    watch.observe(document.documentElement, { attributes: true, attributeFilter: ['data-touring'] });
    setOn(touring());
    return () => watch.disconnect();
  }, []);
  return on;
}
