import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
const root = fileURLToPath(new URL('..', import.meta.url)), mode = process.argv[2];
if (!['core', 'sdk'].includes(mode)) throw new Error('CORE_BROWSER_MODE_REQUIRED');
async function run(args, cwd = root) {
  const child = spawn(process.execPath, args, { cwd, stdio: 'inherit', windowsHide: true });
  child.once('error', () => { console.error('CORE_BROWSER_PROCESS_FAILED'); });
  const [code] = await once(child, 'exit');
  if (code !== 0) process.exit(code ?? 1);
}
if (process.env.BUILD_MANAGER_E2E_PREBUILT !== '1') await run([resolve(root, 'node_modules/next/dist/bin/next'), 'build'], resolve(root, 'apps/web'));
await run(['--experimental-transform-types', resolve(root, 'scripts/core-flow-dev.mjs'), '--prepare']);
if (mode === 'sdk') await run(['--experimental-transform-types', resolve(root, 'scripts/core-flow-b1-dev.mjs'), '--prepare-synthetic-sdk']);
await run([resolve(root, 'node_modules/playwright/cli.js'), 'test', '--config', mode === 'sdk' ? 'playwright.core-login.config.ts' : 'playwright.core.config.ts', ...process.argv.slice(3)], resolve(root, 'apps/web'));
