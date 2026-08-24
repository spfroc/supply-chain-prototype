from __future__ import annotations

import asyncio
import re

from jd import BrowserPool, parse_price, _close_page
from platforms import CollectError, parse_qilu_guid

DETAIL_URL = (
    "https://ggzyjyzx.shandong.gov.cn:8182/gpfa-main-web/goodslibrary/gpfa/goodsDetail"
    "?goodspriceguid={guid}&platform=3100"
)


async def scrape_qilu(pool: BrowserPool, url: str) -> dict:
    guid = parse_qilu_guid(url)
    page_url = DETAIL_URL.format(guid=guid)
    page = await pool.new_page(ignore_https_errors=True)
    try:
        await page.goto(page_url, wait_until="domcontentloaded", timeout=60000)
        data = await _wait_detail(page)
        goods = data.get("goods") or {}
        price = data.get("price") or {}
        title = str(goods.get("name") or data.get("title") or "").strip()
        brand = str(goods.get("goodsBrandName") or price.get("goodsBrandName") or "").strip()
        member = parse_price(str(price.get("currentPrice") or goods.get("salesPrice") or data.get("priceText") or ""))
        market = parse_price(str(goods.get("marketPrice") or "")) or member
        sell_status = price.get("sellStatus")
        goods_state = goods.get("goodsState")
        sold_out = str(price.get("soldOutReason") or "").strip()
        if sold_out or sell_status not in (None, 1, "1") or goods_state not in (None, 1, "1"):
            raise CollectError("delisted", sold_out or "齐鲁云采商品已下架或不在售", status=410)
        images = _pictures(goods, data)
        details = _content_images(str(data.get("goodsContent") or ""))
        params = _params(goods)
        if brand:
            params.setdefault("品牌", brand)
        if goods.get("goodsCode"):
            params.setdefault("商品编号", str(goods.get("goodsCode")))
        if goods.get("unit"):
            params.setdefault("单位", str(goods.get("unit")))
        spec = params.get("型号") or params.get("产品尺寸") or params.get("规格") or guid[-8:]
        crumb = _crumb(str(data.get("classTree") or ""), brand)
        if not title or not images:
            raise CollectError("parse_incomplete", "齐鲁云采商品页缺少标题或主图", status=502)
        return {
            "platform": "qilu",
            "sku": guid,
            "url": page_url,
            "title": title[:200],
            "memberPrice": member,
            "marketPrice": market,
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
        raise CollectError("blocked", f"打开齐鲁云采商品页失败：{exc}", status=502) from exc
    finally:
        await _close_page(page)


async def _wait_detail(page) -> dict:
    deadline = asyncio.get_event_loop().time() + 30
    last: dict = {}
    while asyncio.get_event_loop().time() < deadline:
        last = await page.evaluate(
            """() => {
              const root = [...document.querySelectorAll('.pageBg')].find(el => el.__vue__ && el.__vue__.goods_info);
              if (!root || !root.__vue__) return {};
              const vm = root.__vue__;
              const info = vm.goods_info || {};
              const price = info.goodsPrice || {};
              const goods = price.goods || {};
              return {
                goods,
                price,
                classTree: info.goodsClassNameTree || '',
                goodsContent: vm.goodsContent || '',
                title: goods.name || '',
              };
            }"""
        )
        goods = (last or {}).get("goods") or {}
        if goods.get("name") and (goods.get("picturePath") or goods.get("pictureList")):
            return last
        await page.wait_for_timeout(400)
    goods = (last or {}).get("goods") or {}
    if goods.get("name"):
        return last
    raise CollectError("blocked", "齐鲁云采商品详情未加载完成，请稍后重试", status=502)


def _pictures(goods: dict, data: dict) -> list[str]:
    urls: list[str] = []
    seen: set[str] = set()

    def add(url: str) -> None:
        text = str(url or "").strip()
        if not text.startswith("http") or text in seen:
            return
        seen.add(text)
        urls.append(text)

    pictures = list(goods.get("pictureList") or [])
    pictures.sort(key=lambda item: 0 if int((item or {}).get("mainPct") or 0) == 1 else 1)
    for item in pictures:
        if isinstance(item, dict):
            add(item.get("filePath") or "")
        else:
            add(str(item))
    add(str(goods.get("picturePath") or ""))
    for item in goods.get("pictureArray") or []:
        add(str(item))
    for src in _content_images(str(data.get("goodsContent") or "")):
        add(src)
        if len(urls) >= 6:
            break
    return urls


def _content_images(html: str) -> list[str]:
    urls: list[str] = []
    seen: set[str] = set()
    for src in re.findall(r'<img[^>]+src=["\']([^"\']+)["\']', html or "", flags=re.I):
        if src.startswith("http") and src not in seen:
            seen.add(src)
            urls.append(src)
    return urls


def _params(goods: dict) -> dict[str, str]:
    params: dict[str, str] = {}
    for item in goods.get("goodsParamValueList") or []:
        if not isinstance(item, dict):
            continue
        name = str(item.get("paramName") or item.get("name") or "").strip()
        value = str(item.get("paramValue") or item.get("value") or "").strip()
        if name and value:
            params[name] = value
    if goods.get("model"):
        params.setdefault("型号", str(goods.get("model")).strip())
    return params


def _crumb(class_tree: str, brand: str) -> list[str]:
    parts = [part.strip() for part in (class_tree or "").replace("/", "-").split("-") if part.strip()]
    parts.reverse()
    names = [part for part in parts if part and part != brand][:3]
    if not names:
        names = ["齐鲁云采", "入围商品库"]
        if brand:
            names.append(brand)
    return names
