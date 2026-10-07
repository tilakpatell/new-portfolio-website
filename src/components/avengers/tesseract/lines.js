// What F.R.I.D.A.Y. says on the Tesseract run.

// as each leg starts: given whether you fly it with a keyboard (else by touch)
export const BRIEF = [
  (keys) => (keys ? 'I’m holding the hover until you take her. ↑ to lift the case, ← → to lean. Set it down on the pad, gently.' : 'I’m holding the hover until you take her. Hold THRUST to lift the case, lean with the arrows. Set it down on the pad, gently.'),
  () => 'Trees all the way. Climb first: the case hangs nine metres under you.',
  () => 'A headwind, gusting. Lean into it, and let the case stream back.',
  () => 'The gantry. About five metres between its girder and the case’s clearance. Keep the tail down.',
  () => 'The ridge. The wind pours over it and down the far side. Height first.',
  () => 'The storm’s on us. Under the hangar’s roof, and down on the pad inside.',
];

// and on the way
export const SAYS = {
  controls: 'Your controls now. Thrust, or she drops.',
  fuel: 'Fuel’s low. Get it down.',
  settling: 'Steady…',
};

// all of it, either way it's flown: what can be said in her own voice (lib/voiced.js)
export const SPOKEN = [...new Set([...BRIEF.flatMap((b) => [b(true), b(false)]), ...Object.values(SAYS)])];
