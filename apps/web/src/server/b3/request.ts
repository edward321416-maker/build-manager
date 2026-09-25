import { B3Error } from "@build-manager/application";

const MAX_JSON_BYTES = 8192;

export async function readB3Json(request: Request): Promise<unknown> {
  const rawType = request.headers.get("content-type");
  if (!rawType) throw new B3Error("INVALID_INPUT");
  const parts = rawType.split(";").map(part => part.trim());
  if (parts[0].toLowerCase() !== "application/json") throw new B3Error("INVALID_INPUT");
  for (const parameter of parts.slice(1)) {
    const match = /^charset\s*=\s*"?([^"]+)"?$/i.exec(parameter);
    if (!match || !/^utf-?8$/i.test(match[1])) throw new B3Error("INVALID_INPUT");
  }
  if (!request.body) throw new B3Error("INVALID_INPUT");

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let bytes = 0;
  try {
    while (true) {
      const next = await reader.read();
      if (next.done) break;
      bytes += next.value.byteLength;
      if (bytes > MAX_JSON_BYTES) {
        await reader.cancel();
        throw new B3Error("PAYLOAD_TOO_LARGE");
      }
      chunks.push(next.value);
    }
  } catch (error) {
    if (error instanceof B3Error) throw error;
    throw new B3Error("INVALID_INPUT");
  }

  const merged = new Uint8Array(bytes);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.byteLength;
  }
  let text: string;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(merged);
  } catch {
    throw new B3Error("INVALID_INPUT");
  }
  if (!text) throw new B3Error("INVALID_INPUT");
  try {
    return JSON.parse(text);
  } catch {
    throw new B3Error("INVALID_INPUT");
  }
}
