import { readdir, readFile } from "node:fs/promises";
import { join, relative, sep } from "node:path";

export type ImportBoundaryFinding = {
  file: string;
  specifier: string;
  rule: "client-server-core" | "server-core-purity";
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

  for (const file of files) {
    const client = isClientFile(file);
    const serverCore = isServerCoreFile(file);
    if (!client && !serverCore) {
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
      }
    }
  }

  return findings.sort(compareFindings);
}
