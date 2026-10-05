// The end of a world's first hint (the few keys to get going): where the
// rest are. The same words in every world, pointing at the one guide.
export default function GuideCue({ touch = false }) {
  return touch ? <span className="guide-cue"> · The ? button has all the controls</span> : (
    <span className="guide-cue">
      {' · '}
      <kbd>?</kbd> all the controls
    </span>
  );
}
