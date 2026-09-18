import { z } from "zod";

/**
 * Public contract for `GET /api/v1/address/search`.
 *
 * Derived directly from what the offline address provider can return, and
 * nothing more. P0 resolves synthetic demo data only — no live registry
 * lookup, and no field that could carry a real resident or occupant.
 */
export const AddressSearchQuerySchema = z
  .object({
    query: z.string().trim().min(1),
  })
  .strict();
export type AddressSearchQuery = z.infer<typeof AddressSearchQuerySchema>;

export const AddressSearchResultDtoSchema = z
  .object({
    normalizedAddress: z.string().nullable(),
    jusoBdMgtSn: z.string().nullable(),
  })
  .strict();
export type AddressSearchResultDto = z.infer<
  typeof AddressSearchResultDtoSchema
>;

/** `result` is null when the query resolves to nothing. */
export const AddressSearchResponseSchema = z
  .object({
    result: AddressSearchResultDtoSchema.nullable(),
  })
  .strict();
export type AddressSearchResponse = z.infer<typeof AddressSearchResponseSchema>;
