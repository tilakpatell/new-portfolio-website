// alpha has a scene.js, so it's a world. It reaches into beta's props (a
// break), comes in through beta's index.js and shared/ (allowed), takes x's
// shared piece (allowed: x isn't a world), and imports an index.js deeper in
// beta, which isn't beta's own front door (a break)
import { props } from '../beta/props.js';
import { beta } from '../beta/index.js';
import { kit } from '../beta/shared/kit.js';
import { thing } from '../x/thing.js';
import { deep } from '../beta/sub';

export const alpha = [props, beta, kit, thing, deep];
