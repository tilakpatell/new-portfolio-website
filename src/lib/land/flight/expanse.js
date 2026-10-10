// The Expanse as the flight's pure tables take it: rows, or a lookup from an
// id to a row. Its own file so the life tables need not load the planets'
// (and their noise) to read it.
//
//   expanseLookup(rows | (id) => row | null) → (id) => row | null

export const expanseLookup = (expanse) =>
  typeof expanse === 'function' ? expanse : (id) => expanse?.find((r) => r.id === id) ?? null;
