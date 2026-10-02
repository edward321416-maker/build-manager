import { B5Error } from "@build-manager/application";
export async function assertB5EmptyBody(request: Request): Promise<void> {
  const length=request.headers.get("content-length");
  if(length!==null) {
    const code=!/^\d+$/.test(length)?"INVALID_INPUT":Number(length)>8192?"PAYLOAD_TOO_LARGE":null;
    if(code) {void request.body?.cancel().catch(()=>{});throw new B5Error(code);}
  }
  if(!request.body) return;
  const reader=request.body.getReader();
  try {
    while(true) {
      const next=await reader.read();
      if(next.done) return;
      if(next.value.byteLength) {void reader.cancel().catch(()=>{});throw new B5Error("INVALID_INPUT");}
    }
  } catch(error) {
    if(error instanceof B5Error) throw error;
    throw new B5Error("INVALID_INPUT");
  } finally {reader.releaseLock();}
}
