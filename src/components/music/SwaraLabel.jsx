import { SWARA_NAME, swaraMark } from './engine';
import '../../styles/lazy/music.css';

// A swara written the way sargam notation writes it: a dot below for the lower
// octave (mandra), a dot above for the upper (taar), a line under a komal
// (flat) note, two under an ati komal one (lower still) and a tick over
// tivra (sharp) Ma.
export default function SwaraLabel({ s, oct = 0, ati = false }) {
  const mark = ati ? 'ati komal' : swaraMark(s);
  const spoken = `${oct < 0 ? 'low ' : oct > 0 ? 'high ' : ''}${mark ? `${mark} ` : ''}${SWARA_NAME[s]}`;
  return (
    <span className="swara" data-oct={oct || undefined} data-mark={ati ? 'ati' : mark || undefined}>
      <span aria-hidden="true">{SWARA_NAME[s]}</span>
      <span className="sr-only">{spoken}</span>
    </span>
  );
}
