import type { Building } from "@build-manager/domain";
import type { ApplicationDependencies } from "../ports";

/**
 * Resets synthetic demo state through the `DemoStateResetter` port and returns
 * the reseeded buildings.
 *
 * The reset itself belongs to the server adapter: only that layer knows how
 * demo state is stored and which synthetic fixtures are canonical. This use
 * case adds no reset logic, so HTTP never reaches a repository or the fixture
 * package directly.
 */
export async function resetDemo(
  deps: ApplicationDependencies,
): Promise<Building[]> {
  return deps.demoState.reset();
}
