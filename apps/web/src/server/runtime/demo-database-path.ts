import { mkdirSync } from "node:fs";
import { dirname, isAbsolute, resolve, sep } from "node:path";

/**
 * Server-only. Deliberately not a `NEXT_PUBLIC_*` name: the database location
 * is not something the browser bundle should ever carry.
 */
export const DEMO_DATABASE_PATH_ENV = "BUILD_MANAGER_DB_PATH";

export const DEMO_DATABASE_DIRECTORY = ".build-manager-local";

export const DEMO_DATABASE_FILENAME = "demo.sqlite";

export type DemoDatabasePathOptions = {
  env?: Record<string, string | undefined>;
  cwd?: string;
};

const WEB_APP_MARKER = "/apps/web";

/**
 * Finds the web app root from whatever directory the process happens to run
 * in: the app itself, a directory inside it, or the repository root. The
 * default database path must not move depending on where npm was invoked.
 */
function webAppRoot(cwd: string): string {
  const normalized = cwd.split(sep).join("/").replace(/\/+$/, "");
  const index = normalized.lastIndexOf(WEB_APP_MARKER);

  if (index !== -1) {
    const after = normalized.slice(index + WEB_APP_MARKER.length);
    if (after === "" || after.startsWith("/")) {
      return normalized.slice(0, index + WEB_APP_MARKER.length);
    }
  }

  return `${normalized}${WEB_APP_MARKER}`;
}

/**
 * Resolves the local demo database file. Pure: it reads nothing from disk and
 * creates nothing, so importing a route module cannot touch the filesystem.
 *
 * `:memory:` is refused here because each HTTP request opens its own
 * container — an in-memory database would silently discard state between
 * requests rather than failing visibly.
 */
export function resolveDemoDatabasePath(
  options: DemoDatabasePathOptions = {},
): string {
  const env = options.env ?? process.env;
  const cwd = options.cwd ?? process.cwd();

  const configured = env[DEMO_DATABASE_PATH_ENV]?.trim() ?? "";

  if (configured.length > 0) {
    if (configured === ":memory:") {
      throw new Error(
        `${DEMO_DATABASE_PATH_ENV} must be a file path: an in-memory database would lose all state between request-scoped containers`,
      );
    }
    return isAbsolute(configured) ? configured : resolve(cwd, configured);
  }

  return resolve(webAppRoot(cwd), DEMO_DATABASE_DIRECTORY, DEMO_DATABASE_FILENAME);
}

/**
 * Creates the parent directory. Called when a request actually needs the
 * database, never at module import and never during a build.
 */
export function ensureDemoDatabaseDirectory(databasePath: string): void {
  mkdirSync(dirname(databasePath), { recursive: true });
}
