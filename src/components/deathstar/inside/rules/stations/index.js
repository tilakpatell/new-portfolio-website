// Every station the inside can be walked through, by id: what the start
// screen opens, `?station=` picks and a new game builds. The second Death
// Star’s rooms (ds2.js) are drawn up but not on this list yet, so the start
// screen keeps showing it as coming: it joins once its rooms are built in
// the scene (Task 4.2) and its stories written (Task 4.4), and that change
// moves ui/state.test.js’s two “not built yet” expectations with it.
//
//   STATIONS → { ds1 }

import { DS1 } from './ds1';

export const STATIONS = { ds1: DS1 };
