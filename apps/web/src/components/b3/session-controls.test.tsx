import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { expect,it,vi } from 'vitest';
import { prepareB3Logout,SessionControls } from './session-controls';
it('renders the frozen logout form with current csrf',()=>{
 const html=renderToStaticMarkup(createElement(SessionControls,{csrf:'a'.repeat(64),onBeginLogout:()=>{}}));
 expect(html).toContain('action="/api/v2/session/logout"');expect(html).toContain('method="post"');expect(html).toContain('name="csrf"');expect(html).toContain('a'.repeat(64));
});
it('clears capability state and aborts before logout navigation',()=>{
 const abort=vi.fn(),clear=vi.fn();prepareB3Logout(abort,clear);expect(abort).toHaveBeenCalledOnce();expect(clear).toHaveBeenCalledOnce();
});
