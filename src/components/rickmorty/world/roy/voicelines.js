// What Roy says himself on his life's cards (./rules.js), as Roy.jsx passes
// it to sayVoiced, for scripts/voices to make in his voice.

import { ROY_SAYS } from './rules';

export const VOICELINES = ROY_SAYS.map((text) => ({ who: 'roy', text }));
