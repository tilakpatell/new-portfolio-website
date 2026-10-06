import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { iconModule, rewriteImports, SPECIFIER } from './icons-apart.mjs';

describe('icons apart: each react-icons icon a module of its own', () => {
  it('sends every named import to its own icon', () => {
    const out = rewriteImports("import { RiCloseLine, RiMenuLine } from 'react-icons/ri';\nconst a = 1;");
    expect(out).toBe(`import { RiCloseLine } from '${SPECIFIER}ri/RiCloseLine'; import { RiMenuLine } from '${SPECIFIER}ri/RiMenuLine';\nconst a = 1;`);
  });

  it('keeps an alias', () => {
    expect(rewriteImports('import { RiCloseLine as Close } from "react-icons/ri"')).toBe(`import { RiCloseLine as Close } from '${SPECIFIER}ri/RiCloseLine';`);
  });

  it('keeps the line count of an import over several lines, so line numbers hold', () => {
    const src = "import {\n  RiA,\n  RiB,\n} from 'react-icons/ri';\nx();";
    const out = rewriteImports(src);
    expect(out.split('\n').length).toBe(src.split('\n').length);
    expect(out).toContain(`import { RiA } from '${SPECIFIER}ri/RiA';`);
    expect(out.endsWith('\nx();')).toBe(true);
  });

  it('leaves the same words in a string alone', () => {
    expect(rewriteImports("const s = \"import { RiA } from 'react-icons/ri'\";")).toBeNull();
  });

  it('leaves code without the library alone', () => {
    expect(rewriteImports("import { useState } from 'react';")).toBeNull();
  });

  it('cuts an icon out of the set as a module of its own', () => {
    // found as the plugin finds it, so a worktree without node_modules of its own still has it
    const set = readFileSync(createRequire(import.meta.url).resolve('react-icons/ri').replace(/index\.js$/, 'index.mjs'), 'utf8');
    const mod = iconModule(set, 'RiCloseLine');
    expect(mod).toMatch(/^import \{ GenIcon \} from 'react-icons\/lib';\n/);
    expect(mod).toContain('export function RiCloseLine (props)');
    expect(mod).not.toContain('RiCloseFill');
  });

  it('says which icon it could not find', () => {
    expect(() => iconModule('export function RiA (props) {\n  return GenIcon({})(props);\n};', 'RiNope')).toThrow(/RiNope/);
  });
});
