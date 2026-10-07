import { RiQuestionLine } from 'react-icons/ri';
import { openGuide } from '../../lib/palette';

// The guide's "?" inside a page's own panel, where the corner button would
// sit over it (the universe's and the galaxy's panels). It opens the same guide.
export default function GuideLink({ className = '' }) {
  return (
    <button type="button" className={className} data-tour="guide" onClick={openGuide} aria-label="Guide: controls and tips" aria-keyshortcuts="?" title="Guide (?)">
      <RiQuestionLine className="h-4 w-4" aria-hidden="true" />
    </button>
  );
}
