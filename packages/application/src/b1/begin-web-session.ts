import { B1Error } from "./errors";
import type { IdentitySessionPort } from "./ports";
export async function beginWebSession(port: Pick<IdentitySessionPort,"begin">, input: Parameters<IdentitySessionPort["begin"]>[0]) {
  if (!/^[a-f0-9]{64}$/.test(input.digest) || !input.identity.issuer || input.identity.issuer.length > 2048 || !input.identity.subject || input.identity.subject.length > 255 || !Number.isFinite(input.expiresAt.getTime())) throw new B1Error("INVALID_INPUT");
  return port.begin(input);
}
