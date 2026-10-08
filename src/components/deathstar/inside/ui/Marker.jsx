// The way shown: the marker's element (ui/waymark.js places it each frame).
//
//   <Marker markerRef />

export default function Marker({ markerRef }) {
  return (
    <div className="ds-marker" ref={markerRef} hidden aria-hidden="true">
      <span className="ds-marker-arrow" />
      <span className="ds-marker-dot" />
      <span className="ds-marker-text" />
    </div>
  );
}
