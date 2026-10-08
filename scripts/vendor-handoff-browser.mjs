import { prepareVendorHandoff, startVendorHandoffServer } from './vendor-handoff-dev.mjs';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { fileURLToPath } from 'node:url';

let server;
try {
  if (process.env.BUILD_MANAGER_E2E_PREBUILT !== '1') {
    const build = spawn(process.execPath, [fileURLToPath(new URL('../node_modules/next/dist/bin/next', import.meta.url)), 'build'], {
      cwd: fileURLToPath(new URL('../apps/web', import.meta.url)), windowsHide: true, stdio: 'inherit',
    });
    if ((await once(build, 'exit'))[0] !== 0) throw new Error('BUILD_FAILED');
  }
  const prepared = await prepareVendorHandoff();
  server = await startVendorHandoffServer(prepared.state);
  process.send?.({ ready: true, file: prepared.file });
  const stop = async () => { await server.stop(); process.exit(); };
  process.on('message', message => { if (message === 'stop') void stop(); });
  process.on('disconnect', () => void stop());
} catch {
  await server?.stop();
  console.error('VENDOR_BROWSER_SETUP_FAILED | fresh owned synthetic fixture or build failed; private values withheld');
  process.exitCode = 1;
}
