// The Decepticon insignia (Transformers; a trademark of Hasbro), traced to a
// single path so it takes the colour of whatever it sits in.
import { DECEPTICON_PATH, DECEPTICON_VIEWBOX } from './marks';

export default function DecepticonMark({ className = '', title }) {
  return (
    <svg viewBox={DECEPTICON_VIEWBOX} className={className} role={title ? 'img' : undefined} aria-hidden={title ? undefined : 'true'} aria-label={title}>
      <path fill="currentColor" fillRule="evenodd" d={DECEPTICON_PATH} />
    </svg>
  );
}
