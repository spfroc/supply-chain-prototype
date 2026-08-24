from __future__ import annotations

import hashlib
import html
import http.cookiejar
import json
import os
import re
import time
import urllib.parse
import urllib.request

from platforms import CollectError

MTOP_API = "mtop.taobao.detail.data.get"
MTOP_VERSION = "1.0"
MTOP_APP_KEY = "12574478"
MTOP_ENDPOINT = "https://h5api.m.taobao.com/h5/mtop.taobao.detail.data.get/1.0/"
MOBILE_UA = (
    "Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36"
)


def parse_item_url(url: str) -> tuple[str, str | None]:
    text = (url or "").strip().replace("&amp;", "&")
    try:
        parsed = urllib.parse.urlparse(text)
    except ValueError as exc:
        raise CollectError("invalid_url", "淘宝/天猫商品链接格式不正确") from exc
    host = (parsed.hostname or "").lower()
    if not (host.endswith("taobao.com") or host.endswith("tmall.com") or host.endswith("tmall.hk")):
        raise CollectError("invalid_url", "请粘贴淘宝或天猫商品详情链接")
    query = urllib.parse.parse_qs(parsed.query)
    item_id = next(iter(query.get("id") or query.get("itemId") or []), "")
    sku_id = next(iter(query.get("skuId") or query.get("sku_id") or []), "") or None
    if not re.fullmatch(r"\d{6,}", item_id):
        raise CollectError("invalid_url", "无法从淘宝/天猫链接解析商品 ID")
    return item_id, sku_id


def _cookie_jar(raw: str) -> http.cookiejar.CookieJar:
    jar = http.cookiejar.CookieJar()
    for part in (raw or "").split(";"):
        if "=" not in part:
            continue
        name, value = part.strip().split("=", 1)
        if not name:
            continue
        jar.set_cookie(http.cookiejar.Cookie(
            version=0, name=name, value=value, port=None, port_specified=False,
            domain=".taobao.com", domain_specified=True, domain_initial_dot=True,
            path="/", path_specified=True, secure=True, expires=None, discard=True,
            comment=None, comment_url=None, rest={}, rfc2109=False,
        ))
    return jar


def _token(jar: http.cookiejar.CookieJar) -> str | None:
    for cookie in jar:
        if cookie.name == "_m_h5_tk" and cookie.value:
            return cookie.value.split("_", 1)[0]
    return None


def _request_data(item_id: str, sku_id: str | None) -> str:
    payload = {"itemNumId": item_id}
    if sku_id:
        payload["skuId"] = sku_id
    return json.dumps(payload, ensure_ascii=False, separators=(",", ":"))


def fetch_detail(item_id: str, sku_id: str | None, cookie: str | None = None) -> dict:
    raw_cookie = cookie if cookie is not None else os.environ.get("TAOBAO_MTOP_COOKIE", "")
    if not raw_cookie.strip():
        raise CollectError(
            "taobao_auth_required",
            "淘宝/天猫要求登录采集，请先在服务器安全配置 TAOBAO_MTOP_COOKIE",
            status=401,
        )
    jar = _cookie_jar(raw_cookie)
    token = _token(jar)
    if not token:
        raise CollectError(
            "taobao_auth_required",
            "淘宝/天猫登录凭证缺少 _m_h5_tk，请更新 TAOBAO_MTOP_COOKIE",
            status=401,
        )
    data = _request_data(item_id, sku_id)
    timestamp = str(int(time.time() * 1000))
    sign = hashlib.md5(f"{token}&{timestamp}&{MTOP_APP_KEY}&{data}".encode()).hexdigest()
    query = urllib.parse.urlencode({
        "jsv": "2.7.4", "appKey": MTOP_APP_KEY, "t": timestamp, "sign": sign,
        "api": MTOP_API, "v": MTOP_VERSION, "type": "originaljson", "dataType": "json",
        "timeout": "20000", "data": data,
    })
    opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(jar))
    request = urllib.request.Request(
        f"{MTOP_ENDPOINT}?{query}",
        headers={"User-Agent": MOBILE_UA, "Referer": f"https://h5.m.taobao.com/awp/core/detail.htm?id={item_id}"},
    )
    try:
        with opener.open(request, timeout=30) as response:
            result = json.loads(response.read().decode("utf-8", "replace"))
    except (OSError, ValueError) as exc:
        raise CollectError("taobao_request_failed", f"淘宝/天猫详情请求失败：{exc}", status=502) from exc
    ret = result.get("ret") or []
    if not isinstance(ret, list):
        ret = [str(ret)]
    joined = "；".join(map(str, ret))
    if any(word in joined.upper() for word in ("TOKEN", "SESSION", "LOGIN", "RGV587")):
        raise CollectError("taobao_auth_expired", "淘宝/天猫登录凭证已失效或触发安全校验，请更新登录凭证后重试", status=401)
    if not any(str(code).startswith("SUCCESS") for code in ret):
        raise CollectError("taobao_request_failed", f"淘宝/天猫返回错误：{joined or '未知错误'}", status=502)
    detail = result.get("data")
    if not isinstance(detail, dict) or not detail:
        raise CollectError("taobao_parse_failed", "淘宝/天猫未返回商品详情", status=502)
    return detail


def _jsonish(value):
    if isinstance(value, (dict, list)):
        return value
    if isinstance(value, str):
        try:
            return json.loads(value)
        except ValueError:
            return None
    return None


def _price(value) -> float | None:
    if isinstance(value, dict):
        value = value.get("priceText") or value.get("price") or value.get("value")
    match = re.search(r"\d+(?:\.\d+)?", str(value or ""))
    return float(match.group()) if match else None


def _sku_info(data: dict, selected_sku: str | None) -> tuple[str | None, str, float | None, float | None]:
    sku_base = data.get("skuBase") or {}
    sku_core = data.get("skuCore") or {}
    sku2info = sku_core.get("sku2info") or {}
    if not sku2info:
        for stack in data.get("apiStack") or []:
            value = _jsonish((stack or {}).get("value")) or {}
            sku2info = ((value.get("skuCore") or {}).get("sku2info") or sku2info)
    skus = sku_base.get("skus") or []
    chosen = next((row for row in skus if str(row.get("skuId")) == str(selected_sku)), None)
    if chosen is None and len(skus) == 1:
        chosen = skus[0]
    selected = str((chosen or {}).get("skuId") or selected_sku or "0")
    prop_names: dict[str, str] = {}
    value_names: dict[str, str] = {}
    for prop in sku_base.get("props") or []:
        pid = str(prop.get("pid") or "")
        prop_names[pid] = str(prop.get("name") or "规格")
        for value in prop.get("values") or []:
            value_names[f"{pid}:{value.get('vid')}"] = str(value.get("name") or "")
    parts = []
    for pair in str((chosen or {}).get("propPath") or "").split(";"):
        if ":" not in pair:
            continue
        pid = pair.split(":", 1)[0]
        parts.append(f"{prop_names.get(pid, '规格')}={value_names.get(pair, pair)}")
    info = sku2info.get(selected) or sku2info.get("0") or {}
    member = _price(info.get("price") or info.get("promotionPrice") or info.get("priceText"))
    market = _price(info.get("originalPrice") or info.get("price")) or member
    return (selected if selected != "0" else selected_sku), "；".join(parts) or "默认", market, member


def parse_detail(data: dict, item_id: str, selected_sku: str | None) -> dict:
    item = data.get("item") or {}
    seller = data.get("seller") or {}
    sku, spec, market, member = _sku_info(data, selected_sku)
    params: dict[str, str] = {}
    props = data.get("props") or {}
    groups = props.get("groupProps") if isinstance(props, dict) else props
    for group in groups or []:
        for row in (group or {}).get("基本信息", []) if isinstance(group, dict) else []:
            if isinstance(row, dict):
                for key, value in row.items():
                    if key and value not in (None, ""):
                        params[str(key)] = html.unescape(str(value))
    title = html.unescape(str(item.get("title") or item.get("subtitle") or "")).strip()
    if not title:
        raise CollectError("taobao_parse_failed", "淘宝/天猫商品标题解析失败", status=502)
    brand = params.get("品牌") or params.get("Brand") or str(seller.get("shopName") or "未品牌")
    params.setdefault("品牌", brand)
    images = [str(url).replace("//", "https://", 1) if str(url).startswith("//") else str(url)
              for url in item.get("images") or [] if url]
    desc_images: list[str] = []
    desc = data.get("desc") or data.get("description") or {}
    for url in re.findall(r"(?:https?:)?//[^\"'<>\s]+?\.(?:jpe?g|png|webp)(?:\?[^\"'<>\s]*)?", str(desc)):
        desc_images.append("https:" + url if url.startswith("//") else url)
    return {
        "platform": "taobao", "sku": sku or item_id, "sourceItemId": item_id,
        "title": title, "images": images, "detailImages": list(dict.fromkeys(desc_images))[:60],
        "crumb": ["淘宝/天猫", brand], "params": params, "spec": spec,
        "marketPrice": market, "memberPrice": member,
        "sourceUrl": f"https://detail.tmall.com/item.htm?id={item_id}" + (f"&skuId={sku}" if sku else ""),
    }


async def scrape_taobao(url: str) -> dict:
    item_id, sku_id = parse_item_url(url)
    return parse_detail(fetch_detail(item_id, sku_id), item_id, sku_id)
