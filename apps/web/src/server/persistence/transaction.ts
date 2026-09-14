/**
 * The slice of `DatabaseSync` a transaction needs. `isTransaction` is a
 * readonly boolean property on the runtime object, not a method.
 */
export type TransactionalDatabase = {
  readonly isTransaction: boolean;
  exec(sql: string): void;
};

/**
 * Runs `operation` inside a single immediate transaction.
 *
 * Nesting is refused rather than silently joining an outer transaction, since
 * a nested `COMMIT` would publish work the outer caller has not finished.
 *
 * When the operation fails the transaction is rolled back and the original
 * failure is rethrown. If the rollback also fails, both failures surface
 * together — the rollback failure never replaces the cause. These are internal
 * server errors and are not exposed through HTTP.
 */
export function withTransaction<T>(
  database: TransactionalDatabase,
  operation: () => T,
): T {
  if (database.isTransaction) {
    throw new Error(
      "Refusing to nest a transaction: a transaction is already open on this connection",
    );
  }

  database.exec("BEGIN IMMEDIATE");

  let result: T;
  try {
    result = operation();
  } catch (operationError) {
    if (database.isTransaction) {
      try {
        database.exec("ROLLBACK");
      } catch (rollbackError) {
        throw new AggregateError(
          [operationError, rollbackError],
          "Transaction rollback failed after an operation failure",
        );
      }
    }
    throw operationError;
  }

  database.exec("COMMIT");
  return result;
}
