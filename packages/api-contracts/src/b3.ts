import { z } from "zod";

export const B3PropertyCreateSchema = z.strictObject({
  addressReference: z.string(),
});

export const B3UnitCreateSchema = z.strictObject({
  label: z.string(),
});

export const B3UnitSchema = z.strictObject({
  id: z.uuid(),
  orgId: z.uuid(),
  propertyId: z.uuid(),
  label: z.string(),
});

export const B3UnitPageSchema = z.strictObject({
  items: z.array(B3UnitSchema),
  nextCursor: z.uuid().nullable(),
});

export const B3ErrorSchema = z.strictObject({
  error: z.enum([
    "UNAUTHENTICATED",
    "FORBIDDEN",
    "NOT_FOUND",
    "INVALID_INPUT",
    "CONFLICT",
    "PAYLOAD_TOO_LARGE",
    "DEPENDENCY_UNAVAILABLE",
    "METHOD_NOT_ALLOWED",
  ]),
});

export type B3Unit = z.infer<typeof B3UnitSchema>;
