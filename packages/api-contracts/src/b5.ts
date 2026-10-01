import { z } from "zod";
export const B5ErrorSchema = z.strictObject({
  error: z.enum(["UNAUTHENTICATED", "FORBIDDEN", "NOT_FOUND", "INVALID_INPUT", "CONFLICT",
    "PAYLOAD_TOO_LARGE", "DEPENDENCY_UNAVAILABLE", "METHOD_NOT_ALLOWED"]),
});
