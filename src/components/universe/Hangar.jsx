// The way into the Shipyard (shipyard/Shipyard.jsx): the button in the
// map's corner beside the flight settings. The yard itself fills the page
// and takes H and Escape; this is only the door.

export default function Hangar({ open, onOpen }) {
  return (
    <button
      type="button"
      className="universe-hangar-btn"
      aria-expanded={open}
      aria-haspopup="dialog"
      aria-label="Shipyard: build, paint and parts"
      title="Shipyard: build, paint and parts (H)"
      aria-keyshortcuts="H"
      onClick={() => onOpen(!open)}
    >
      <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
        <path d="M14.7 6.3a4 4 0 0 0-5.4 5.1L4 16.7 7.3 20l5.3-5.3a4 4 0 0 0 5.1-5.4l-2.4 2.4-2.4-.6-.6-2.4z" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
      </svg>
    </button>
  );
}
