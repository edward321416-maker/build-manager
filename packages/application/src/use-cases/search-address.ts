import type { AddressLookup, ApplicationDependencies } from "../ports";

export type SearchAddressInput = {
  query: string;
};

/**
 * Resolves an address through the `AddressProvider` port and returns whatever
 * it yields, including nothing. The application performs no lookup of its own
 * and never touches a repository for this.
 */
export async function searchAddress(
  deps: ApplicationDependencies,
  input: SearchAddressInput,
): Promise<AddressLookup | null> {
  return deps.addresses.lookup(input.query);
}
