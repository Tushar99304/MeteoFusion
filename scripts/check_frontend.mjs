/*
 * scripts/check_frontend.mjs — React/Vite frontend quality gate.
 *
 * Replaces the old inline-script render gate (which now covers the REFERENCE single-file page
 * frontend-old/ via scripts/check_frontend_render.mjs). This gate runs, in order:
 *   1. oxlint                       (0 errors required)
 *   2. tsc -b                       (zero TypeScript errors)
 *   3. vite build                   (production build of frontend/dist)
 *   4. vitest run                   (mapper unit tests over all 8 backend payload fixtures)
 *
 * Nothing here needs a running backend or network: the mapper tests use written-out backend
 * payloads (grounded, fallback, rejected->fallback, active alert, expired-not-active, alerts
 * unavailable, abstain, clarify). Run:  node scripts/check_frontend.mjs
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FE = path.join(ROOT, 'frontend');

function run(step, cmd, args) {
  const npx = process.platform === 'win32' ? 'npx.cmd' : 'npx';
  const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  const bin = cmd === 'npm' ? npm : npx;
  const finalArgs = cmd === 'npm' ? args : [cmd, ...args];
  console.log(`\n=== ${step} ===`);
  const res = spawnSync(bin, finalArgs, { cwd: FE, stdio: 'inherit' });
  if (res.status !== 0) {
    console.error(`✖ ${step} FAILED (exit ${res.status})`);
    process.exit(1);
  }
}

if (!fs.existsSync(path.join(FE, 'node_modules'))) {
  console.error('frontend/node_modules missing — run `npm install` in frontend/ first.');
  process.exit(1);
}

run('oxlint', 'oxlint', []);
run('typescript (tsc -b)', 'tsc', ['-b']);
run('vite build', 'vite', ['build']);
run('vitest (mapper tests over 8 fixtures)', 'vitest', ['run']);

console.log('\n✔ FRONTEND GATE PASSED: lint + types + build + 8-fixture mapper tests');
