import { CUSTOMERS, M, traysFor } from './rules';

// The order slip, Papa's style: what to make, top to bottom, in the order
// the stations make it. Icons do the talking; words back them up.

const MIX_COLOR = { blue: '#2f8fd0', chili: '#c8361e', seeds: '#bfe8ff', spice: '#d99a2b' };
const PACK_FACE = { baggie: '#e9f3f7', box: '#f2c318', barrel: '#3e6a92' };

// The sticker art, small, for the slip, the palette and the board.
export function StickerIcon({ kind, size = 22 }) {
  return (
    <svg viewBox="-64 -64 128 128" width={size} height={size} aria-hidden="true" className="wm-sticker-icon">
      {kind === 'hat' && (
        <>
          <ellipse cx="0" cy="22" rx="58" ry="14" fill="#1a1a1a" />
          <rect x="-32" y="-30" width="64" height="52" fill="#1a1a1a" />
          <rect x="-32" y="8" width="64" height="10" fill="#4a4a4a" />
        </>
      )}
      {kind === 'bluesky' && (
        <>
          <circle r="58" fill="#1d78c4" />
          <text y="-4" textAnchor="middle" fill="#fff" fontSize="30" fontWeight="700" fontFamily="Arial, sans-serif">
            BLUE
          </text>
          <text y="26" textAnchor="middle" fill="#fff" fontSize="30" fontWeight="700" fontFamily="Arial, sans-serif">
            SKY
          </text>
        </>
      )}
      {kind === 'pollos' && (
        <>
          <circle r="58" fill="#b5281c" />
          <ellipse cx="-4" cy="6" rx="30" ry="22" fill="#ffd23a" />
          <circle cx="22" cy="-16" r="13" fill="#ffd23a" />
        </>
      )}
      {kind === 'madrigal' && (
        <>
          <rect x="-58" y="-40" width="116" height="80" fill="#1d3550" />
          <text y="8" textAnchor="middle" fill="#fff" fontSize="22" fontWeight="700" fontFamily="Arial, sans-serif">
            MADRIGAL
          </text>
        </>
      )}
    </svg>
  );
}

// The face of a pack, with stickers where they go (or where they went).
export function PackFace({ pack, stickers = [], size = 'sm', children, ...rest }) {
  return (
    <div className="wm-packface" data-pack={pack} data-size={size} style={{ '--face': PACK_FACE[pack] ?? '#ddd' }} {...rest}>
      {pack === 'box' && <span className="wm-packface-word">LOS POLLOS</span>}
      {pack === 'barrel' && <span className="wm-packface-word">MADRIGAL</span>}
      {stickers.map((s, i) => (
        <span key={`${s.kind}-${i}`} className="wm-packface-sticker" style={{ left: `${s.x * 100}%`, top: `${s.y * 100}%` }}>
          <StickerIcon kind={s.kind} size={size === 'lg' ? 52 : 16} />
        </span>
      ))}
      {children}
    </div>
  );
}

const Dots = ({ n, color }) => (
  <span className="wm-dots" aria-hidden="true">
    {Array.from({ length: n }, (_, i) => (
      <i key={i} style={{ background: color }} />
    ))}
  </span>
);

export default function Ticket({ entry, big = false, scores = null }) {
  const o = entry.order;
  const trays = traysFor(o);
  const mix = Object.keys(M.mixins).filter((k) => (o.mix[k] ?? 0) > 0);
  const n = Number(entry.id.split('-')[1]) + 1;
  return (
    <div className="wm-ticket" data-big={big || undefined}>
      <p className="wm-ticket-head">
        <span>{CUSTOMERS[o.customer].name}</span>
        <span>#{n}</span>
      </p>
      <ol className="wm-ticket-rows">
        <li data-done={scores?.build != null || undefined}>
          <span className="wm-trays" aria-hidden="true">
            {Array.from({ length: trays }, (_, i) => (
              <i key={i} />
            ))}
          </span>
          {M.sizes[o.size].label}
        </li>
        {mix.map((k) => (
          <li key={k} data-done={scores?.build != null || undefined}>
            <Dots n={o.mix[k]} color={MIX_COLOR[k]} />
            {k === 'blue' ? M.shades[o.mix.blue - 1] : M.mixins[k].label}
            {k !== 'blue' && <b> ×{o.mix[k]}</b>}
          </li>
        ))}
        {!o.mix.chili && <li className="wm-ticket-no">No Chili P</li>}
        <li data-done={scores?.cook != null || undefined}>
          <span className="wm-ticket-icon" aria-hidden="true">
            ◔
          </span>
          {o.purity}% pure or better
        </li>
        <li data-done={scores?.break != null || undefined}>
          <span className="wm-ticket-icon" aria-hidden="true">
            ◇
          </span>
          {M.cuts[o.cut].label}
        </li>
        <li data-done={scores?.pack != null || undefined}>
          <span className="wm-ticket-icon" aria-hidden="true">
            ▣
          </span>
          {M.packs[o.pack].label}
        </li>
      </ol>
      {o.stickers.length > 0 && (
        <div className="wm-ticket-stickers">
          <PackFace pack={o.pack} stickers={o.stickers} size={big ? 'md' : 'sm'} aria-label={`Stickers: ${o.stickers.map((s) => M.stickers[s.kind].label).join(', ')}`} role="img" />
        </div>
      )}
    </div>
  );
}
