"""Check the staged public tree without printing sensitive matches; stdlib only."""

import argparse
import csv
import hashlib
import io
import json
import re
import subprocess
from pathlib import PurePosixPath
from urllib.parse import unquote


REQUIRED = {
    'README.md', 'AGENTS.md', 'PROJECT_CHARTER.md', 'STATUS.md',
    'CONTRIBUTING.md', 'CHANGELOG.md', '.gitignore', '.gitattributes',
    'governance/project_policy.md', 'research/README.md',
    'research/sources/source_registry.csv', 'research/sources/claim_registry.csv',
    'research/interviews/landlord_guide.md', 'research/interviews/tenant_guide.md',
    'research/competitors/README.md', 'product/problem_definition.md',
    'product/b2b2c_strategy.md', 'product/mvp_scope.md',
    'product/current_user_workflow.md', 'product/ai_safety_boundary.md',
    '.github/ISSUE_TEMPLATE/research.yml', '.github/ISSUE_TEMPLATE/task.yml',
    '.github/ISSUE_TEMPLATE/config.yml', '.github/pull_request_template.md',
    '.github/workflows/repository-check.yml', 'governance/github_backlog.json',
    '.github/system_prompts/chatgpt_custom_instructions.md',
    '.github/system_prompts/codex_system_prompt.md',
    'ops/AI_Execution_Log.csv', 'ops/pending_external_sync.md',
    'ops/verification.md', 'ops/prompt_validation.md', '.gemini_sync.md',
    'scripts/verify_repository.py',
} | {
    'submission/2026-modu-startup-2/' + name for name in (
        'README.md', 'official_requirements.md', 'application_draft.md',
        'evidence_checklist.md', 'claims_checklist.md', 'image_plan.md',
        'final_gate.md', 'final/README.md',
    )
}

PATTERNS = {
    'private_key': r'-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----',
    'github_token': r'\b(?:gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{40,})\b',
    'api_key': r'\b(?:AIza[0-9A-Za-z_-]{30,}|sk-(?:proj-)?[A-Za-z0-9_-]{24,}|AKIA[0-9A-Z]{16})\b',
    'jwt': r'\beyJ[A-Za-z0-9_-]{12,}\.[A-Za-z0-9_-]{12,}\.[A-Za-z0-9_-]{12,}\b',
    'credential_assignment': r'''(?im)^\s*["']?(?:password|api_key|access_token|client_secret|private_key)["']?\s*[:=]\s*["']?[^\s"'<>]{8,}''',
    'email': r'\b[A-Za-z0-9._%+-]+@(?!users\.noreply\.github\.com)[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b',
    'korean_phone': r'(?<!\d)01[016789][- .]?\d{3,4}[- .]?\d{4}(?!\d)',
    'resident_id': r'(?<!\d)\d{6}[- ]?[1-8]\d{6}(?!\d)',
    'credential_url': r'https?://[^\s/:@]+:[^\s/@]+@',
    'street_address': r'[가-힣]{2,}(?:로|길)\s+\d+(?:-\d+)?\s+(?:\d+동|\d+호)',
}


def git(*args):
    return subprocess.check_output(['git', *args])


def scan_content(path, data):
    """Return categories only; never echo matching content."""
    findings = []
    low = path.lower()
    parts = PurePosixPath(low).parts
    if any(p in {'raw', 'private', '.private', 'secrets', 'contracts', '.agents'} for p in parts):
        findings.append('private_path')
    if PurePosixPath(low).name.startswith('.env') or re.search(
        r'(?:service.account|credentials|^token).*\.json$|\.(?:pem|key|p12|pfx|mp3|mp4|mov|wav|docx|pdf)$', low
    ):
        findings.append('sensitive_or_unreviewed_file')
    try:
        content = data.decode('utf-8')
    except UnicodeDecodeError:
        return findings + ['unreviewed_binary']
    if not content.strip():
        findings.append('empty_file')
    for name, pattern in PATTERNS.items():
        if re.search(pattern, content):
            findings.append(name)
    if low.endswith('.md'):
        body = [s for s in content.splitlines() if s.strip() and not s.startswith('#')]
        if not body or (len(body) == 1 and body[0].strip().upper() in {'TODO', 'TBD', '[TO VERIFY]'}):
            findings.append('empty_placeholder')
    return findings


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--partial', action='store_true', help='Bootstrap: omit future required files and links')
    parser.add_argument('--history', action='store_true', help='Also scan every reachable committed blob')
    args = parser.parse_args()
    paths = git('ls-files', '-z').decode().split('\0')
    paths = [p for p in paths if p]
    errors = []
    blobs = {p: git('show', ':' + p) for p in paths}
    if not args.partial:
        errors.extend('missing:' + p for p in sorted(REQUIRED - blobs.keys()))
    hashes = {}
    link_count = 0
    for path, data in blobs.items():
        errors.extend(path + ':' + issue for issue in scan_content(path, data))
        content = data.decode('utf-8', errors='replace')
        if path.endswith('.md'):
            digest = hashlib.sha256(data).hexdigest()
            if digest in hashes:
                errors.append(path + ':duplicate_document:' + hashes[digest])
            hashes[digest] = path
            for target in re.findall(r'(?<!!)\[[^\]\n]+\]\(([^)]+)\)', content):
                target = unquote(target.strip('<>').split('#')[0])
                if not target or re.match(r'[a-z]+:', target):
                    continue
                link_count += 1
                normalized = []
                for part in (PurePosixPath(path).parent / target).parts:
                    if part == '..' and normalized:
                        normalized.pop()
                    elif part != '.':
                        normalized.append(part)
                resolved = '/'.join(normalized).rstrip('/')
                if not args.partial and resolved not in blobs and not any(p.startswith(resolved + '/') for p in paths):
                    errors.append(path + ':broken_link:' + target)
        if path.endswith('.csv'):
            rows = list(csv.DictReader(io.StringIO(content)))
            if any(None in row or any(v is None for v in row.values()) for row in rows):
                errors.append(path + ':malformed_csv')
            keys = [next(iter(row.values())) for row in rows]
            if len(keys) != len(set(keys)):
                errors.append(path + ':duplicate_id')
    config_path = 'governance/github_backlog.json'
    if config_path in blobs:
        config = json.loads(blobs[config_path])
        for group, key in [('issues', 'title'), ('labels', 'name'), ('milestones', 'title')]:
            values = [r[key].strip().casefold() for r in config[group]]
            if len(values) != len(set(values)):
                errors.append(config_path + ':duplicate_' + group)
        labels = {r['name'] for r in config['labels']}
        milestones = {r['title'] for r in config['milestones']}
        for issue in config['issues']:
            if not set(issue['labels']) <= labels or issue['milestone'] not in milestones:
                errors.append(config_path + ':invalid_issue_reference')
    history_blobs = 0
    if args.history:
        seen = set()
        for commit in git('rev-list', '--all').decode().splitlines():
            for entry in git('ls-tree', '-r', '-z', commit).split(b'\0'):
                if not entry:
                    continue
                meta, raw_path = entry.split(b'\t', 1)
                _, kind, oid = meta.decode().split()
                path = raw_path.decode()
                if kind != 'blob' or (oid, path) in seen:
                    continue
                seen.add((oid, path))
                history_blobs += 1
                errors.extend('history:' + path + ':' + issue for issue in scan_content(path, git('cat-file', 'blob', oid)))
    print(json.dumps({'mode': 'partial' if args.partial else 'full', 'files': len(paths),
                      'internal_links': link_count, 'history_blobs': history_blobs,
                      'findings': errors, 'result': 'FAIL' if errors else 'PASS'}, ensure_ascii=False))
    return bool(errors)


if __name__ == '__main__':
    raise SystemExit(main())
