import { prepareVendorHandoff, startVendorHandoffServer } from './vendor-handoff-dev.mjs';
import { execFileSync, spawn } from 'node:child_process';
import { once } from 'node:events';
import { rmSync } from 'node:fs';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

let server, prepared;
// A browser run owns a fresh fixture, so it removes the container and its private folder when it ends.
// Left behind, they pile up across runs and add host load that slows timing-sensitive tests.
const dispose = async () => {
  try { await server?.stop(); } catch { /* already stopped */ }
  const left = [];
  if (prepared?.state?.containerId) { try { execFileSync('docker', ['rm', '-f', prepared.state.containerId], { stdio: 'ignore' }); } catch { left.push('container'); } }
  if (prepared?.file) { try { rmSync(dirname(prepared.file), { recursive: true, force: true, maxRetries: 5 }); } catch { left.push('private folder'); } }
  if (left.length) console.error(`VENDOR_BROWSER_CLEANUP_INCOMPLETE | ${left.join(', ')} left; remove it by hand`);
};
try {
  if (process.env.BUILD_MANAGER_E2E_PREBUILT !== '1') {
    const build = spawn(process.execPath, [fileURLToPath(new URL('../node_modules/next/dist/bin/next', import.meta.url)), 'build'], {
      cwd: fileURLToPath(new URL('../apps/web', import.meta.url)), windowsHide: true, stdio: 'inherit',
    });
    if ((await once(build, 'exit'))[0] !== 0) throw new Error('BUILD_FAILED');
  }
  prepared = await prepareVendorHandoff();
  server = await startVendorHandoffServer(prepared.state);
  process.send?.({ ready: true, file: prepared.file });
  let stopping;
  const stop = () => stopping ??= dispose().finally(() => process.exit());
  process.on('message', message => { if (message === 'stop') void stop(); });
  process.on('disconnect', () => void stop());
} catch {
  await dispose();
  console.error('VENDOR_BROWSER_SETUP_FAILED | fresh owned synthetic fixture or build failed; private values withheld');
  process.exitCode = 1;
}
