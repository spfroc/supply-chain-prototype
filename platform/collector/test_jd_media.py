import unittest

from importer import detail_html
from jd import images_from_ware_business, parse_graphic_images


class JdMediaTest(unittest.TestCase):
    def test_reads_all_carousel_images_in_source_order(self):
        payload = {"mainImageVO": {"carouselArea": [
            {"imageUrl": "//img10.360buyimg.com/n5/jfs/t1/a.jpg"},
            {"imageUrl": "//img10.360buyimg.com/n5/jfs/t1/b.jpg"},
            {"imageUrl": "//img10.360buyimg.com/n5/jfs/t1/c.jpg"},
        ]}}
        images = images_from_ware_business(payload)
        self.assertEqual(3, len(images))
        self.assertTrue(images[0].endswith("/a.jpg"))
        self.assertTrue(images[2].endswith("/c.jpg"))

    def test_reads_images_from_signed_jsonp_detail_response(self):
        body = r'''cb0({"data":{"content":"<img data-lazy-img=\"//img30.360buyimg.com/sku/jfs/t1/detail-a.jpg\"><img src=\"//img30.360buyimg.com/sku/jfs/t1/detail-b.jpg\">"}});'''
        images = parse_graphic_images(body)
        self.assertEqual(2, len(images))

    def test_rich_detail_keeps_images_and_structured_specs(self):
        html = detail_html({"品牌": "测试品牌", "型号": "A1"}, "测试商品", ["/a.jpg", "/b.jpg"])
        self.assertIn("/a.jpg", html)
        self.assertIn("测试品牌", html)
        self.assertIn("型号", html)


if __name__ == "__main__":
    unittest.main()
