// A bounty hunter (Fett): hunterRules.js's flight, alone (its faction's
// pack of one): the brain hands it over to the hunt (a `delegate` event).
export default function bounty(npc) {
  return { delegate: { via: 'hunt', faction: npc.faction } };
}
