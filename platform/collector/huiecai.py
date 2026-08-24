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
        await page.goto(page_url, wait_until="domcontentloaded", timeout=60000)
        data = await _wait_product(page, sku)
        text = await _page_text(page)
        if any(marker in text for marker in DELISTED):
            raise CollectError("delisted", "徽e采商品已下架或不存在", status=410)
        title = (data.get("title") or "").strip()
        images = [item for item in (data.get("images") or []) if item.startswith("http")]
        details = [item for item in (data.get("details") or []) if item.startswith("http")]
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


async def _wait_product(page, sku: str) -> dict:
    deadline = asyncio.get_event_loop().time() + 25
    last: dict = {}
    while asyncio.get_event_loop().time() < deadline:
        last = await page.evaluate(
            """(sku) => {
              const skip = new Set(['所有商品分类','商品推荐','免费获取专业定制咨询']);
              const titles = [...document.querySelectorAll('h3')].map(h => (h.innerText || '').trim());
              const title = titles.find(t => t && !t.includes('￥') && !t.includes('¥') && !skip.has(t)) || '';
              const priceText = (document.querySelector('.price_range, .shop_price_show, .price')?.innerText || '')
                || (titles.find(t => t.includes('￥') || t.includes('¥')) || '');
              const params = {};
              for (const li of document.querySelectorAll('.p-parameter-list li, .parameter2 li')) {
                const text = (li.innerText || '').replace(/\\s+/g, ' ').trim();
                const match = text.match(/^(.{1,20}?)[:：]\\s*(.+)$/);
                if (match) params[match[1].trim()] = match[2].trim();
              }
              const uniq = (items) => [...new Set(items.filter(Boolean))];
              const images = uniq([...document.querySelectorAll('.pic img, .big-img img, .small-img img')].map(img =>
                img.getAttribute('src') || img.getAttribute('data-original') || img.getAttribute('data-src') || ''
              ).filter(src => src.includes('/swiper/') && (!sku || src.includes('/' + sku + '/'))));
              const details = uniq([...document.querySelectorAll('.article-body img, img.content_img_class')].map(img =>
                img.getAttribute('src') || img.getAttribute('data-original') || ''
              ).filter(src => /^https?:/.test(src) && !src.includes('static2026')));
              return {title, priceText, params, images, details};
            }""",
            sku,
        )
        if last.get("title") and last.get("images"):
            return last
        await page.wait_for_timeout(500)
    if last.get("title") and last.get("images"):
        return last
    raise CollectError("blocked", "徽e采商品页未加载完成，请稍后重试", status=502)
