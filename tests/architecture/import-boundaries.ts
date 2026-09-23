import { readdir, readFile } from "node:fs/promises";
import { join, relative, sep } from "node:path";
import { scanProxyTransport } from './b1-graph';

export type ImportBoundaryFinding = {
  file: string;
  specifier: string;
  rule:
    | "client-server-core"
    | "server-core-purity"
    | "api-client-purity"
    | "server-driver-isolation"
    | "proxy-transport";
};

export type RouteRuntimeFinding = {
  file: string;
  rule: "edge-runtime-forbidden" | "missing-node-runtime" | "missing-dynamic";
};

export type DependencyFinding = {
  package: string;
  dependency: string;
  rule: "dependency-allowlist";
};

const SCANNED_ROOTS = ["apps", "packages"];

const SOURCE_EXTENSIONS = [".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"];

const IGNORED_DIRECTORIES = new Set([
  ".expo",
  ".git",
  ".next",
  ".omc",
  ".turbo",
  "build",
  "coverage",
  "dist",
  "node_modules",
  "playwright-report",
  "test-results",
]);

/** Web paths that run on the server and may therefore use the server core. */
const SERVER_WEB_PREFIXES = ["apps/web/src/server/", "apps/web/src/app/api/"];

const SERVER_CORE_PACKAGE = /^@build-manager\/(application|domain|fixtures)(\/|$)/;

const SERVER_CORE_PATH = /(^|\/)packages\/(application|domain|fixtures)(\/|$)/;

/**
 * Modules that would tie the framework-independent server core to a UI
 * framework, a native runtime, transport, the ambient environment, or storage.
 */
const IMPURE_CORE_MODULES = [
  // Synthetic demo data is a server-adapter concern, never a core rule input.
  "@build-manager/fixtures",
  "next",
  "react",
  "react-dom",
  "expo",
  "expo-router",
  "react-native",
  "axios",
  "http",
  "https",
  "node-fetch",
  "node:http",
  "node:https",
  "node:net",
  "undici",
  "dotenv",
  "node:os",
  "node:process",
  "process",
  "better-sqlite3",
  "drizzle-orm",
  "fs",
  "node:fs",
  "node:sqlite",
];

/**
 * The typed HTTP client ships to both browsers and React Native, so it may not
 * reach the server core and may not bind itself to any platform framework.
 */
const API_CLIENT_FORBIDDEN_MODULES = [
  "react",
  "react-dom",
  "react-native",
  "next",
  "expo",
  "drizzle-orm",
];

/**
 * The local persistence driver belongs to the web server tree alone. Every
 * other scanned location — clients, published packages, the server core — must
 * not reach it, directly or through the persistence directory.
 */
const SERVER_DRIVER_MODULES = ["node:sqlite"];

const SERVER_PERSISTENCE_PATH = /(^|\/)server\/persistence(\/|$)/;

/**
 * Any reach into the web server tree from browser-facing code, whether through
 * the `@/` alias or a relative path.
 */
const SERVER_TREE_SPECIFIER = /(^|\/)server\/|^@\/server($|\/)/;

const SERVER_TREE_PREFIX = "apps/web/src/server/";

/** Runtime `dependencies` each package is allowed to declare. */
const RUNTIME_DEPENDENCY_ALLOWLIST: Record<string, readonly string[]> = {
  "packages/api-client": ["@build-manager/api-contracts"],
};

const SPECIFIER_PATTERNS = [
  /\bfrom\s*["']([^"'\n]+)["']/g,
  /\bimport\s+["']([^"'\n]+)["']/g,
  /\bimport\s*\(\s*["']([^"'\n]+)["']/g,
  /\brequire\s*\(\s*["']([^"'\n]+)["']/g,
];

function isSourceFile(name: string): boolean {
  return SOURCE_EXTENSIONS.some((extension) => name.endsWith(extension));
}

async function collectSourceFiles(
  repositoryRoot: string,
  directory: string,
  found: string[],
): Promise<void> {
  let entries;
  try {
    entries = await readdir(directory, { withFileTypes: true });
  } catch {
    return;
  }

  for (const entry of entries) {
    const absolutePath = join(directory, entry.name);
    if (entry.isDirectory()) {
      if (IGNORED_DIRECTORIES.has(entry.name)) {
        continue;
      }
      await collectSourceFiles(repositoryRoot, absolutePath, found);
      continue;
    }
    if (entry.isFile() && isSourceFile(entry.name)) {
      found.push(relative(repositoryRoot, absolutePath).split(sep).join("/"));
    }
  }
}

/** Drops comments while leaving string literals — including escapes — intact. */
function withoutComments(source: string): string {
  let result = "";
  let index = 0;
  let quote: string | null = null;

  while (index < source.length) {
    const character = source[index];
    const following = source[index + 1];

    if (quote !== null) {
      if (character === "\\") {
        result += character + (following ?? "");
        index += 2;
        continue;
      }
      if (character === quote) {
        quote = null;
      }
      result += character;
      index += 1;
      continue;
    }

    if (character === '"' || character === "'" || character === "`") {
      quote = character;
      result += character;
      index += 1;
      continue;
    }

    if (character === "/" && following === "/") {
      while (index < source.length && source[index] !== "\n") {
        index += 1;
      }
      continue;
    }

    if (character === "/" && following === "*") {
      index += 2;
      while (
        index < source.length &&
        !(source[index] === "*" && source[index + 1] === "/")
      ) {
        index += 1;
      }
      index += 2;
      continue;
    }

    result += character;
    index += 1;
  }

  return result;
}

function readSpecifiers(source: string): string[] {
  const code = withoutComments(source);
  const specifiers = new Set<string>();

  for (const pattern of SPECIFIER_PATTERNS) {
    pattern.lastIndex = 0;
    let match = pattern.exec(code);
    while (match !== null) {
      specifiers.add(match[1]);
      match = pattern.exec(code);
    }
  }

  return [...specifiers];
}

function isClientFile(file: string): boolean {
  if (file.startsWith("apps/mobile/")) {
    return true;
  }
  if (!file.startsWith("apps/web/")) {
    return false;
  }
  return !SERVER_WEB_PREFIXES.some((prefix) => file.startsWith(prefix));
}

function isServerCoreFile(file: string): boolean {
  return (
    file.startsWith("packages/application/") ||
    file.startsWith("packages/domain/")
  );
}

function reachesServerCore(specifier: string): boolean {
  if (SERVER_CORE_PACKAGE.test(specifier)) {
    return true;
  }
  return specifier.startsWith(".") && SERVER_CORE_PATH.test(specifier);
}

function breaksCorePurity(specifier: string): boolean {
  return IMPURE_CORE_MODULES.some(
    (module) => specifier === module || specifier.startsWith(`${module}/`),
  );
}

function isServerTreeFile(file: string): boolean {
  return file.startsWith(SERVER_TREE_PREFIX);
}

function isPublishedContractFile(file: string): boolean {
  return file.startsWith("packages/api-contracts/");
}

/**
 * Route handlers may use the application layer, but must reach persistence
 * only through the server HTTP helpers and the request container.
 */
function isApiRouteFile(file: string): boolean {
  return file.startsWith("apps/web/src/app/api/");
}

function usesServerDriver(specifier: string): boolean {
  if (
    SERVER_DRIVER_MODULES.some(
      (module) => specifier === module || specifier.startsWith(`${module}/`),
    )
  ) {
    return true;
  }
  return SERVER_PERSISTENCE_PATH.test(specifier);
}

/**
 * Any reach into the web server tree. Applied to browser-facing code only:
 * route handlers legitimately use the server HTTP helpers.
 */
function reachesServerTree(specifier: string): boolean {
  return (
    (specifier.startsWith("@/") || specifier.startsWith(".")) &&
    SERVER_TREE_SPECIFIER.test(specifier)
  );
}

function isApiClientFile(file: string): boolean {
  return file.startsWith("packages/api-client/");
}

/** Also matches sibling packages such as `expo-router` and `next-auth`. */
function breaksApiClientPurity(specifier: string): boolean {
  if (reachesServerCore(specifier)) {
    return true;
  }
  return API_CLIENT_FORBIDDEN_MODULES.some(
    (module) =>
      specifier === module ||
      specifier.startsWith(`${module}/`) ||
      specifier.startsWith(`${module}-`),
  );
}

function compareFindings(
  left: ImportBoundaryFinding,
  right: ImportBoundaryFinding,
): number {
  if (left.file !== right.file) {
    return left.file < right.file ? -1 : 1;
  }
  if (left.specifier !== right.specifier) {
    return left.specifier < right.specifier ? -1 : 1;
  }
  return 0;
}

export async function scanImportBoundaries(
  repositoryRoot: string,
): Promise<ImportBoundaryFinding[]> {
  const files: string[] = [];
  for (const root of SCANNED_ROOTS) {
    await collectSourceFiles(repositoryRoot, join(repositoryRoot, root), files);
  }

  const findings: ImportBoundaryFinding[] = [];
  findings.push(...await scanProxyTransport(repositoryRoot));

  for (const file of files) {
    if(file==='apps/web/src/proxy.ts')continue;
    const client = isClientFile(file);
    const serverCore = isServerCoreFile(file);
    const apiClient = isApiClientFile(file);
    const serverTree = isServerTreeFile(file);
    const publishedContract = isPublishedContractFile(file);
    const apiRoute = isApiRouteFile(file);
    if (
      !client &&
      !serverCore &&
      !apiClient &&
      !serverTree &&
      !publishedContract &&
      !apiRoute
    ) {
      continue;
    }

    let source: string;
    try {
      source = await readFile(join(repositoryRoot, ...file.split("/")), "utf8");
    } catch {
      continue;
    }

    for (const specifier of readSpecifiers(source)) {
      if (client && reachesServerCore(specifier)) {
        findings.push({ file, specifier, rule: "client-server-core" });
        continue;
      }
      if (serverCore && breaksCorePurity(specifier)) {
        findings.push({ file, specifier, rule: "server-core-purity" });
        continue;
      }
      if (apiClient && breaksApiClientPurity(specifier)) {
        findings.push({ file, specifier, rule: "api-client-purity" });
        continue;
      }
      if (!serverTree && usesServerDriver(specifier)) {
        findings.push({ file, specifier, rule: "server-driver-isolation" });
        continue;
      }
      if (client && reachesServerTree(specifier)) {
        findings.push({ file, specifier, rule: "server-driver-isolation" });
      }
    }
  }

  return findings.sort(compareFindings);
}

function compareDependencyFindings(
  left: DependencyFinding,
  right: DependencyFinding,
): number {
  if (left.package !== right.package) {
    return left.package < right.package ? -1 : 1;
  }
  if (left.dependency !== right.dependency) {
    return left.dependency < right.dependency ? -1 : 1;
  }
  return 0;
}

/**
 * Guards the runtime dependency surface of published packages. Source imports
 * alone are not enough: a manifest can pull a forbidden package into every
 * consumer's install even when no source file imports it yet.
 *
 * Only `dependencies` are checked; dev and test tooling follows the workspace
 * convention.
 */
export async function scanPackageDependencies(
  repositoryRoot: string,
): Promise<DependencyFinding[]> {
  const findings: DependencyFinding[] = [];

  for (const [packagePath, allowed] of Object.entries(
    RUNTIME_DEPENDENCY_ALLOWLIST,
  )) {
    const manifestPath = join(
      repositoryRoot,
      ...packagePath.split("/"),
      "package.json",
    );

    let raw: string;
    try {
      raw = await readFile(manifestPath, "utf8");
    } catch {
      continue;
    }

    const manifest = JSON.parse(raw) as {
      dependencies?: Record<string, string>;
    };

    for (const dependency of Object.keys(manifest.dependencies ?? {})) {
      if (!allowed.includes(dependency)) {
        findings.push({
          package: packagePath,
          dependency,
          rule: "dependency-allowlist",
        });
      }
    }
  }

  return findings.sort(compareDependencyFindings);
}

const API_ROUTE_PREFIX = "apps/web/src/app/api/";

const NODE_RUNTIME = /export\s+const\s+runtime\s*=\s*["']nodejs["']/;
const EDGE_RUNTIME = /export\s+const\s+runtime\s*=\s*["'][^"']*edge[^"']*["']/i;
const FORCE_DYNAMIC = /export\s+const\s+dynamic\s*=\s*["']force-dynamic["']/;

/**
 * Guards the runtime configuration of every `/api` route handler.
 *
 * The local persistence adapter is a native Node addon, so an Edge route could
 * not open it at all, and the API serves mutable demo state, so caching it
 * would be wrong. Both are declared explicitly rather than left to framework
 * defaults that could change.
 */
export async function scanRouteRuntimes(
  repositoryRoot: string,
): Promise<RouteRuntimeFinding[]> {
  const files: string[] = [];
  await collectSourceFiles(
    repositoryRoot,
    join(repositoryRoot, ...API_ROUTE_PREFIX.split("/").filter(Boolean)),
    files,
  );

  const findings: RouteRuntimeFinding[] = [];

  for (const file of files) {
    if (!file.endsWith("/route.ts") && !file.endsWith("/route.tsx")) {
      continue;
    }

    let source: string;
    try {
      source = await readFile(join(repositoryRoot, ...file.split("/")), "utf8");
    } catch {
      continue;
    }

    const code = withoutComments(source);

    if (EDGE_RUNTIME.test(code)) {
      findings.push({ file, rule: "edge-runtime-forbidden" });
      continue;
    }
    if (!NODE_RUNTIME.test(code)) {
      findings.push({ file, rule: "missing-node-runtime" });
    }
    if (!FORCE_DYNAMIC.test(code)) {
      findings.push({ file, rule: "missing-dynamic" });
    }
  }

  return findings.sort((left, right) =>
    left.file === right.file
      ? left.rule < right.rule
        ? -1
        : left.rule > right.rule
          ? 1
          : 0
      : left.file < right.file
        ? -1
        : 1,
  );
}
