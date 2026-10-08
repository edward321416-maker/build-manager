import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { resolve } from 'node:path';
export default async function setup() {
  const child = spawn(process.execPath, ['--experimental-transform-types', resolve('../../scripts/vendor-handoff-browser.mjs')], {
    cwd: process.cwd(), windowsHide: true, stdio: ['ignore', 'inherit', 'inherit', 'ipc'],
  });
  try {
    const file = await new Promise<string>((ok, no) => {
      const deadline = setTimeout(() => no(new Error('VENDOR_BROWSER_SETUP_DEADLINE')), 180000);
      child.once('message', (message: { ready?: boolean; file?: string }) => {
        clearTimeout(deadline); if (message.ready && message.file) ok(message.file); else no(new Error('VENDOR_BROWSER_SETUP_RECEIPT'));
      });
      child.once('exit', () => { clearTimeout(deadline); no(new Error('VENDOR_BROWSER_SETUP_EXIT')); });
      child.once('error', () => { clearTimeout(deadline); no(new Error('VENDOR_BROWSER_SETUP_PROCESS')); });
    });
    process.env.VENDOR_BROWSER_PRIVATE_STATE = file;
    process.env.PLAYWRIGHT_NO_COPY_PROMPT = '1';
    return async () => { if (child.exitCode === null) { const stopped = once(child, 'exit'); child.send('stop'); await stopped; } };
  } catch (error) { child.kill(); throw error; }
}
