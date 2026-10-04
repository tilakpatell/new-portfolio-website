import { local } from '../../../lib/hooks';
import { newCareer } from '../metherria/rules';

// Walt's career, as Metherria saves it: the world reads it to open places,
// and Saul's office spends it.
export const CAREER = 'tp-metherria';
export const readCareer = () => newCareer(local.get(CAREER, null));
