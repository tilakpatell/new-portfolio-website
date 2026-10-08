// The end of a world's first hint (the few keys to get going): where the
// rest are. The same words in every world, pointing at the one guide.
export default function GuideCue({ touch = false }) {
  return touch ? <span className="guide-cue"> · Tap ? for the guide</span> : (
    <span className="guide-cue">
      {' · Press '}
      <kbd>?</kbd> for the guide
    </span>
  );
}
