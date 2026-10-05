// react-icons ships each set as one module of thousands of icons, and a
// module can only live in one chunk. Imported by the nav, the footer and a
// page alike, the whole set's module sat in the entry chunk with every icon
// any page on the site uses, so the first load carried icons for worlds the
// visitor might never open. This gives each icon a module of its own, cut out
// of the set's file at build time, so an icon goes only where it's drawn.
//
//   import { RiCloseLine } from 'react-icons/ri'
//     becomes
//   import { RiCloseLine } from 'virtual:react-icon/ri/RiCloseLine'
//
// and that module is the icon's own few lines from react-icons/ri/index.mjs.
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

export const SPECIFIER = 'virtual:react-icon/';
const RESOLVED = '\0react-icon/';
// an import statement, at the start of its line (so the same words in a
// string or a comment are left alone)
const IMPORT = /^import\s*\{([^}]*)\}\s*from\s*['"]react-icons\/(\w+)['"];?/gm;

// The code with every named import from a react-icons set sent to its icons'
// own modules, or null when there's nothing to change. An import over several
// lines keeps its line count, so line numbers in errors still point right.
export function rewriteImports(code) {
  if (!code.includes('react-icons/')) return null;
  let changed = false;
  const out = code.replace(IMPORT, (match, names, set) => {
    changed = true;
    const one = names
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
      .map((spec) => {
        const [name, alias] = spec.split(/\s+as\s+/);
        return `import { ${name}${alias ? ` as ${alias}` : ''} } from '${SPECIFIER}${set}/${name}';`;
      })
      .join(' ');
    return one + '\n'.repeat((match.match(/\n/g) ?? []).length);
  });
  return changed ? out : null;
}

// One icon's module, cut out of its set's source. Every icon in a set is
// generated the same way: `export function Name (props) { return GenIcon(…)(props); };`
export function iconModule(setSource, name) {
  const at = setSource.indexOf(`export function ${name} (props) {`);
  const end = at < 0 ? -1 : setSource.indexOf('\n};', at);
  if (at < 0 || end < 0) throw new Error(`icons-apart: no icon called ${name} in its react-icons set`);
  return `import { GenIcon } from 'react-icons/lib';\n${setSource.slice(at, end + 3)}\n`;
}

export default function iconsApart() {
  const require = createRequire(import.meta.url);
  const sets = new Map(); // each set's source, read once
  const setSource = (set) => {
    if (!sets.has(set)) sets.set(set, readFileSync(require.resolve(`react-icons/${set}`).replace(/index\.js$/, 'index.mjs'), 'utf8'));
    return sets.get(set);
  };
  return {
    name: 'icons-apart',
    enforce: 'pre',
    transform(code, id) {
      if (id.includes('/node_modules/') || !/\.[cm]?[jt]sx?$/.test(id.split('?')[0])) return null;
      const out = rewriteImports(code);
      return out === null ? null : { code: out, map: null };
    },
    resolveId(id) {
      return id.startsWith(SPECIFIER) ? RESOLVED + id.slice(SPECIFIER.length) : null;
    },
    load(id) {
      if (!id.startsWith(RESOLVED)) return null;
      const [set, name] = id.slice(RESOLVED.length).split('/');
      return iconModule(setSource(set), name);
    },
  };
}
