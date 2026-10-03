// Employer logos: the official AWS and RTX marks (SVG, from Wikimedia Commons)
// and the original logo files for the others, trimmed and compressed.
const FILES = {
  aws: { src: '/logos/aws.svg', w: 304, h: 182, pad: '16%' },
  rtx: { src: '/logos/rtx.svg', w: 186, h: 72, pad: '12%' },
  bose: { src: '/logos/bose.webp', w: 360, h: 45, pad: '12%' },
  pendar: { src: '/logos/pendar.webp', w: 137, h: 160, pad: '14%' },
  empowerreg: { src: '/logos/empowerreg.webp', w: 127, h: 128, pad: '0' },
  src: { src: '/logos/src.webp', w: 240, h: 77, pad: '12%' },
};

export default function CompanyLogo({ id, className = '' }) {
  const file = FILES[id];
  if (!file) return null;
  return (
    <span className={`inline-flex items-center justify-center overflow-hidden rounded-panel border border-line bg-white ${className}`}>
      <img
        src={file.src}
        width={file.w}
        height={file.h}
        alt=""
        loading="lazy"
        decoding="async"
        className="h-full w-full object-contain"
        style={{ padding: file.pad }}
      />
    </span>
  );
}
