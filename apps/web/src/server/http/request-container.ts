import {
  createMemoryServerContainer,
  createSqliteServerContainer,
  type ServerContainer,
} from "../container";
import {
  ensureDemoDatabaseDirectory,
  resolveDemoDatabasePath,
} from "../runtime/demo-database-path";

export type ContainerProvider = <T>(
  operation: (container: ServerContainer) => Promise<T> | T,
) => Promise<T>;

/**
 * One request, one container lifecycle: open, run a single application
 * operation, close in `finally`.
 *
 * There is no module-global container and no pooling. That is deliberate for a
 * low-concurrency local contest demo, and it is not a claim about production
 * throughput.
 *
 * Nothing opens at module import — the database is touched only when the
 * returned provider is actually invoked, so importing a route module or
 * running a build never creates a file.
 */
export function createSqliteContainerProvider(
  resolvePath: () => string = () => resolveDemoDatabasePath(),
): ContainerProvider {
  return async (operation) => {
    const databasePath = resolvePath();
    ensureDemoDatabaseDirectory(databasePath);

    const container = createSqliteServerContainer({ databasePath });
    try {
      return await operation(container);
    } finally {
      container.close();
    }
  };
}

/** Production provider for the route handlers. */
export const withRequestContainer: ContainerProvider =
  createSqliteContainerProvider();

/**
 * Test provider. Keeps one container alive across calls so a test can model
 * several requests against the same store without touching the local default
 * database or mutating process environment.
 */
export function createMemoryContainerProvider(): ContainerProvider & {
  dispose(): void;
} {
  const container = createMemoryServerContainer();

  const provider = (async (operation) =>
    operation(container)) as ContainerProvider & { dispose(): void };
  provider.dispose = () => container.close();

  return provider;
}
