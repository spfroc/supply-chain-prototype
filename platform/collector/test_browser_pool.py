import os
import unittest
from unittest.mock import AsyncMock, patch

from jd import BrowserPool


class BrowserPoolTest(unittest.IsolatedAsyncioTestCase):
    async def test_direct_pool_ignores_configured_proxy(self):
        browser = AsyncMock()
        browser.is_connected.return_value = True
        playwright = AsyncMock()
        playwright.chromium.launch = AsyncMock(return_value=browser)
        starter = AsyncMock()
        starter.start = AsyncMock(return_value=playwright)
        with patch.dict(os.environ, {"COLLECTOR_BROWSER_PROXY": "socks5://proxy.invalid:1080"}), \
             patch("jd.async_playwright", return_value=starter):
            pool = BrowserPool(proxy_url="")
            await pool.start()
        kwargs = playwright.chromium.launch.await_args.kwargs
        self.assertNotIn("proxy", kwargs)

    async def test_default_pool_uses_configured_proxy(self):
        browser = AsyncMock()
        browser.is_connected.return_value = True
        playwright = AsyncMock()
        playwright.chromium.launch = AsyncMock(return_value=browser)
        starter = AsyncMock()
        starter.start = AsyncMock(return_value=playwright)
        with patch.dict(os.environ, {"COLLECTOR_BROWSER_PROXY": "socks5://proxy.invalid:1080"}), \
             patch("jd.async_playwright", return_value=starter):
            pool = BrowserPool()
            await pool.start()
        kwargs = playwright.chromium.launch.await_args.kwargs
        self.assertEqual({"server": "socks5://proxy.invalid:1080"}, kwargs["proxy"])


if __name__ == "__main__":
    unittest.main()
