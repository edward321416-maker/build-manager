import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { expect,it } from 'vitest';
import { WorkspaceShell } from './workspace-shell';
it('R04 initial page shell exposes no protected record and waits for server authorization',()=>{
 const html=renderToStaticMarkup(createElement(WorkspaceShell));expect(html).toContain('접근 권한을 확인하고 있습니다');expect(html).not.toContain('Synthetic');expect(html).not.toContain('ORG_ADMIN');
});
