import { useEffect, useState } from 'react';
import { getTuning, onTuning, setTuning } from './engine';

// The music room's shared tuning: Sa, the tanpura's first string, and the raga.
export function useTuning() {
  const [tuning, setLocal] = useState(getTuning);
  useEffect(() => onTuning(setLocal), []);
  return [tuning, setTuning];
}
