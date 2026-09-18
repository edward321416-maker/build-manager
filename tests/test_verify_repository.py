import unittest

from scripts.verify_repository import scan_content


class VerifyRepositoryRegressionTests(unittest.TestCase):
    def test_official_viewer_url_is_not_resident_id(self):
        content = (
            "https://www.knuh.ac.kr/weblink/download/viewer/"
            "1788418418979/index.html"
        ).encode("utf-8")
        self.assertNotIn(
            "resident_id",
            scan_content("submission/official_requirements.md", content),
        )

    def test_official_viewer_url_with_query_is_not_resident_id(self):
        content = (
            "https://www.knuh.ac.kr/weblink/download/viewer/"
            "1788418418979/index.html?download=1"
        ).encode("utf-8")
        self.assertNotIn(
            "resident_id",
            scan_content("submission/official_requirements.md", content),
        )

    def test_plausible_synthetic_resident_id_is_detected(self):
        content = ("synthetic test id " + "900101" + "-1234567").encode("utf-8")
        self.assertIn(
            "resident_id",
            scan_content("tests/synthetic.txt", content),
        )


if __name__ == "__main__":
    unittest.main()
