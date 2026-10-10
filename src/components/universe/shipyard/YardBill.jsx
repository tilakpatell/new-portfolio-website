import { useEffect, useState } from 'react';
import { READOUT_LABEL, partById } from '../outfit';
import { moduleById } from './parts';
import { RAIL_LABEL } from './rail';
import { itemOfModule, itemOfPart } from '../yardRules';

// The Shipyard's bill: the draft's power and mass, its read-out against the
// factory ship (and against what's pointed at), the wallet, the changes
// staged with what each costs, the total and how short, Apply and Revert;
// then what can be sold back (a second press within SURE seconds sells it),
// and the record and the crew's wardrobe. On a phone it's a sheet at the
// foot of the yard: the total and Apply always in sight, the rest a tap away.

const SURE = 4; // seconds a "Sure?" waits for its second press
const cr = (n) => `${n.toLocaleString('en-GB')} ¢`;

const nameOf = (c) => {
  if (c.slot === 'build') return c.to === 'garage' ? 'Garage build' : 'Stock ship';
  if (c.tune && !c.to) return 'As it came';
  if (c.module) return moduleById(c.slot, c.to)?.name ?? c.to;
  return partById(c.slot, c.to)?.name ?? c.to;
};
const itemOfChange = (c) => (c.slot === 'build' ? null : c.module ? itemOfModule(c.slot, c.to) : itemOfPart(c.slot, c.to));

export default function YardBill({ checked, changes, now, then, wallet, toBuyKeys, sell, note, dropped, open, onOpen, onApply, onRevert, onSell, onRecord, crew, onCrew, ready }) {
  const [sure, setSure] = useState(null); // the key a first press asked about
  useEffect(() => {
    if (!sure) return undefined;
    const t = setTimeout(() => setSure(null), SURE * 1000);
    return () => clearTimeout(t);
  }, [sure]);
  const dirty = changes.length > 0;
  const can = ready && checked.ok && dirty;

  return (
    <aside className="yard-bill" aria-label="The bill" data-open={open || undefined}>
      <div className="yard-bill-bar">
        <button type="button" className="yard-bill-toggle" aria-expanded={open} onClick={() => onOpen(!open)}>
          <span className="sr-only">{open ? 'Hide the bill' : 'Show the bill'}</span>
          <span aria-hidden="true">{open ? '▾' : '▴'}</span>
        </button>
        <p className="yard-total">
          <span>{dirty ? `${changes.length} change${changes.length === 1 ? '' : 's'}` : 'Nothing staged'}</span>
          <b>{cr(checked.total)}</b>
          {checked.short > 0 && <em className="yard-short">short {cr(checked.short)}</em>}
        </p>
        <div className="yard-actions">
          <button type="button" className="yard-revert" onClick={onRevert} disabled={!dirty}>
            Revert
          </button>
          <button type="button" className="yard-apply" onClick={onApply} disabled={!can} aria-describedby={checked.issues.length ? 'yard-issues' : undefined}>
            Apply and launch
          </button>
        </div>
      </div>

      <div className="yard-bill-body">
        {(checked.issues.length > 0 || dropped?.length > 0 || !ready) && (
          <ul className="yard-issues" id="yard-issues">
            {!ready && <li>The shop’s still opening.</li>}
            {checked.issues
              .filter((i) => ready || i.why !== 'unowned')
              .map((i) => (
                <li key={`${i.why}-${i.slot}-${i.id}`}>{i.slot ? `${RAIL_LABEL[i.slot]}: ${i.text}` : i.text}</li>
              ))}
            {dropped?.length > 0 && <li>Off for want of power now: {dropped.map((p) => p.name).join(', ')}.</li>}
          </ul>
        )}
        <p className="yard-note" aria-live="polite">
          {note ?? ' '}
        </p>

        <section className="yard-sect" aria-label="Changes">
          <h3>Changes</h3>
          {dirty ? (
            <ul className="yard-changes">
              {changes.map((c) => {
                const item = itemOfChange(c);
                const buying = item && toBuyKeys.has(item.key);
                return (
                  <li key={c.slot}>
                    <span>
                      {RAIL_LABEL[c.slot] ?? 'Hull'}: {nameOf(c)}
                    </span>
                    <span className="yard-change-price">{buying ? cr(item.price) : 'owned'}</span>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="yard-quiet">Pick parts on the left: nothing’s bought until you apply.</p>
          )}
        </section>

        <div className="universe-hangar-power" data-full={checked.power >= checked.capacity || undefined}>
          <span className="universe-hangar-label">Power</span>
          <span className="universe-hangar-cells" role="img" aria-label={`${checked.power} of ${checked.capacity} megawatts in use`}>
            {Array.from({ length: Math.max(checked.capacity, Math.ceil(checked.power)) }, (_, i) => (
              <i key={i} data-on={i < checked.power || undefined} data-over={i >= checked.capacity || undefined} />
            ))}
          </span>
          <span className="universe-hangar-num">
            {checked.power}/{checked.capacity} MW · {checked.mass} t
          </span>
        </div>

        <dl className="universe-hangar-stats">
          {now.map((r, i) => {
            const next = then?.[i];
            const diff = next ? next.change - r.change : 0;
            return (
              <div key={r.id} className="universe-hangar-stat">
                <dt>{READOUT_LABEL[r.id]}</dt>
                <dd>
                  <span className="universe-hangar-bar" style={{ '--now': r.bar, '--then': next ? next.bar : r.bar }} data-up={diff > 0 || undefined} data-down={diff < 0 || undefined}>
                    <i />
                    <b />
                  </span>
                  <span className="universe-hangar-change" data-up={diff > 0 || undefined} data-down={diff < 0 || undefined}>
                    {next && diff ? `${diff > 0 ? '+' : '−'}${Math.abs(diff)}%` : r.change ? `${r.change > 0 ? '+' : '−'}${Math.abs(r.change)}%` : 'Stock'}
                  </span>
                </dd>
              </div>
            );
          })}
        </dl>

        {wallet && (
          <p className="yard-wallet">
            <b>{cr(wallet.credits)}</b> · Level {wallet.level} · {wallet.title}
          </p>
        )}

        <section className="yard-sect" aria-label="Sell">
          <h3>Sell</h3>
          {sell.length ? (
            <ul className="yard-sell">
              {sell.map(({ item, refund }) => (
                <li key={item.key}>
                  <span>{item.name}</span>
                  <button
                    type="button"
                    data-sure={sure === item.key || undefined}
                    onClick={() => {
                      if (sure !== item.key) return setSure(item.key);
                      setSure(null);
                      onSell(item);
                      return undefined;
                    }}
                  >
                    {sure === item.key ? 'Sure?' : 'Sell'} · {cr(refund)}
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="yard-quiet">Nothing to sell: everything you own is fitted somewhere.</p>
          )}
        </section>

        <div className="yard-more">
          <button type="button" onClick={onRecord}>
            Record
          </button>
          {onCrew && crew && (
            <button type="button" onClick={onCrew} aria-haspopup="dialog">
              Dress {crew}
            </button>
          )}
        </div>
      </div>
    </aside>
  );
}
