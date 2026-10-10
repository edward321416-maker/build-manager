#!/usr/bin/env node
// Claude Code hook (work rules v1, operator decisions 2026-10-09 and 2026-10-10): before design,
// development, research or reference work, the matching rulebook must have been read in full in the
// same session. `.claude/rules-gate.json` of the repository that contains the edited file (or the
// directory a command or lookup runs in) lists each rulebook with the edit globs, tools and command
// classes it covers. A checkout that has design/DESIGN_RULES.md but no config gets the design rule only.
//   record  PostToolUse, matcher Read|Edit|Write|MultiEdit|NotebookEdit: leave a marker named by the hash
//           of a fully read rulebook in the session's folder, one file per record so parallel reads cannot
//           overwrite each other. A rulebook the session edited itself counts too, but only when `check`
//           confirmed just before the edit that its previous content had been read.
//   check   PreToolUse, matcher Edit|Write|MultiEdit|NotebookEdit|WebSearch|WebFetch|Bash|PowerShell:
//           exit 2 while a required rulebook is unread or changed since it was read. Reads are matched
//           by content hash, so a read in one worktree covers an identical copy in another.
// A missing rulebook file is skipped and a broken rule is skipped with a warning. Errors never block:
// they exit 1 so Claude Code shows them to the user. Never place rules-gate.json in ~/.claude: every
// path under the home folder would then count as a rules repository.
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { dirname, join, relative, resolve, sep } from "node:path";

const CONFIG = [".claude", "rules-gate.json"];
const DESIGN_FILE = "design/DESIGN_RULES.md";
const DESIGN_FALLBACK = {
  id: "design",
  name: "디자인 규칙",
  file: DESIGN_FILE,
  edit: ["apps/web/src/app/**/*.{tsx,css}", "apps/web/src/components/**/*.{tsx,css}", "apps/mobile/src/**/*.tsx"],
  exclude: ["**/*.test.tsx", "**/*.spec.tsx"],
};
const EDIT_TOOLS = new Set(["Edit", "Write", "MultiEdit", "NotebookEdit"]);
const SHELL_TOOLS = new Set(["Bash", "PowerShell"]);
const CHANGE_DIRECTORY = new Set(["cd", "chdir", "pushd", "set-location", "sl"]);
// Windows paths are case-insensitive, so matching and state keys are too.
const FOLD = process.platform === "win32";

/** Git Bash `/d/x` and `~/x` spellings become native paths so they resolve on Windows too. */
function native(path) {
  if (path === "~" || path.startsWith("~/")) return join(homedir(), path.slice(2));
  const drive = FOLD ? /^\/([A-Za-z])(?:\/|$)/.exec(path) : null;
  return drive ? `${drive[1].toUpperCase()}:\\${path.slice(3).split("/").join("\\")}` : path;
}
const fold = (text) => (FOLD ? text.toLowerCase() : text);

/** The nearest folder that has the gate config, or else the design rules (design-only fallback). */
function findRoot(start) {
  for (let dir = resolve(start); ; dir = dirname(dir)) {
    if (existsSync(join(dir, ...CONFIG))) return { root: dir, fallback: false };
    if (existsSync(join(dir, ...DESIGN_FILE.split("/")))) return { root: dir, fallback: true };
    if (dirname(dir) === dir) return null;
  }
}
const posix = (root, path) => relative(root, path).split(sep).join("/");
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

// Options that take a separate value, so the value is not mistaken for a package name.
const VALUE_OPTIONS = new Set(["-w", "--workspace", "--prefix", "-C", "--dir", "--cwd", "--omit", "--include", "--filter", "-F", "--tag", "--registry", "--cache", "--userconfig"]);
const PACKAGE_MANAGER = /^(?:npm|pnpm|yarn)(?:\.cmd|\.exe|\.ps1)?$/i;
const PACKAGE_RUNNER = /^(?:npx|pnpx)(?:\.cmd|\.exe|\.ps1)?$/i;
const ADD_SUBCOMMANDS = new Set(["install", "i", "in", "add", "isntall"]);

function afterOptions(words, i) {
  while (i < words.length && words[i].startsWith("-")) {
    i += VALUE_OPTIONS.has(words[i]) ? 2 : 1;
  }
  return i;
}
/** True when one command adds named packages, e.g. `npm -w apps/web install zod` or `npx expo install x`. */
function addsPackages(words) {
  for (let k = 0; k < words.length; k++) {
    const program = words[k].split(/[\\/]/).pop();
    if (PACKAGE_MANAGER.test(program)) {
      const sub = afterOptions(words, k + 1);
      return ADD_SUBCOMMANDS.has(words[sub]) && afterOptions(words, sub + 1) < words.length;
    }
    if (PACKAGE_RUNNER.test(program)) {
      const sub = afterOptions(words, k + 1);
      return words[sub] === "expo" && words[sub + 1] === "install" && afterOptions(words, sub + 2) < words.length;
    }
  }
  return false;
}
const COMMAND_CLASSES = { "package-add": addsPackages };

/** Rules of a checkout; a broken rule is skipped and reported instead of disabling every rule. */
function loadRules({ root, fallback }, warnings) {
  const rules = fallback ? [DESIGN_FALLBACK] : JSON.parse(readFileSync(join(root, ...CONFIG), "utf8")).rules;
  if (!Array.isArray(rules)) throw new Error("rules-gate.json has no rules list");
  return rules.flatMap((rule) => {
    try {
      if (typeof rule.file !== "string" || typeof rule.name !== "string") throw new Error("needs file and name");
      return [
        {
          name: rule.name,
          file: rule.file,
          path: join(root, ...rule.file.split("/")),
          edit: (rule.edit ?? []).map(globToRegExp),
          exclude: (rule.exclude ?? []).map(globToRegExp),
          tools: rule.tools ?? [],
          commands: (rule.commands ?? []).filter((name) => {
            if (COMMAND_CLASSES[name]) return true;
            warnings.push(`rule ${rule.id}: unknown command class ${name}`);
            return false;
          }),
        },
      ];
    } catch (error) {
      warnings.push(`rule ${rule?.id ?? "?"} skipped: ${error instanceof Error ? error.message : String(error)}`);
      return [];
    }
  });
}

/** Each session has a folder; every full read of a rulebook leaves an empty file named by its content hash. */
function sessionDir(session) {
  if (typeof session !== "string" || !session) throw new Error("session_id missing");
  const dir = join(tmpdir(), "build-manager-rules-gate", session.replace(/[^A-Za-z0-9_-]/g, "_"));
  mkdirSync(dir, { recursive: true });
  return dir;
}
/** Hashes read in the session, including records that the earlier single-file format left in `<session>.json`. */
function readDigests(session) {
  const dir = sessionDir(session);
  const markers = readdirSync(dir).filter((name) => /^[0-9a-f]{64}$/.test(name));
  return new Set([...markers, ...Object.values(loadState(`${dir}.json`))]);
}
/** A checked edit runs right after its check; an older marker is stale and credits nothing. */
const PENDING_EDIT_MAX_AGE_MS = 10 * 60 * 1000;
/** Marks a checked edit of a rulebook whose current content was read; `record` credits the result after the edit. */
const pendingEditFile = (session, rulebookPath) =>
  join(sessionDir(session), `edit-${createHash("sha256").update(fold(rulebookPath)).digest("hex")}`);
/** A missing or corrupt legacy state file counts as "nothing read yet". */
function loadState(file) {
  try {
    const state = JSON.parse(readFileSync(file, "utf8"));
    return state && typeof state === "object" && !Array.isArray(state) ? state : {};
  } catch {
    return {};
  }
}

/** The content an Edit, Write or MultiEdit should have produced from `original`, or null when it cannot be derived. */
function editedContent(tool, args, original) {
  const replace = (text, oldString, newString, all) => {
    if (typeof oldString !== "string" || typeof newString !== "string" || !oldString || !text.includes(oldString)) return null;
    return all ? text.split(oldString).join(newString) : text.replace(oldString, () => newString);
  };
  if (tool === "Write") return typeof args?.content === "string" ? args.content : null;
  if (tool === "Edit") return replace(original, args?.old_string, args?.new_string, args?.replace_all === true);
  if (tool === "MultiEdit" && Array.isArray(args?.edits)) {
    let text = original;
    for (const edit of args.edits) {
      text = replace(text, edit?.old_string, edit?.new_string, edit?.replace_all === true);
      if (text === null) return null;
    }
    return text;
  }
  return null;
}
/**
 * The session wrote this rulebook itself after `check` confirmed it had read the previous content.
 * Credit the new content only when the edit started from that read content, was not changed by the user,
 * and the file on disk is exactly what the edit produced; anything else still needs a full read.
 */
function creditedEdit(input, rulebookPath) {
  const pending = pendingEditFile(input.session_id, rulebookPath);
  // Claim the marker first so two copies of this hook recording the same edit cannot both use it.
  const claimed = `${pending}.${process.pid}`;
  try {
    renameSync(pending, claimed);
  } catch {
    return false;
  }
  let before, fresh;
  try {
    before = readFileSync(claimed, "utf8");
    fresh = Date.now() - statSync(claimed).mtimeMs < PENDING_EDIT_MAX_AGE_MS;
  } finally {
    rmSync(claimed, { force: true });
  }
  if (!fresh || !readDigests(input.session_id).has(before)) return false;
  const response = input.tool_response ?? {};
  if (response.userModified === true || typeof response.originalFile !== "string") return false;
  if (createHash("sha256").update(response.originalFile).digest("hex") !== before) return false;
  const expected = editedContent(input.tool_name, input.tool_input, response.originalFile);
  return expected !== null && createHash("sha256").update(expected).digest("hex") === digest(rulebookPath);
}

function record(input) {
  const edited = EDIT_TOOLS.has(input.tool_name);
  const path = edited ? input.tool_input?.file_path ?? input.tool_input?.notebook_path : input.tool_input?.file_path;
  if ((input.tool_name !== "Read" && !edited) || typeof path !== "string") return 0;
  if (!edited && (input.tool_input.offset != null || input.tool_input.limit != null)) return 0;
  const absolute = resolve(native(input.cwd ?? "."), native(path));
  const found = findRoot(dirname(absolute));
  if (!found) return 0;
  const target = fold(posix(found.root, absolute));
  const rule = loadRules(found, []).find((candidate) => fold(candidate.file) === target);
  if (!rule || !existsSync(rule.path)) return 0;
  if (edited && !creditedEdit(input, rule.path)) return 0;
  // One file per record: parallel Read hooks never rewrite a shared file, so no record is lost or fails.
  writeFileSync(join(sessionDir(input.session_id), digest(rule.path)), "");
  return 0;
}

const splitWords = (text) => (text.match(/"[^"]*"|'[^']*'|\S+/g) ?? []).map((word) => word.replace(/^(["'])(.*)\1$/, "$2"));

/** Each place the call needs rules: the folder to search from, a label, and which rules apply there. */
function demands(input) {
  const { tool_name: tool, tool_input: args = {} } = input;
  if (EDIT_TOOLS.has(tool)) {
    const path = args.file_path ?? args.notebook_path;
    if (typeof path !== "string") return [];
    const absolute = resolve(native(input.cwd ?? "."), native(path));
    return [
      {
        start: dirname(absolute),
        label: (root) => posix(root, absolute),
        // Editing a rulebook itself requires having read it.
        editsRulebook: (rule, root) => fold(posix(root, absolute)) === fold(rule.file),
        needs: (rule, root) => {
          const relativePath = posix(root, absolute);
          if (fold(relativePath) === fold(rule.file)) return true;
          return rule.edit.some((re) => re.test(relativePath)) && !rule.exclude.some((re) => re.test(relativePath));
        },
      },
    ];
  }
  if (typeof input.cwd !== "string") return [];
  if (SHELL_TOOLS.has(tool)) {
    let dir = resolve(native(input.cwd));
    const found = [];
    for (const segment of String(args.command ?? "").split(/&&|\|\||[;|&\r\n]/)) {
      const words = splitWords(segment);
      if (words.length === 0) continue;
      if (CHANGE_DIRECTORY.has(words[0].toLowerCase())) {
        dir = resolve(dir, native(words.find((word, i) => i > 0 && !word.startsWith("-")) ?? "~"));
        continue;
      }
      const classes = Object.keys(COMMAND_CLASSES).filter((name) => COMMAND_CLASSES[name](words));
      if (classes.length > 0) {
        found.push({
          start: dir,
          label: () => segment.trim().slice(0, 80),
          needs: (rule) => rule.commands.some((name) => classes.includes(name)),
        });
      }
    }
    return found;
  }
  return [{ start: native(input.cwd), label: () => tool, needs: (rule) => rule.tools.includes(tool) }];
}

function check(input) {
  const warnings = [];
  const unread = new Map();
  const editedRulebooks = [];
  let read;
  for (const demand of demands(input)) {
    const found = findRoot(demand.start);
    if (!found) continue;
    for (const rule of loadRules(found, warnings)) {
      if (!demand.needs(rule, found.root) || !existsSync(rule.path)) continue;
      // Matched by content, not path: a full read also covers other checkouts (worktrees) of the same session
      // while their copy is byte-identical, and any change still requires a new read.
      read ??= readDigests(input.session_id);
      const current = digest(rule.path);
      if (!read.has(current)) {
        unread.set(rule.path, { rule, label: demand.label(found.root) });
        // Best effort only: a leftover marker cannot credit anything that `creditedEdit` rejects, and a cleanup
        // error must not turn this block into an internal error that lets the edit through.
        if (demand.editsRulebook?.(rule, found.root)) {
          try {
            rmSync(pendingEditFile(input.session_id, rule.path), { force: true });
          } catch {}
        }
      } else if (demand.editsRulebook?.(rule, found.root)) editedRulebooks.push({ path: rule.path, current });
    }
  }
  const warning = warnings.length > 0 ? `rules-gate: ${warnings.join("; ")}\n` : "";
  if (unread.size === 0) {
    for (const { path, current } of editedRulebooks) writeFileSync(pendingEditFile(input.session_id, path), current);
    process.stderr.write(warning);
    return warning ? 1 : 0;
  }
  const items = [...unread.values()];
  process.stderr.write(
    `작업 전에 다음 규칙을 전체 읽어야 합니다: ${items.map(({ rule }) => `${rule.name}(${rule.file}: ${rule.path})`).join(", ")}. ` +
      "Read 도구로 offset·limit 없이 끝까지 읽은 뒤 다시 시도하세요. 규칙 파일이 바뀌면 다시 읽어야 합니다. " +
      `(대상: ${[...new Set(items.map(({ label }) => label))].join(", ")})\n` +
      warning,
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
    // Never block on an internal error; exit 1 so the problem is visible instead of silent.
    process.stderr.write(`rules-gate: not checked (${error instanceof Error ? error.message : String(error)})\n`);
    code = 1;
  }
  process.exit(code);
});
