import { afterEach,expect,it,vi } from 'vitest';
import { withRequestContainer } from './request-container';
afterEach(()=>vi.unstubAllEnvs());
it.each(['B1','invalid',''])('R09 real v1 provider refuses %s before resolving SQLite path',async mode=>{
 vi.stubEnv('BUILD_MANAGER_MODE',mode);vi.stubEnv('BUILD_MANAGER_DB_PATH','relative-path-must-not-be-resolved');const operation=vi.fn();
 await expect(withRequestContainer(operation)).rejects.toThrow('DEMO_MODE_REQUIRED');expect(operation).not.toHaveBeenCalled();
});
