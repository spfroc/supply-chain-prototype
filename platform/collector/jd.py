from __future__ import annotations

import asyncio
import json
import re
import urllib.request
from urllib.parse import quote

from playwright.async_api import Browser, Page, Playwright, async_playwright

from platforms import CollectError, parse_jd_sku

UA = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36"
)
UA_MOBILE = (
    "Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/128.0.0.0 Mobile Safari/537.36"
)
CAT1_NAMES = {
    "737": "家用电器",
    "670": "电脑、办公",
    "1316": "美妆护肤",
    "1315": "服饰内衣",
    "1318": "运动户外",
    "1320": "食品饮料",
    "9987": "手机通讯",
    "1713": "图书",
}

PARAM_KEYS = sorted((
    "能效网规格型号", "固态污染物CADR", "固态物净化能效", "空气质量显示", "最低档声功率级噪音",
    "气态物净化能效", "HEPA滤网等级", "适用面积", "额定功率", "额定电压", "操控方式", "电机类型",
    "商品编号", "上架时间", "净化方式", "气态CADR", "能效等级", "适用人群", "特色功能",
    "品牌", "店铺", "货号", "型号", "类型", "功能",
), key=len, reverse=True)

SERVICE_TOKENS = (
    "两年质保", "四年免费换新", "4年免费换新", "免费上门退换", "只换不修", "全保换新",
)
DELISTED_MARKERS = (
    "商品已下架",
    "该商品已下架",
    "商品已下柜",
    "此商品已下架",
    "您所访问的商品不存在",
    "您访问的商品不存在",
    "抱歉，没有找到相关商品",
    "商品不存在或已下架",
    "查不到此商品信息",
)


def graphic_path_url(path: str) -> str:
    text = (path or "").strip().split("?")[0]
    text = re.sub(r"\.(avif|webp|dpg)$", "", text, flags=re.I)
    if text.startswith("//"):
        text = "https:" + text
    if text.startswith("/sku/jfs/"):
        return "https://img30.360buyimg.com" + text
    if text.startswith("sku/jfs/"):
        return "https://img30.360buyimg.com/" + text
    if text.startswith("http"):
        return text
    if "/jfs/" in text:
        return "https://img30.360buyimg.com/" + text.lstrip("/")
    return text


_SKIP_DETAIL = re.compile(
    r"(blank|placeholder|loading\.gif|/pop/jfs/|s\d{1,3}x\d{1,3}_jfs|\.gif$)",
    re.I,
)


def parse_graphic_images(html: str) -> list[str]:
    if not html:
        return []
    text = (
        html.replace("\\/", "/")
        .replace('\\"', '"')
        .replace("\\'", "'")
        .replace("&quot;", '"')
        .replace("&amp;", "&")
    )
    raws: list[str] = []
    hidden = re.search(
        r'id=["\']zbViewWeChatMiniImages["\'][^>]*value=["\']([^"\']+)|'
        r'value=["\']([^"\']+)["\'][^>]*id=["\']zbViewWeChatMiniImages["\']',
        text,
        re.I,
    )
    if hidden:
        raws.extend((hidden.group(1) or hidden.group(2) or "").split(","))
    raws.extend(re.findall(
        r'(?:src|data-src|data-original|data-lazy-img|data-lazyload|data-lazy-load|data-img)\s*=\s*["\']([^"\']+)["\']',
        text,
        re.I,
    ))
    raws.extend(re.findall(r'(?:https?:)?//img\d*\.360buyimg\.com/[^"\'\s<>\\]+', text, re.I))
    raws.extend(re.findall(r'/?sku/jfs/[^,\"\'\s>]+', text, re.I))
    urls: list[str] = []
    seen: set[str] = set()
    for raw in raws:
        path = (raw or "").strip().strip("\\").split("?")[0]
        if not path or _SKIP_DETAIL.search(path):
            continue
        if "jfs/" not in path and "360buyimg.com" not in path:
            continue
        url = graphic_path_url(path)
        if not url.startswith("http") or url in seen:
            continue
        seen.add(url)
        urls.append(url)
    return urls[:40]


# 后台：主图 1 + 配图最多 6
GALLERY_LIMIT = 7


def jfs_upgrade(url: str) -> str:
    url = url.strip().split("?")[0]
    url = re.sub(r"\.(avif|webp|dpg)$", "", url, flags=re.I)
    url = url.replace("/n5/", "/n1/").replace("/n0/", "/n1/")
    url = re.sub(r"(360buyimg\.com/)(?:n1/)+", r"\1n1/", url)
    if re.search(r"/n1/s800x800_jfs/", url):
        return url
    url = re.sub(r"s\d+x\d+_jfs/", "s800x800_jfs/", url)
    if "/s800x800_jfs/" in url and "/n1/" not in url:
        url = re.sub(r"(360buyimg\.com/)[^/]+/", r"\1n1/", url)
    if "jfs/" in url and "s800x800_jfs" not in url:
        url = re.sub(r"(360buyimg\.com/)[^/]+(/jfs/)", r"\1n1/s800x800_jfs/", url)
        url = url.replace("/s800x800_jfs/jfs/", "/s800x800_jfs/")
    return url


def uniquify_images(urls: list[str], limit: int = GALLERY_LIMIT) -> list[str]:
    """升级 CDN 尺寸并去重；接受 jpg/png 轮播（PC 常混用 png）。"""
    out: list[str] = []
    for raw in urls:
        text = str(raw or "").strip()
        if not text:
            continue
        upgraded = jfs_upgrade(text) if "://" in text else jfs_src(text)
        if not upgraded or upgraded in out:
            continue
        if "jfs/" not in upgraded:
            continue
        out.append(upgraded)
        if len(out) >= limit:
            break
    return out


def images_from_ware_business(payload: dict | None) -> list[str]:
    """从 pc_detailpage_wareBusiness 的 mainImageVO.carouselArea 取完整轮播。"""
    main = (payload or {}).get("mainImageVO") or {}
    urls: list[str] = []
    for item in main.get("carouselArea") or []:
        if isinstance(item, dict) and item.get("imageUrl"):
            urls.append(str(item["imageUrl"]))
    return uniquify_images(urls, GALLERY_LIMIT)


def _attach_ware_business_listener(page: Page, sink: list[list[str]]) -> None:
    async def on_response(response) -> None:
        try:
            if "pc_detailpage_wareBusiness" not in (response.url or ""):
                return
            if not response.ok:
                return
            data = await response.json()
            images = images_from_ware_business(data if isinstance(data, dict) else {})
            if images:
                sink.append(images)
        except Exception:
            return

    page.on("response", on_response)


async def _extract_pc_gallery(page: Page) -> list[str]:
    srcs = await page.evaluate(
        """() => {
          const out = [];
          const push = (u) => { if (u) out.push(String(u)); };
          const sel = "img[src*='pcpubliccms'][src*='jfs'], img[data-src*='pcpubliccms'][data-src*='jfs']";
          for (const img of document.querySelectorAll(sel)) {
            push(img.currentSrc || img.src || img.getAttribute('data-src') || '');
          }
          const html = document.documentElement.innerHTML;
          const re = /https?:\\/\\/[^"'\\s<>]*pcpubliccms[^"'\\s<>]*jfs[^"'\\s<>]*/gi;
          let m;
          while ((m = re.exec(html))) push(m[0].replace(/&amp;/g, '&'));
          return out;
        }"""
    )
    return uniquify_images(list(srcs or []), GALLERY_LIMIT)


def params_from_text(text: str) -> dict[str, str]:
    blob = (text or "").replace("查看全部参数", "").replace("规格参数", "").strip()
    out: dict[str, str] = {}
    lines = [ln.strip() for ln in blob.splitlines() if ln.strip()]
    i = 0
    while i < len(lines) - 1:
        if lines[i] in PARAM_KEYS:
            out[lines[i]] = lines[i + 1]
            i += 2
            continue
        i += 1
    if len(out) >= 3:
        return out
    compact = re.sub(r"\s+", "", blob)
    pattern = "(" + "|".join(map(re.escape, PARAM_KEYS)) + ")"
    parts = re.split(pattern, compact)
    i = 1
    while i < len(parts) - 1:
        key, value = parts[i], parts[i + 1].strip()
        if key and value:
            out[key] = value
        i += 2
    if out.get("电机类型") in {"家用", "商用"} and "直流无刷电机" in compact:
        out["类型"] = out["电机类型"]
        out["电机类型"] = "直流无刷电机"
    return out


def parse_price(raw: str | None) -> float | None:
    if not raw:
        return None
    text = str(raw).replace(",", "").strip()
    if re.search(r"[?？*xX]", text):
        return None
    match = re.search(r"(\d+(?:\.\d+)?)", text)
    return float(match.group(1)) if match else None


def jfs_src(path: str) -> str:
    text = (path or "").strip().split("?")[0]
    if not text:
        return ""
    if text.startswith("//"):
        text = "https:" + text
    if text.startswith("jfs/"):
        text = "https://img10.360buyimg.com/n1/s800x800_" + text
    elif text.startswith("/jfs/"):
        text = "https://img10.360buyimg.com/n1/s800x800_" + text.lstrip("/")
    return jfs_upgrade(text)


def _category_entries(node, acc: list[tuple[str, str]]) -> None:
    if isinstance(node, dict):
        raw = node.get("n")
        if isinstance(raw, str) and "|" in raw:
            ids, name, *_ = raw.split("|")
            if ids and name:
                acc.append((ids, name))
        for value in node.values():
            _category_entries(value, acc)
    elif isinstance(node, list):
        for value in node:
            _category_entries(value, acc)


def lookup_cat_name(entries: list[tuple[str, str]], ids: list[str]) -> str:
    joined = "-".join(ids)
    csv = ",".join(ids)
    encoded = "%2C".join(ids)
    for key, name in entries:
        if key == joined:
            return name
    for key, name in entries:
        if f"cat={csv}" in key or f"cat={encoded}" in key:
            return name
    return ""


def crumb_from_cats(cat_csv: str, brand: str) -> list[str]:
    ids = [part.strip() for part in (cat_csv or "").split(",") if part.strip()]
    names: list[str] = []
    if len(ids) >= 1:
        names.append(CAT1_NAMES.get(ids[0], "京东商品"))
    try:
        req = urllib.request.Request(
            "https://dc.3.cn/category/get",
            headers={"User-Agent": UA, "Referer": "https://item.jd.com/"},
        )
        with urllib.request.urlopen(req, timeout=12) as resp:
            tree = json.loads(resp.read().decode("gbk"))
        entries: list[tuple[str, str]] = []
        _category_entries(tree, entries)
        if len(ids) >= 2:
            l2 = lookup_cat_name(entries, ids[:2])
            if l2 and l2 not in names:
                names.append(l2)
        if len(ids) >= 3:
            l3 = lookup_cat_name(entries, ids[:3])
            if l3 and l3 not in names:
                names.append(l3)
    except Exception:
        pass
    if brand and brand not in names:
        names.append(brand)
    return names


def delisted_reason(text: str, product: dict | None = None) -> str | None:
    blob = text or ""
    for marker in DELISTED_MARKERS:
        if marker in blob:
            return f"京东商品已下架或不可售（{marker}）"
    sku_status = str((product or {}).get("skuStatus") or "").strip()
    if sku_status in {"0", "-1"}:
        return f"京东商品已下架（skuStatus={sku_status}）"
    return None


async def _page_text(page: Page) -> str:
    title = ""
    body = ""
    try:
        title = await page.title()
    except Exception:
        pass
    try:
        body = await page.locator("body").inner_text()
    except Exception:
        pass
    return f"{page.url}\n{title}\n{body}"


def _raise_if_delisted(text: str, product: dict | None = None) -> None:
    reason = delisted_reason(text, product)
    if reason:
        raise CollectError("delisted", reason, status=410)


class BrowserPool:
    def __init__(self) -> None:
        self._playwright: Playwright | None = None
        self._browser: Browser | None = None
        self.lock = asyncio.Lock()

    async def start(self) -> None:
        if self._browser and self._browser.is_connected():
            return
        self._playwright = await async_playwright().start()
        self._browser = await self._playwright.chromium.launch(
            headless=True,
            args=["--no-sandbox", "--disable-dev-shm-usage", "--disable-blink-features=AutomationControlled"],
        )

    async def stop(self) -> None:
        if self._browser:
            await self._browser.close()
            self._browser = None
        if self._playwright:
            await self._playwright.stop()
            self._playwright = None

    async def new_page(self, mobile: bool = False, ignore_https_errors: bool = False) -> Page:
        await self.start()
        assert self._browser is not None
        if mobile:
            context = await self._browser.new_context(
                user_agent=UA_MOBILE,
                locale="zh-CN",
                viewport={"width": 412, "height": 915},
                is_mobile=True,
                has_touch=True,
                ignore_https_errors=ignore_https_errors,
                extra_http_headers={"Accept-Language": "zh-CN,zh;q=0.9"},
            )
        else:
            context = await self._browser.new_context(
                user_agent=UA,
                locale="zh-CN",
                viewport={"width": 1440, "height": 900},
                ignore_https_errors=ignore_https_errors,
                extra_http_headers={"Accept-Language": "zh-CN,zh;q=0.9"},
            )
        return await context.new_page()


async def _click_text(page: Page, text: str) -> bool:
    locator = page.get_by_text(text, exact=True)
    if await locator.count() == 0:
        return False
    try:
        await locator.first.click(timeout=2500)
        return True
    except Exception:
        return False


async def _wait_product(page: Page, seconds: float = 12) -> None:
    deadline = asyncio.get_event_loop().time() + seconds
    last_error = "商品页未加载完成"
    while asyncio.get_event_loop().time() < deadline:
        if "pc-frequent-pro" in page.url:
            raise CollectError("blocked", "京东 PC 频控，改用移动端采集", status=502)
        title = await page.locator(".sku-title-name").count()
        price = await page.locator(".product-price--value").count()
        if title and price:
            return
        await page.wait_for_timeout(300)
    raise CollectError("blocked", last_error, status=502)


async def _detail_images_from_page(page: Page, sku: str) -> list[str]:
    """在已打开的页面上下文中请求图文详情（需稳定域名，避免商详频控页）。"""
    bodies = [
        {"skuId": sku},
        {"skuId": str(sku)},
    ]
    chunks: list[str] = []
    for payload_body in bodies:
        body = quote(json.dumps(payload_body, separators=(",", ":")))
        url = (
            "https://api.m.jd.com/?functionId=pc_item_getWareGraphic"
            f"&appid=item-v3&client=pc&clientVersion=1.0.0&body={body}"
        )
        data = await page.evaluate(
            """async (url) => {
              try {
                const resp = await fetch(url, {
                  credentials: "include",
                  headers: { Referer: "https://item.jd.com/" },
                });
                if (!resp.ok) return { __http: resp.status };
                return await resp.json();
              } catch (e) {
                return { __error: String(e) };
              }
            }""",
            url,
        )
        if not isinstance(data, dict) or data.get("__error") or data.get("__http"):
            continue
        payload = data.get("data") or {}
        content = str(payload.get("graphicContent") or "")
        if content:
            chunks.append(content)
        for item in payload.get("graphicInfoList") or []:
            if isinstance(item, dict):
                chunks.append(str(item.get("html") or item.get("content") or ""))
            else:
                chunks.append(str(item or ""))
        if chunks:
            break
    return parse_graphic_images("\n".join(chunks))


async def fetch_detail_images(pool: BrowserPool, sku: str) -> list[str]:
    """独立打开 www.jd.com 拉取图文，避免 item 页 403/跳转导致 fetch 失败。"""
    page = await pool.new_page(mobile=False)
    try:
        for home in ("https://www.jd.com/", "https://item.jd.com/"):
            try:
                await page.goto(home, wait_until="domcontentloaded", timeout=30000)
                await page.wait_for_timeout(600)
                images = await _detail_images_from_page(page, sku)
                if images:
                    return images
            except Exception:
                continue
        return []
    finally:
        await _close_page(page)


async def fetch_gallery_images(pool: BrowserPool, sku: str) -> list[str]:
    """PC 主流程被频控落到移动端时，单独再拉一轮 PC 缩略图（含 png / wareBusiness）。"""
    page = await pool.new_page(mobile=False)
    captured: list[list[str]] = []
    try:
        _attach_ware_business_listener(page, captured)
        try:
            await page.goto("https://www.jd.com/", wait_until="domcontentloaded", timeout=30000)
            await page.wait_for_timeout(600)
        except Exception:
            pass
        page_url = f"https://item.jd.com/{sku}.html"
        try:
            await page.goto(page_url, wait_until="domcontentloaded", timeout=45000)
        except Exception:
            return max(captured, key=len) if captured else []
        if "pc-frequent-pro" in (page.url or ""):
            return max(captured, key=len) if captured else []
        await page.wait_for_timeout(2000)
        images = max(captured, key=len) if captured else []
        if len(images) < GALLERY_LIMIT:
            dom_images = await _extract_pc_gallery(page)
            if len(dom_images) > len(images):
                images = dom_images
        return images
    finally:
        await _close_page(page)


async def _close_page(page: Page) -> None:
    context = page.context
    await page.close()
    await context.close()

async def _scrape_pc(pool: BrowserPool, sku: str) -> dict:
    page_url = f"https://item.jd.com/{sku}.html"
    page = await pool.new_page(mobile=False)
    captured: list[list[str]] = []
    try:
        _attach_ware_business_listener(page, captured)
        await page.goto(page_url, wait_until="domcontentloaded", timeout=45000)
        if "pc-frequent-pro" not in page.url:
            _raise_if_delisted(await _page_text(page))
        await _wait_product(page, seconds=8)
        await _click_text(page, "查看全部参数")
        await page.wait_for_timeout(700)
        title = (await page.locator(".sku-title-name").first.inner_text()).strip()
        member = parse_price(await page.locator(".product-price--value").first.inner_text())
        market = None
        if await page.locator(".product-price--gray-line-through").count():
            market = parse_price(await page.locator(".product-price--gray-line-through").first.inner_text())
        crumb = [
            (await item.inner_text()).strip()
            for item in await page.locator(".crumb a").all()
        ]
        crumb = [name for name in crumb if name]
        spec = ""
        selected = page.locator(".specification-item-sku--selected .specification-item-sku-text")
        if await selected.count():
            spec = " ".join((await item.inner_text()).strip() for item in await selected.all()).strip()
        attr = ""
        if await page.locator(".attribute").count():
            attr = await page.locator(".attribute").first.inner_text()
        params = params_from_text(attr)
        images = max(captured, key=len) if captured else []
        if len(images) < GALLERY_LIMIT:
            dom_images = await _extract_pc_gallery(page)
            if len(dom_images) > len(images):
                images = dom_images
        body_text = ""
        try:
            body_text = await page.locator("body").inner_text()
        except Exception:
            body_text = ""
        services = [token for token in SERVICE_TOKENS if token in body_text]
        if not title or not images:
            raise CollectError("parse_incomplete", "PC 页缺少标题或主图", status=502)
        spec = spec or params.get("型号") or params.get("货号") or sku
        return {
            "platform": "jd",
            "sku": sku,
            "url": page_url,
            "variant": "pc_item_components_3",
            "title": title[:200],
            "memberPrice": member,
            "marketPrice": market if market is not None else member,
            "crumb": crumb,
            "spec": spec,
            "params": params,
            "images": images[:GALLERY_LIMIT],
            "detailImages": [],
            "services": services,
        }
    finally:
        await _close_page(page)


async def _scrape_mobile(pool: BrowserPool, sku: str) -> dict:
    page_url = f"https://item.m.jd.com/product/{sku}.html"
    page = await pool.new_page(mobile=True)
    try:
        await page.goto(page_url, wait_until="domcontentloaded", timeout=60000)
        deadline = asyncio.get_event_loop().time() + 15
        info = None
        while asyncio.get_event_loop().time() < deadline:
            info = await page.evaluate("() => window._itemInfo || null")
            if info and (info.get("product") or info.get("item")):
                break
            await page.wait_for_timeout(300)
        page_text = await _page_text(page)
        product = (info or {}).get("product") or {}
        _raise_if_delisted(page_text, product)
        if not info:
            raise CollectError("blocked", "京东移动端商品数据未加载", status=502)
        product = info.get("product") or {}
        item = info.get("item") or {}
        title = (product.get("skuName") or item.get("skuName") or (info.get("shareInfo") or {}).get("title") or "").strip()
        brand = (product.get("brandName") or product.get("cBrand") or item.get("brandName") or "").strip()
        model = str(product.get("model") or "").strip()
        if not model:
            features = ((product.get("extend") or {}).get("productFeatures") or {})
            model = str(features.get("model") or "").strip()
        price_floor = info.get("priceFloor") or {}
        member = parse_price(str(price_floor.get("price") or ""))
        if member is None:
            member = parse_price(str(((price_floor.get("ext") or {}).get("jdPrice")) or ""))
        images = uniquify_images(
            [product.get("imageurl")] + list(item.get("image") or []),
            GALLERY_LIMIT,
        )
        params = {}
        if brand:
            params["品牌"] = brand
        params["商品编号"] = sku
        if model:
            params["型号"] = model
            params["货号"] = model
        area = (product.get("productArea") or "").strip()
        if area:
            params["产地"] = area
        sale = str(product.get("saleDate") or "")
        if sale:
            params["上架时间"] = sale[:10]
        shop = ""
        try:
            body_text = await page.locator("body").inner_text()
        except Exception:
            body_text = ""
        shop_match = re.search(r"([\u4e00-\u9fffA-Za-z0-9]{2,30}(?:旗舰店|专卖店|官方旗舰店))", body_text)
        if shop_match:
            shop = shop_match.group(1)
            params["店铺"] = shop
        services = [token for token in SERVICE_TOKENS if token in body_text]
        if not title or not images:
            raise CollectError(
                "parse_incomplete",
                f"抽取不完整：title={title!r} images={len(images)}",
                status=502,
            )
        spec = model or sku
        crumb = crumb_from_cats(str(product.get("category") or ""), brand)
        return {
            "platform": "jd",
            "sku": sku,
            "url": f"https://item.jd.com/{sku}.html",
            "variant": "m_item_info",
            "title": title[:200],
            "memberPrice": member,
            "marketPrice": member,
            "crumb": crumb,
            "spec": spec,
            "params": params,
            "images": images[:GALLERY_LIMIT],
            "detailImages": [],
            "services": services,
            "shop": shop,
        }
    except CollectError:
        raise
    except Exception as exc:
        raise CollectError("blocked", f"打开京东移动端商品页失败：{exc}", status=502) from exc
    finally:
        await _close_page(page)


async def scrape_jd(pool: BrowserPool, url: str) -> dict:
    sku = parse_jd_sku(url)
    try:
        product = await _scrape_pc(pool, sku)
    except CollectError as exc:
        if exc.code == "delisted":
            raise
        product = await _scrape_mobile(pool, sku)
    except Exception:
        product = await _scrape_mobile(pool, sku)
    # 移动端 image 列表常只有 2～3 张；优先用更长的 PC 轮播覆盖
    current = list(product.get("images") or [])
    if len(current) < GALLERY_LIMIT:
        try:
            more = await fetch_gallery_images(pool, sku)
            if len(more) > len(current):
                product["images"] = more
        except Exception:
            pass
    # 图文必须在稳定页单独拉取：商详 PC 频控/移动端跳转会导致 fetch 失败
    try:
        details = await fetch_detail_images(pool, sku)
    except Exception:
        details = []
    product["detailImages"] = details
    return product
