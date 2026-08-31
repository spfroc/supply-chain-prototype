import unittest

from huiecai import _normalize_image_urls


class HuiecaiImageUrlTests(unittest.TestCase):
    def test_accepts_current_and_legacy_cdn_paths_in_order(self):
        values = [
            "https://oss.miniappss.com/terminal/current.jpg",
            "https://oss.miniappss.com/swiper/123/legacy.jpg",
            "//oss.miniappss.com/terminal/protocol-relative.jpg",
            "https://oss.miniappss.com/terminal/current.jpg",
            "data:image/png;base64,ignored",
        ]
        self.assertEqual(
            _normalize_image_urls(values),
            [
                "https://oss.miniappss.com/terminal/current.jpg",
                "https://oss.miniappss.com/swiper/123/legacy.jpg",
                "https://oss.miniappss.com/terminal/protocol-relative.jpg",
            ],
        )

    def test_detail_images_can_exclude_site_static_assets(self):
        self.assertEqual(
            _normalize_image_urls(
                [
                    "https://example.com/static2026/logo.png",
                    "https://example.com/detail.jpg",
                ],
                exclude_static=True,
            ),
            ["https://example.com/detail.jpg"],
        )


if __name__ == "__main__":
    unittest.main()
