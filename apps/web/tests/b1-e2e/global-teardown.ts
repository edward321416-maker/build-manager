import type { ChildProcess } from 'node:child_process';
export async function stopOwnedServer(server:ChildProcess){
 if(server.exitCode!==null)return;
 await new Promise<void>(resolve=>{server.once('exit',()=>resolve());server.kill();});
}
