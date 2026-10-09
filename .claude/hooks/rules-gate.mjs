#!/usr/bin/env node
// Claude Code hook (work rules v1, operator decisions 2026-10-09 and 2026-10-10): before design,
// development, research or reference work, the matching rulebook must have been read in full in the
// same session. `.claude/rules-gate.json` of the repository that contains the edited file (or the
// session cwd) lists each rulebook with the edit globs, tools and commands it covers.
//   record  PostToolUse, matcher Read: remember the hash of a fully read rulebook for the session.
//   check   PreToolUse, matcher Edit|Write|MultiEdit|NotebookEdit|WebSearch|WebFetch|Bash|PowerShell:
//           exit 2 while a required rulebook is unread or changed since it was read.
// A rulebook file that does not exist yet is skipped. Unexpected errors fail open (exit 0 with a
// warning) so a broken environment cannot block all work. Never place rules-gate.json in ~/.claude:
// every path under the home folder would then count as a rules repository.
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative, resolve, sep } from "node:path";

const CONFIG = [".claude", "rules-gate.json"];
const EDIT_TOOLS = new Set(["Edit", "Write", "MultiEdit", "NotebookEdit"]);
const SHELL_TOOLS = new Set(["Bash", "PowerShell"]);
// Windows paths are case-insensitive, so matching and state keys are too.
const FOLD = process.platform === "win32";

function findRoot(start) {
  for (let dir = resolve(start); ; dir = dirname(dir)) {
    if (existsSync(join(dir, ...CONFIG))) return dir;
    if (dirname(dir) === dir) return null;
  }
}
const posix = (root, path) => relative(root, resolve(path)).split(sep).join("/");
const digest = (file) => createHash("sha256").update(readFileSync(file)).digest("hex");
const escapeRegExp = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** `**` crosses folders, `*` and `?` do not, `{a,b}` is a choice; matched against repo-relative paths. */
function globToRegExp(glob) {
  let source = "";
  for (let i = 0; i < glob.length; i++) {
    const c = glob[i];
    const close = c === "{" ? glob.indexOf("}", i) : -1;
    if (c === "*" && glob[i + 1] === "*") {
      const folders = glob[i + 2] === "/";
      source += folders ? "(?:.*/)?" : ".*";
      i += folders ? 2 : 1;
    } else if (c === "*") source += "[^/]*";
    else if (c === "?") source += "[^/]";
    else if (close > i) {
      source += `(?:${glob.slice(i + 1, close).split(",").map(escapeRegExp).join("|")})`;
      i = close;
    } else source += escapeRegExp(c);
  }
  return new RegExp(`^${source}$`, FOLD ? "i" : "");
}

function loadRules(root) {
  const config = JSON.parse(readFileSync(join(root, ...CONFIG), "utf8"));
  const commands = config.commands ?? {};
  return config.rules.map((rule) => ({
    name: rule.name,
    file: rule.file,
    path: join(root, ...rule.file.split("/")),
    edit: (rule.edit ?? []).map(globToRegExp),
    exclude: (rule.exclude ?? []).map(globToRegExp),
    tools: rule.tools ?? [],
    commands: (rule.commands ?? []).map((name) => {
      if (typeof commands[name] !== "string") throw new Error(`unknown command set ${name}`);
      return new RegExp(commands[name]);
    }),
  }));
}

function stateFile(session) {
  if (typeof session !== "string" || !session) throw new Error("session_id missing");
  const dir = join(tmpdir(), "build-manager-rules-gate");
  mkdirSync(dir, { recursive: true });
  return join(dir, session.replace(/[^A-Za-z0-9_-]/g, "_") + ".json");
}
const stateKey = (file) => (FOLD ? file.toLowerCase() : file);
const loadState = (file) => (existsSync(file) ? JSON.parse(readFileSync(file, "utf8")) : {});

function record(input) {
  const path = input.tool_input?.file_path;
  if (input.tool_name !== "Read" || typeof path !== "string") return 0;
  if (input.tool_input.offset != null || input.tool_input.limit != null) return 0;
  const root = findRoot(dirname(resolve(path)));
  if (!root) return 0;
  const target = stateKey(posix(root, path));
  const rule = loadRules(root).find((candidate) => stateKey(candidate.file) === target);
  if (!rule || !existsSync(rule.path)) return 0;
  const file = stateFile(input.session_id);
  writeFileSync(file, JSON.stringify({ ...loadState(file), [stateKey(rule.path)]: digest(rule.path) }));
  return 0;
}

/** Where to look for the repository, and which rules the call needs once it is found. */
function target(input) {
  const { tool_name: tool, tool_input: args = {} } = input;
  if (EDIT_TOOLS.has(tool)) {
    const path = args.file_path ?? args.notebook_path;
    if (typeof path !== "string") return null;
    return {
      start: dirname(resolve(path)),
      label: (root) => posix(root, path),
      needs: (rule, root) => {
        const relativePath = posix(root, path);
        return rule.edit.some((re) => re.test(relativePath)) && !rule.exclude.some((re) => re.test(relativePath));
      },
    };
  }
  if (typeof input.cwd !== "string") return null;
  if (SHELL_TOOLS.has(tool)) {
    const command = String(args.command ?? "");
    return { start: input.cwd, label: () => command.slice(0, 80), needs: (rule) => rule.commands.some((re) => re.test(command)) };
  }
  return { start: input.cwd, label: () => tool, needs: (rule) => rule.tools.includes(tool) };
}

function check(input) {
  const call = target(input);
  if (!call) return 0;
  const root = findRoot(call.start);
  if (!root) return 0;
  const required = loadRules(root).filter((rule) => call.needs(rule, root) && existsSync(rule.path));
  if (required.length === 0) return 0;
  const state = loadState(stateFile(input.session_id));
  const unread = required.filter((rule) => state[stateKey(rule.path)] !== digest(rule.path));
  if (unread.length === 0) return 0;
  process.stderr.write(
    `작업 전에 다음 규칙을 전체 읽어야 합니다: ${unread.map((rule) => `${rule.name}(${rule.file})`).join(", ")}. ` +
      "Read 도구로 offset·limit 없이 끝까지 읽은 뒤 다시 시도하세요. 규칙 파일이 바뀌면 다시 읽어야 합니다. " +
      `(대상: ${call.label(root)})\n`,
  );
  return 2;
}

let raw = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", (chunk) => (raw += chunk));
process.stdin.on("end", () => {
  let code = 0;
  try {
    const mode = process.argv[2];
    if (mode !== "record" && mode !== "check") throw new Error("mode must be record or check");
    code = (mode === "record" ? record : check)(JSON.parse(raw));
  } catch (error) {
    process.stderr.write(`rules-gate: skipped (${error instanceof Error ? error.message : String(error)})\n`);
    code = 0;
  }
  process.exit(code);
});
