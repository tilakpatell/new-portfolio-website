import { useFun } from '../fun/FunProvider';
import { BACK, SCRIPTS } from '../fun/scripts';

// The one switch for language mode, the same wherever it appears: it reads the
// whole site in a script (`id`, or whichever the theme speaks), and once any
// script is on it says Back to English, in plain letters, and turns it off.
export default function ScriptToggle({ id, className = 'btn btn-ghost' }) {
  const { script, scriptName, setScript, toggleScript } = useFun();
  if (script) {
    return (
      <button type="button" className={`${className} ab-keep`} onClick={() => setScript(null)}>
        {BACK}
      </button>
    );
  }
  return (
    <button type="button" className={className} onClick={() => (id ? setScript(id) : toggleScript())}>
      Read the site in {id ? SCRIPTS[id].name : scriptName}
    </button>
  );
}
