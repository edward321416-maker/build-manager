import { z } from "zod";
export const B1PageQuerySchema = z.strictObject({
  after: z.uuid().optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});
export const B1OrganizationSchema = z.strictObject({ id: z.uuid(), displayName: z.string() });
export const B1PropertySchema = z.strictObject({ id: z.uuid(), orgId: z.uuid(), addressReference: z.string().nullable() });
export const B1OrganizationPageSchema = z.strictObject({ items: z.array(B1OrganizationSchema), nextCursor: z.uuid().nullable() });
export const B1PropertyPageSchema = z.strictObject({ items: z.array(B1PropertySchema), nextCursor: z.uuid().nullable() });
export const B1SessionSchema = z.strictObject({ csrf: z.string().min(1) });
export const B1ErrorSchema = z.strictObject({ error: z.enum(["UNAUTHENTICATED", "NOT_FOUND", "INVALID_INPUT", "DEPENDENCY_UNAVAILABLE", "AUTHENTICATION_REJECTED", "FORBIDDEN"]) });
export type B1Organization = z.infer<typeof B1OrganizationSchema>;
export type B1Property = z.infer<typeof B1PropertySchema>;
