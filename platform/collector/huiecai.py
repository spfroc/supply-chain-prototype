from __future__ import annotations

import asyncio

from jd import BrowserPool, parse_price, _close_page, _page_text
from platforms import CollectError, parse_huiecai_id

DELISTED = (
    "商品已下架",
    "该商品已下架",
    "商品不存在",
    "您访问的商品不存在",
    "找不到该商品",
    "页面不存在",
)


async def scrape_huiecai(pool: BrowserPool, url: str) -> dict:
    sku = parse_huiecai_id(url)
    page_url = url.strip()
    if "://" not in page_url:
        page_url = f"http://{page_url}"
    if "goodsInfo" not in page_url:
        page_url = f"http://hwly.miniappss.com/goodsInfo/{sku}.html"
    page = await pool.new_page()
    try:
        data: dict = {}
        last_error: CollectError | None = None
        # The marketplace occasionally returns a transient 403/empty shell before its
        # own JavaScript retry succeeds.  Give one fresh navigation a chance inside a
        # collection attempt instead of making the whole backend job fail immediately.
        for navigation_attempt in range(2):
            try:
                if navigation_attempt == 0:
                    await page.goto(page_url, wait_until="domcontentloaded", timeout=60000)
                else:
                    await page.wait_for_timeout(1200)
                    await page.goto(page_url, wait_until="domcontentloaded", timeout=60000)
                data = await _wait_product(page, timeout_seconds=15)
                break
            except CollectError as exc:
                last_error = exc
        if not data:
            raise last_error or CollectError("blocked", "徽e采商品页未加载完成，请稍后重试", status=502)
        text = await _page_text(page)
        if any(marker in text for marker in DELISTED):
            raise CollectError("delisted", "徽e采商品已下架或不存在", status=410)
        title = (data.get("title") or "").strip()
        images = _normalize_image_urls(data.get("images") or [])
        details = _normalize_image_urls(data.get("details") or [], exclude_static=True)
        params = data.get("params") or {}
        member = parse_price(str(data.get("priceText") or ""))
        brand = str(params.get("品牌") or "").strip()
        spec = params.get("型号") or params.get("净含量") or params.get("规格") or sku
        if not title or not images:
            raise CollectError("parse_incomplete", "徽e采商品页缺少标题或主图", status=502)
        crumb = ["徽e采", "官方商城"]
        if brand:
            crumb.append(brand)
            params.setdefault("品牌", brand)
        params.setdefault("商品编号", sku)
        return {
            "platform": "huiecai",
            "sku": sku,
            "url": page.url,
            "title": title[:200],
            "memberPrice": member,
            "marketPrice": member,
            "crumb": crumb,
            "spec": spec,
            "params": params,
            "images": images[:6],
            "detailImages": details[:40],
            "services": [],
        }
    except CollectError:
        raise
    except Exception as exc:
        raise CollectError("blocked", f"打开徽e采商品页失败：{exc}", status=502) from exc
    finally:
        await _close_page(page)


def _normalize_image_urls(items: list[str], *, exclude_static: bool = False) -> list[str]:
    """Keep marketplace media URLs in DOM order without assuming a CDN path layout."""
    result: list[str] = []
    seen: set[str] = set()
    for value in items:
        url = str(value or "").strip()
        if url.startswith("//"):
            url = f"https:{url}"
        if not url.startswith(("http://", "https://")):
            continue
        if exclude_static and "static2026" in url:
            continue
        if url not in seen:
            seen.add(url)
            result.append(url)
    return result


async def _wait_product(page, timeout_seconds: int = 15) -> dict:
    deadline = asyncio.get_event_loop().time() + timeout_seconds
    last: dict = {}
    while asyncio.get_event_loop().time() < deadline:
        last = await page.evaluate(
            """() => {
              const skip = new Set(['所有商品分类','商品推荐','免费获取专业定制咨询']);
              const preferredTitle = document.querySelector('.product-main .title h3, .txt .title h3, .title h3');
              const titles = [...document.querySelectorAll('h3')].map(h => (h.innerText || '').trim());
              const title = (preferredTitle?.innerText || '').trim()
                || titles.find(t => t && !t.includes('￥') && !t.includes('¥') && !skip.has(t)) || '';
              const priceText = (document.querySelector('.price_range, .shop_price_show, .price')?.innerText || '')
                || (titles.find(t => t.includes('￥') || t.includes('¥')) || '');
              const params = {};
              for (const li of document.querySelectorAll('.p-parameter-list li, .parameter2 li')) {
                const text = (li.innerText || '').replace(/\\s+/g, ' ').trim();
                const match = text.match(/^(.{1,20}?)[:：]\\s*(.+)$/);
                if (match) params[match[1].trim()] = match[2].trim();
              }
              const uniq = (items) => [...new Set(items.filter(Boolean))];
              // Scope gallery extraction to the product gallery.  Do not filter by
              // /swiper/<sku>: the current site serves valid images from /terminal/.
              const images = uniq([...document.querySelectorAll('.big-img img, .small-img img')].map(img =>
                img.currentSrc || img.getAttribute('src') || img.getAttribute('data-original') || img.getAttribute('data-src') || ''
              ));
              const details = uniq([...document.querySelectorAll('.article-body img, img.content_img_class')].map(img =>
                img.currentSrc || img.getAttribute('src') || img.getAttribute('data-original') || img.getAttribute('data-src') || ''
              ));
              return {title, priceText, params, images, details};
            }""",
        )
        if last.get("title") and last.get("images"):
            return last
        await page.wait_for_timeout(500)
    if last.get("title") and last.get("images"):
        return last
    normalized = _normalize_image_urls(last.get("images") or [])
    raise CollectError(
        "parse_incomplete",
        f"徽e采商品页面已打开，但未解析到完整商品信息（标题={'有' if last.get('title') else '无'}，主图={len(normalized)}张）",
        status=502,
    )
