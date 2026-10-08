import { keyTokens } from './keys';

// A control's keys as the guide draws them, and a table of them: the guide's
// panel and a world's basics (components/tour) both show them.

// 'hold F' → hold [F]
export function Keys({ keys }) {
  return (
    <span className="guide-keyset">
      {keyTokens(keys).map((t, i) =>
        t.word ? (
          <span key={i} className="guide-or">
            {t.word}
          </span>
        ) : (
          <kbd key={i} className={t.pointer ? 'kbd is-pointer' : 'kbd'}>
            {t.key}
          </kbd>
        ),
      )}
    </span>
  );
}

export function KeyTable({ rows, className = 'guide-keys' }) {
  return (
    <table className={className}>
      <tbody>
        {rows.map(([keys, does]) => (
          <tr key={keys + does}>
            <th scope="row">
              <Keys keys={keys} />
            </th>
            <td>{does}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
