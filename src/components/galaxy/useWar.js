import { useEffect, useState } from 'react';
import { onWar, warNow } from './warState';

// A war's table as it stands (warState.js's warNow), again every second and
// whenever what the players did changes: { now, table }.
export function useWar(war) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    const off = onWar(() => setNow(Date.now()));
    return () => (clearInterval(id), off());
  }, []);
  return { now, table: warNow(now, war) };
}
