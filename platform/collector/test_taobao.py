import unittest

from platforms import CollectError
from taobao import fetch_detail, parse_detail, parse_item_url


class TaobaoCollectorTest(unittest.TestCase):
    def test_parses_tmall_url_and_selected_sku(self):
        item, sku = parse_item_url(
            "https://detail.tmall.com/item.htm?id=666117540084&skuId=6110386380324&spm=test"
        )
        self.assertEqual("666117540084", item)
        self.assertEqual("6110386380324", sku)

    def test_rejects_non_taobao_host(self):
        with self.assertRaises(CollectError):
            parse_item_url("https://example.com/item.htm?id=666117540084")

    def test_requires_server_side_login_cookie(self):
        with self.assertRaises(CollectError) as raised:
            fetch_detail("666117540084", "6110386380324", cookie="")
        self.assertEqual("taobao_auth_required", raised.exception.code)
        self.assertEqual(401, raised.exception.status)

    def test_maps_title_images_properties_price_and_spec(self):
        detail = {
            "item": {"title": "测试天猫商品", "images": ["//img.alicdn.com/a.jpg"]},
            "seller": {"shopName": "测试旗舰店"},
            "props": {"groupProps": [{"基本信息": [{"品牌": "测试品牌"}, {"型号": "A1"}]}]},
            "skuBase": {
                "props": [{"pid": "1", "name": "颜色", "values": [{"vid": "2", "name": "黑色"}]}],
                "skus": [{"skuId": "6110386380324", "propPath": "1:2"}],
            },
            "skuCore": {"sku2info": {"6110386380324": {
                "price": {"priceText": "99.00"}, "originalPrice": {"priceText": "129.00"}
            }}},
            "desc": '<img src="//img.alicdn.com/detail.jpg">',
        }
        product = parse_detail(detail, "666117540084", "6110386380324")
        self.assertEqual("测试天猫商品", product["title"])
        self.assertEqual("https://img.alicdn.com/a.jpg", product["images"][0])
        self.assertEqual("测试品牌", product["params"]["品牌"])
        self.assertEqual("颜色=黑色", product["spec"])
        self.assertEqual(99.0, product["memberPrice"])
        self.assertEqual(129.0, product["marketPrice"])
        self.assertEqual("https://img.alicdn.com/detail.jpg", product["detailImages"][0])


if __name__ == "__main__":
    unittest.main()
