#!/usr/bin/env node
// Claude Code hook (design rules v1, operator decision 2026-10-09): UI files of a repository that has
// design/DESIGN_RULES.md may be edited only after the whole rules file was read in the same session.
//   record  PostToolUse, matcher Read: remember the hash of a fully read rules file for the session.
//   check   PreToolUse, matcher Edit|Write|MultiEdit|NotebookEdit: exit 2 while the current rules are unread.
// Unexpected errors fail open (exit 0 with a warning) so a broken environment cannot block all editing.
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative, resolve, sep } from "node:path";

const RULES = "design/DESIGN_RULES.md";
const UI_FILE = /^apps\/(?:web\/src\/(?:app|components)\/.+\.(?:tsx|css)|mobile\/src\/.+\.tsx)$/;
const TEST_FILE = /\.(?:test|spec)\.tsx$/;

function rulesRoot(path) {
  for (let dir = dirname(resolve(path)); ; dir = dirname(dir)) {
    if (existsSync(join(dir, ...RULES.split("/")))) return dir;
    if (dirname(dir) === dir) return null;
  }
}
const posix = (root, path) => relative(root, resolve(path)).split(sep).join("/");
const digest = (file) => createHash("sha256").update(readFileSync(file)).digest("hex");
function stateFile(session) {
  if (typeof session !== "string" || !session) throw new Error("session_id missing");
  const dir = join(tmpdir(), "build-manager-design-rules");
  mkdirSync(dir, { recursive: true });
  return join(dir, session.replace(/[^A-Za-z0-9_-]/g, "_") + ".json");
}
// Windows paths are case-insensitive, so the state key is too.
const stateKey = (rules) => (process.platform === "win32" ? rules.toLowerCase() : rules);
const loadState = (file) => (existsSync(file) ? JSON.parse(readFileSync(file, "utf8")) : {});

function record(input) {
  const path = input.tool_input?.file_path;
  if (input.tool_name !== "Read" || typeof path !== "string") return 0;
  const root = rulesRoot(path);
  if (!root || posix(root, path) !== RULES) return 0;
  if (input.tool_input.offset != null || input.tool_input.limit != null) return 0;
  const rules = join(root, ...RULES.split("/"));
  const file = stateFile(input.session_id);
  writeFileSync(file, JSON.stringify({ ...loadState(file), [stateKey(rules)]: digest(rules) }));
  return 0;
}

function check(input) {
  const path = input.tool_input?.file_path ?? input.tool_input?.notebook_path;
  if (typeof path !== "string") return 0;
  const root = rulesRoot(path);
  if (!root) return 0;
  const target = posix(root, path);
  if (!UI_FILE.test(target) || TEST_FILE.test(target)) return 0;
  const rules = join(root, ...RULES.split("/"));
  if (loadState(stateFile(input.session_id))[stateKey(rules)] === digest(rules)) return 0;
  process.stderr.write(
    `디자인 규칙을 먼저 읽어야 화면 파일(${target})을 수정할 수 있습니다. ` +
      `Read 도구로 ${RULES} 전체를 offset·limit 없이 읽은 뒤 다시 시도하세요. ` +
      `규칙 파일이 바뀌었다면 다시 읽어야 합니다. (${rules})\n`,
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
    process.stderr.write(`design-rules-gate: skipped (${error instanceof Error ? error.message : String(error)})\n`);
    code = 0;
  }
  process.exit(code);
});
