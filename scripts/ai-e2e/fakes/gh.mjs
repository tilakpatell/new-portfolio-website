// The fake GitHub CLI (GH_BIN pointing here): what scripts/desktop/lib.mjs
// runs in place of `gh` in a contract test. It writes down every call and
// answers from fixtures, so a runner's issues, labels, comments and pull
// requests are checked without touching GitHub.
//
//   GH_LOG       a JSON file: the array of every call's argv, appended to
//   GH_FIXTURES  a folder of answers, one JSON file per command:
//                <first>-<second>.json (pr-list.json, pr-create.json, label-list.json, issue-view.json),
//                api.json (an object keyed by the path asked, or a path's tail: "issues/1")
//                A string is printed as it is (a URL); anything else as JSON.
//                No fixture: nothing printed, as gh prints nothing for a comment or an edit.
//   GH_FAIL      a command to fail ("pr-create"): exit 1, as gh does when GitHub says no

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

export function answer(argv, fixtures) {
  const read = (name) => {
    const f = join(fixtures ?? '', `${name}.json`);
    return fixtures && existsSync(f) ? JSON.parse(readFileSync(f, 'utf8')) : undefined;
  };
  if (argv[0] === 'api') {
    const path = argv.find((a, i) => i > 0 && !a.startsWith('-') && !['-q', '--jq', '-X', '--method', '-f', '-F'].includes(argv[i - 1]));
    const table = read('api') ?? {};
    const key = Object.keys(table).find((k) => k === path) ?? Object.keys(table).find((k) => path?.endsWith(k));
    return key === undefined ? undefined : table[key];
  }
  return read(`${argv[0]}-${argv[1]}`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const argv = process.argv.slice(2);
  if (process.env.GH_LOG) {
    const calls = existsSync(process.env.GH_LOG) ? JSON.parse(readFileSync(process.env.GH_LOG, 'utf8')) : [];
    calls.push(argv);
    writeFileSync(process.env.GH_LOG, JSON.stringify(calls, null, 1));
  }
  if (process.env.GH_FAIL && process.env.GH_FAIL.split(',').includes(`${argv[0]}-${argv[1]}`)) {
    console.error(`fake gh: ${argv[0]} ${argv[1]} refused, as asked`);
    process.exit(1);
  }
  const a = answer(argv, process.env.GH_FIXTURES);
  if (a !== undefined) process.stdout.write(typeof a === 'string' ? `${a}\n` : JSON.stringify(a));
}
