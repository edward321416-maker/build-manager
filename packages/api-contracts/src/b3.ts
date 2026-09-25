import { z } from "zod";

function hasUnpairedSurrogate(value: string): boolean {
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (code >= 0xd800 && code <= 0xdbff) {
      const next = value.charCodeAt(index + 1);
      if (!(next >= 0xdc00 && next <= 0xdfff)) return true;
      index += 1;
    } else if (code >= 0xdc00 && code <= 0xdfff) {
      return true;
    }
  }
  return false;
}

function boundedOperatorText(maxCodePoints: number) {
  return z.string().superRefine((value, context) => {
    const length = Array.from(value).length;
    const invalid =
      value !== value.trim() ||
      length < 1 ||
      length > maxCodePoints ||
      /[\u0000-\u001f\u007f-\u009f]/u.test(value) ||
      hasUnpairedSurrogate(value);
    if (invalid) context.addIssue({ code: "custom", message: "INVALID_INPUT" });
  });
}

export const B3PropertyCreateSchema = z.strictObject({
  addressReference: boundedOperatorText(512),
});

export const B3UnitCreateSchema = z.strictObject({
  label: boundedOperatorText(80),
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
