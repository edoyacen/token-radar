// token-radar-01: read the sealed snapshot, rank the protocols that still record no token by
// what their launch would be worth, and hand in the board, the page's data and the judge's dossier.
//
// Node 22, standard library only. The grader mounts the snapshot at /input and reads /output; a run
// on this machine passes --input and MAKEFUN_OUTPUT_DIR instead:
//
//   MAKEFUN_OUTPUT_DIR=out node main.ts --input ../input/snapshot.json

import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { boardIssue, buildRadar, dataScript, parseSnapshot } from './lib/model.ts';
import { buildDossier } from './vendor/makefun-board.ts';

/** The scorer's caps: what the dossier's text may carry, and what a screenshot may be. */
const TEXT_CAP = 65_536;
const SHOT_CAP = { max: 4, max_bytes: 524_288 };
const DASHBOARD_CAP = { max_files: 400, max_bytes: 4_194_304 };
const PLAIN_NAME = /^[A-Za-z0-9_][A-Za-z0-9._-]{0,127}$/;

const root = dirname(fileURLToPath(import.meta.url));

/** `--flag value` or `--flag=value` from the command line, else the fallback. */
function flag(name: string): string | null {
  const args = process.argv.slice(2);
  const withEquals = args.find((a) => a.startsWith(`--${name}=`));
  if (withEquals !== undefined) return withEquals.slice(name.length + 3);
  const at = args.indexOf(`--${name}`);
  return at >= 0 && at + 1 < args.length ? args[at + 1]! : null;
}

const inputRoot = flag('input') ?? process.env.MAKEFUN_INPUT_DIR ?? '/input';
const inputPath = inputRoot.endsWith('.json') ? inputRoot : join(inputRoot, 'snapshot.json');
if (!existsSync(inputPath)) {
  process.stderr.write(`token radar: no snapshot at ${inputPath}\n`);
  process.exit(2);
}

const outputRoot = flag('output') ?? process.env.MAKEFUN_OUTPUT_DIR ?? '/output';
mkdirSync(outputRoot, { recursive: true });

const snapshot = parseSnapshot(readFileSync(inputPath, 'utf8'));
const { board, radar } = buildRadar(snapshot);

const broken = boardIssue(board, snapshot);
if (broken !== null) {
  process.stderr.write(`token radar: the board fails the gate: ${broken}\n`);
  process.exit(1);
}

writeFileSync(join(outputRoot, 'board.json'), `${JSON.stringify({ rows: board })}\n`);
writeFileSync(join(outputRoot, 'data.js'), dataScript(radar));

/** Copy a directory's regular files, in name order, skipping dotfiles: the gate refuses them. */
function publish(from: string, into: string): string[] {
  if (!existsSync(from)) return [];
  mkdirSync(into, { recursive: true });
  const names: string[] = [];
  for (const name of readdirSync(from).sort()) {
    if (name.startsWith('.')) continue;
    const path = join(from, name);
    if (!statSync(path).isFile()) continue;
    copyFileSync(path, join(into, name));
    names.push(name);
  }
  return names;
}

publish(join(root, 'dashboard'), join(outputRoot, 'dashboard'));
const shots = publish(join(root, 'screenshots'), join(outputRoot, 'screenshots'));

if (shots.length < 3) {
  process.stderr.write(`token radar: ${shots.length} screenshot(s): the entry needs the board, a detail view and a filtered view\n`);
  process.exit(1);
}
for (const name of shots) {
  if (!PLAIN_NAME.test(name)) {
    process.stderr.write(`token radar: screenshots/${name}: a name is letters, digits and . _ -\n`);
    process.exit(1);
  }
}

// Written last, from the /output that now holds everything: the scorer rebuilds it and compares bytes.
writeFileSync(
  join(outputRoot, 'dossier.json'),
  buildDossier(outputRoot, { text_max_bytes: TEXT_CAP, screenshots: SHOT_CAP, dashboard: DASHBOARD_CAP }),
);

const top = board[0];
const last = board[board.length - 1];
process.stdout.write(
  `token radar: ${snapshot.protocols.length} protocols, ${snapshot.watchlist.length} on the watchlist, ` +
    `${board.length} ranked; rank 1 is ${top?.name ?? 'nobody'} at ${top?.implied_value_usd ?? 0} USD, ` +
    `rank ${last?.rank ?? 0} is ${last?.name ?? 'nobody'}\n` +
    `token radar: /output holds board.json, data.js, dashboard/, ${shots.length} screenshots and dossier.json\n`,
);
