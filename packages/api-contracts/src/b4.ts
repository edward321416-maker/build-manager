import { z } from "zod";

export const B4AssignmentStateSchema = z.strictObject({ assigned: z.literal(true) });
export const B4ErrorSchema = z.strictObject({
  error: z.enum([
    "UNAUTHENTICATED", "FORBIDDEN", "NOT_FOUND", "INVALID_INPUT",
    "PAYLOAD_TOO_LARGE", "DEPENDENCY_UNAVAILABLE", "METHOD_NOT_ALLOWED",
  ]),
});
