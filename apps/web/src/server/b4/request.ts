import { B4Error } from "@build-manager/application";

export async function assertB4EmptyBody(request: Request): Promise<void> {
  const length = request.headers.get("content-length");
  if (length !== null) {
    const code = !/^\d+$/.test(length) ? "INVALID_INPUT"
      : Number(length)>8192 ? "PAYLOAD_TOO_LARGE" : null;
    if (code) {
      void request.body?.cancel().catch(() => {});
      throw new B4Error(code);
    }
  }
  if (!request.body) return;
  const reader = request.body.getReader();
  try {
    while (true) {
      const next = await reader.read();
      if (next.done) return;
      if (next.value.byteLength) {
        // Do not wait for an untrusted stream's cancellation acknowledgement.
        void reader.cancel().catch(() => {});
        throw new B4Error("INVALID_INPUT");
      }
    }
  } catch (error) {
    if (error instanceof B4Error) throw error;
    throw new B4Error("INVALID_INPUT");
  } finally { reader.releaseLock(); }
}
