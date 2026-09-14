import hashlib
import io
import json
import re
import sys
import unittest
from contextlib import redirect_stdout
from pathlib import Path
from unittest.mock import patch

from scripts import verify_repository


ROOT = Path(__file__).resolve().parents[2]
PUBLIC_SOURCE_URL_SHA256 = (
    "073bb0474c24b36222a6feb0b17f5c80a5576356e4cbf145156e5427e9943123"
)


def public_source_url():
    registry = (ROOT / "research/sources/source_registry.csv").read_text(
        encoding="utf-8"
    )
    candidates = re.findall(r"https?://[^,\s\"]+", registry)
    matches = [
        candidate
        for candidate in candidates
        if re.search(verify_repository.PATTERNS["resident_id"], candidate)
    ]
    if len(matches) != 1:
        raise AssertionError("expected one public source URL fixture")
    digest = hashlib.sha256(matches[0].encode("utf-8")).hexdigest()
    if digest != PUBLIC_SOURCE_URL_SHA256:
        raise AssertionError("public source URL fixture identity changed")
    return matches[0]


class ContentScanTests(unittest.TestCase):
    def test_exact_public_source_url_is_not_a_resident_id(self):
        findings = verify_repository.scan_content(
            "notes/source.txt", public_source_url().encode("utf-8")
        )

        self.assertNotIn("resident_id", findings)

    def test_exact_public_source_url_in_unquoted_csv_field_is_not_a_resident_id(self):
        content = ("SRC-001," + public_source_url() + ",verified\n").encode("utf-8")

        findings = verify_repository.scan_content("notes/sources.csv", content)

        self.assertNotIn("resident_id", findings)

    def test_changed_public_source_url_is_scanned_as_a_resident_id(self):
        url = public_source_url()
        match = re.search(verify_repository.PATTERNS["resident_id"], url)
        replacement = match.group()[:-1] + ("0" if match.group()[-1] != "0" else "1")
        changed_url = url[: match.start()] + replacement + url[match.end() :]

        findings = verify_repository.scan_content(
            "notes/source.txt", changed_url.encode("utf-8")
        )

        self.assertIn("resident_id", findings)

    def test_public_source_url_with_legal_suffix_is_scanned_as_a_resident_id(self):
        for suffix in ("?", ";"):
            with self.subTest(suffix=suffix):
                findings = verify_repository.scan_content(
                    "notes/source.txt", (public_source_url() + suffix).encode("utf-8")
                )

                self.assertIn("resident_id", findings)

    def test_identifier_outside_exact_public_source_url_is_detected(self):
        identifier = re.search(
            verify_repository.PATTERNS["resident_id"], public_source_url()
        ).group()

        findings = verify_repository.scan_content(
            "notes/source.txt", identifier.encode("utf-8")
        )

        self.assertIn("resident_id", findings)

    def test_real_like_identifier_adjacent_to_public_source_url_is_detected(self):
        content = public_source_url() + "\nReference: " + "900101-" + "1234567"

        findings = verify_repository.scan_content(
            "notes/source.txt", content.encode("utf-8")
        )

        self.assertIn("resident_id", findings)

    def test_other_secret_pattern_next_to_public_source_url_is_detected(self):
        content = public_source_url() + "\nAIza" + ("A" * 30)

        findings = verify_repository.scan_content(
            "notes/source.txt", content.encode("utf-8")
        )

        self.assertIn("api_key", findings)

    def test_empty_web_env_example_is_allowed(self):
        content = b'# Public browser configuration\nPUBLIC_API_URL=\nOPTIONAL_TOKEN=""\n'

        findings = verify_repository.scan_content("web/.env.example", content)

        self.assertEqual([], findings)

    def test_nonempty_web_env_example_value_is_blocked(self):
        content = b"PUBLIC_API_URL=https://example.test\n"

        findings = verify_repository.scan_content("web/.env.example", content)

        self.assertIn("sensitive_or_unreviewed_file", findings)

    def test_other_env_example_path_remains_blocked(self):
        findings = verify_repository.scan_content(
            "api/.env.example", b"PUBLIC_API_URL=\n"
        )

        self.assertIn("sensitive_or_unreviewed_file", findings)

    def test_case_variant_web_env_example_path_remains_blocked(self):
        findings = verify_repository.scan_content(
            "Web/.env.example", b"PUBLIC_API_URL=\n"
        )

        self.assertIn("sensitive_or_unreviewed_file", findings)

    def test_secret_in_empty_value_example_path_is_still_detected(self):
        content = ("PUBLIC_API_URL=\n# AIza" + ("A" * 30) + "\n").encode("utf-8")

        findings = verify_repository.scan_content("web/.env.example", content)

        self.assertIn("api_key", findings)


class MarkdownLinkTests(unittest.TestCase):
    def run_main_with_blobs(self, blobs):
        paths = list(blobs)

        def fake_git(*args):
            if args == ("ls-files", "-z"):
                return ("\0".join(paths) + "\0").encode("utf-8")
            if len(args) == 2 and args[0] == "show" and args[1].startswith(":"):
                return blobs[args[1][1:]]
            raise AssertionError("unexpected git call")

        output = io.StringIO()
        with patch.object(verify_repository, "git", side_effect=fake_git), patch.object(
            verify_repository, "REQUIRED", set(paths)
        ), patch.object(sys, "argv", ["verify_repository.py"]), redirect_stdout(output):
            failed = verify_repository.main()
        return failed, json.loads(output.getvalue())

    def test_link_inside_fenced_markdown_example_is_ignored(self):
        failed, result = self.run_main_with_blobs(
            {"docs/example.md": b"# Example\n\n```markdown\n[demo](missing.md)\n```\n"}
        )

        self.assertFalse(failed)
        self.assertEqual(0, result["internal_links"])
        self.assertEqual([], result["findings"])

    def test_rendered_markdown_link_is_still_checked(self):
        failed, result = self.run_main_with_blobs(
            {"docs/example.md": b"# Example\n\n[real](missing.md)\n"}
        )

        self.assertTrue(failed)
        self.assertEqual(1, result["internal_links"])
        self.assertEqual(
            ["docs/example.md:broken_link:missing.md"], result["findings"]
        )


if __name__ == "__main__":
    unittest.main()
