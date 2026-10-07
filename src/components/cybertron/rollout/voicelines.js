// What Roll out's leaders say aloud, for scripts/voices to make in their
// voices (its README: "Whose lines"): Megatron's call to attack, and each
// side's motto when its run is won. Optimus's call has his own recording, and
// Bumblebee's is beeps. (The Cybertron world's bots are read by export-lines itself.)
import { CALL, LEADER, MOTTO } from './lines';

export const VOICELINES = [
  { who: LEADER.decepticon, text: CALL.decepticon },
  { who: LEADER.autobot, text: MOTTO.autobot },
  { who: LEADER.decepticon, text: MOTTO.decepticon },
];
