from __future__ import annotations

import ipaddress
import re
from urllib.parse import parse_qs, urlparse

SUPPORTED_PLATFORMS = ("jd", "taobao", "huiecai", "qilu")
SKU_PREFIX = {"jd": "JD", "taobao": "TB", "huiecai": "HWLY", "qilu": "QLYC"}
PLATFORM_LABEL = {
    "jd": "京东",
    "taobao": "淘宝/天猫",
    "huiecai": "徽e采",
    "qilu": "齐鲁云采",
}

JD_HOSTS = (
    "item.jd.com",
    "item.m.jd.com",
    "jd.com",
    "www.jd.com",
)


class CollectError(Exception):
    def __init__(self, code: str, message: str, status: int = 400):
        super().__init__(message)
        self.code = code
        self.message = message
        self.status = status


def parse_jd_sku(url_or_sku: str) -> str:
    text = (url_or_sku or "").strip()
    for pattern in (
        r"item\.m?\.jd\.com/(?:product/)?(\d+)",
        r"[?&](?:sku|skuId|wareId)=(\d+)",
        r"(?:cases/|JD-)(\d{6,})",
        r"(\d{8,})",
        r"^(\d{6,})$",
    ):
        match = re.search(pattern, text, re.I)
        if match:
            return match.group(1)
    raise CollectError("invalid_url", "无法从链接解析京东 SKU")


def parse_huiecai_id(url: str) -> str:
    text = (url or "").strip()
    for pattern in (
        r"goodsInfo/(\d+)",
        r"(?:HWLY-|huiecai-)(\d+)",
        r"/(\d{4,})\.html",
    ):
        match = re.search(pattern, text, re.I)
        if match:
            return match.group(1)
    raise CollectError("invalid_url", "请粘贴徽e采商品详情链接，例如 http://hwly.miniappss.com/goodsInfo/84395.html")


def parse_qilu_guid(url: str) -> str:
    text = (url or "").strip()
    parsed = urlparse(text if "://" in text else f"https://{text}")
    query = parse_qs(parsed.query)
    for key in ("goodspriceguid", "goodsPriceGuid", "goodsPriceGUID"):
        values = query.get(key) or query.get(key.lower())
        if values and values[0].strip():
            return values[0].strip()
    match = re.search(r"(?:goodspriceguid|QLYC-)([0-9A-Za-z-]{8,})", text, re.I)
    if match:
        return match.group(1)
    path = (parsed.path or "").lower()
    if "scshortlistedgoodslibrary" in path or path.rstrip("/").endswith("goodslist"):
        raise CollectError(
            "invalid_url",
            "请粘贴齐鲁云采入围商品详情链接（需包含 goodspriceguid），不要使用入围商品库列表页",
        )
    raise CollectError(
        "invalid_url",
        "请粘贴齐鲁云采商品详情链接，例如 .../goodslibrary/gpfa/goodsDetail?goodspriceguid=xxxx",
    )


def sku_code(platform: str, source_id: str) -> str:
    prefix = SKU_PREFIX.get(platform or "", "SRC")
    return f"{prefix}-{source_id}"


def platform_label(platform: str) -> str:
    return PLATFORM_LABEL.get(platform or "", platform or "采集")


def _host_of(url: str) -> str:
    try:
        parsed = urlparse(url if "://" in url else f"https://{url}")
        return (parsed.hostname or "").lower()
    except ValueError:
        return ""



def _is_public_host(host: str) -> bool:
    if not host:
        return False
    try:
        addr = ipaddress.ip_address(host)
        return addr.is_global
    except ValueError:
        return True

def detect_platform(url: str, platform: str | None) -> str:
    requested = (platform or "").strip().lower() or None
    host = _host_of(url)
    path = ""
    try:
        parsed = urlparse(url if "://" in url else f"https://{url}")
        path = (parsed.path or "").lower()
        query = (parsed.query or "").lower()
    except ValueError:
        query = ""
    detected = None
    if host.endswith(".jd.com") or host in JD_HOSTS or host.endswith("jd.com"):
        detected = "jd"
    elif any(host == item or host.endswith("." + item) for item in (
        "taobao.com", "tmall.com", "tmall.hk",
    )):
        detected = "taobao"
    elif host.endswith("miniappss.com") or host.endswith("huiecai.com") or (
        "goodsinfo/" in path and _is_public_host(host)
    ):
        detected = "huiecai"
    elif host.endswith("shandong.gov.cn") or (
        _is_public_host(host)
        and (
            "gpfa-main-web" in path
            or "goodslibrary" in path
            or "goodspriceguid" in query
            or "scshortlistedgoodslibrary" in path
        )
    ):
        detected = "qilu"
    elif re.fullmatch(r"\d{6,}", (url or "").strip()):
        detected = requested
    if requested:
        if requested not in SUPPORTED_PLATFORMS:
            raise CollectError("unsupported_platform", f"不支持的平台：{requested}")
        if detected and detected != requested:
            raise CollectError("platform_mismatch", "选择的平台与商品链接不一致")
        return requested
    if detected:
        return detected
    raise CollectError("unsupported_platform", "无法从链接识别平台，请选择京东、淘宝/天猫、徽e采或齐鲁云采")
