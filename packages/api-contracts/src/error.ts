import { z } from "zod";

export const ApiErrorSchema = z
  .object({
    error: z
      .object({
        code: z.string().trim().min(1),
        message: z.string().trim().min(1),
        requestId: z.string().trim().min(1).optional(),
      })
      .strict(),
  })
  .strict();
export type ApiError = z.infer<typeof ApiErrorSchema>;
