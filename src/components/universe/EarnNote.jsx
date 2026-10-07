// What a page's earning says (useEarn.js's note): a moment's "+40 ¢" over
// the HUD, or a level reached with its title. Always there, empty between
// notes, so a screen reader hears each one as it comes.
export default function EarnNote({ note }) {
  return (
    <p className="universe-earn" role="status" data-on={note ? '' : undefined} data-level={note?.level ? '' : undefined}>
      {note && <span key={note.n}>{note.text}</span>}
    </p>
  );
}
