// The Autobot insignia (Transformers; a trademark of Hasbro), traced to a
// single path so it takes the colour of whatever it sits in.
import { AUTOBOT_PATH, AUTOBOT_VIEWBOX } from './marks';

export default function AutobotMark({ className = '', title }) {
  return (
    <svg viewBox={AUTOBOT_VIEWBOX} className={className} role={title ? 'img' : undefined} aria-hidden={title ? undefined : 'true'} aria-label={title}>
      <path fill="currentColor" fillRule="evenodd" d={AUTOBOT_PATH} />
    </svg>
  );
}
