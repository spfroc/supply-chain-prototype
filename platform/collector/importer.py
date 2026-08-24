from __future__ import annotations

import hashlib
import io
import ipaddress
import json
import os
import re
import socket
import urllib.error
import urllib.parse
import urllib.request

import ssl

from jd import UA, graphic_path_url, jfs_upgrade
from platforms import CollectError, sku_code

SKIP_PARAM_KEYS = {"品牌", "店铺", "商品编号", "产品编号"}
KNOWN_ATTR = {
    "型号": {"code": "MODEL", "inputType": "TEXT", "groupName": "基本信息", "attributeType": "BASIC", "unit": "", "requiredFlag": 1},
    "产地": {"code": "ORIGIN", "inputType": "TEXT", "groupName": "基本信息", "attributeType": "BASIC", "unit": "", "requiredFlag": 0},
    "质保期": {"code": "WARRANTY", "inputType": "NUMBER", "groupName": "服务信息", "attributeType": "EXTENDED", "unit": "个月", "requiredFlag": 0},
    "产品尺寸": {"code": "DIMENSIONS", "inputType": "TEXT", "groupName": "规格参数", "attributeType": "BASIC", "unit": "mm", "requiredFlag": 0},
    "产品重量": {"code": "WEIGHT", "inputType": "NUMBER", "groupName": "规格参数", "attributeType": "BASIC", "unit": "kg", "requiredFlag": 0},
    "颜色": {"code": "COLOR", "inputType": "SELECT", "groupName": "基本信息", "attributeType": "SPEC", "unit": "", "requiredFlag": 0},
    "材质": {"code": "MATERIAL", "inputType": "TEXT", "groupName": "规格参数", "attributeType": "BASIC", "unit": "", "requiredFlag": 0},
    "额定功率": {"code": "RATED_POWER", "inputType": "NUMBER", "groupName": "电气参数", "attributeType": "BASIC", "unit": "W", "requiredFlag": 0},
    "适用面积": {"code": "APPLICABLE_AREA", "inputType": "TEXT", "groupName": "使用参数", "attributeType": "BASIC", "unit": "㎡", "requiredFlag": 0},
    "能效等级": {"code": "ENERGY_GRADE", "inputType": "SELECT", "groupName": "能效参数", "attributeType": "BASIC", "unit": "", "requiredFlag": 0},
}
ATTR_ALIASES = {
    "型号": ["型号", "货号", "能效网规格型号", "规格型号"],
    "MODEL": ["型号", "货号", "能效网规格型号", "规格型号"],
    "质保期": ["质保期", "保修期", "保修", "保质期", "原厂质保期限（年）"],
    "WARRANTY": ["质保期", "保修期", "保修", "保质期", "原厂质保期限（年）"],
    "产地": ["产地", "原产地"],
    "ORIGIN": ["产地", "原产地"],
    "产品尺寸": ["产品尺寸", "尺寸", "外形尺寸", "产品尺寸(mm)"],
    "DIMENSIONS": ["产品尺寸", "尺寸", "外形尺寸", "产品尺寸(mm)"],
    "产品重量": ["产品重量", "重量", "净重"],
    "WEIGHT": ["产品重量", "重量", "净重"],
    "颜色": ["颜色", "色系", "颜色分类"],
    "COLOR": ["颜色", "色系", "颜色分类"],
    "认证信息": ["认证信息", "认证"],
    "CERTIFICATION": ["认证信息", "认证"],
}


def graphic_url(path: str) -> str:
    return graphic_path_url(path)


def _validate_public_http_url(url: str) -> None:
    parsed = urllib.parse.urlparse(url)
    if parsed.scheme not in {"http", "https"} or not parsed.hostname:
        raise RuntimeError("仅允许下载 HTTP/HTTPS 图片")
    try:
        addresses = socket.getaddrinfo(
            parsed.hostname,
            parsed.port or (443 if parsed.scheme == "https" else 80),
        )
    except socket.gaierror as exc:
        raise RuntimeError(f"无法解析图片域名：{parsed.hostname}") from exc
    for address in addresses:
        if not ipaddress.ip_address(address[4][0]).is_global:
            raise RuntimeError(f"禁止访问非公网图片地址：{parsed.hostname}")


class _SafeRedirectHandler(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        _validate_public_http_url(newurl)
        return super().redirect_request(req, fp, code, msg, headers, newurl)


def http_get(url: str, timeout: int = 20) -> bytes:
    _validate_public_http_url(url)
    req = urllib.request.Request(url, headers={"User-Agent": UA, "Referer": url})
    try:
        opener = urllib.request.build_opener(_SafeRedirectHandler())
        with opener.open(req, timeout=timeout) as resp:
            length = int(resp.headers.get("Content-Length") or 0)
            if length > 20 * 1024 * 1024:
                raise RuntimeError("图片文件超过20MB")
            data = resp.read(20 * 1024 * 1024 + 1)
            if len(data) > 20 * 1024 * 1024:
                raise RuntimeError("图片文件超过20MB")
            return data
    except urllib.error.HTTPError as exc:
        raise RuntimeError(f"GET {url} -> {exc.code}") from exc
    except (ssl.SSLError, urllib.error.URLError) as exc:
        raise RuntimeError(f"安全下载图片失败：{url}") from exc


def square_jpeg(data: bytes, size: int = 800) -> bytes:
    from PIL import Image
    image = Image.open(io.BytesIO(data)).convert("RGB")
    side = max(image.size)
    canvas = Image.new("RGB", (side, side), (255, 255, 255))
    canvas.paste(image, ((side - image.width) // 2, (side - image.height) // 2))
    canvas = canvas.resize((size, size), Image.Resampling.LANCZOS)
    out = io.BytesIO()
    canvas.save(out, format="JPEG", quality=90)
    return out.getvalue()


def to_rich_jpeg(data: bytes) -> bytes:
    from PIL import Image
    image = Image.open(io.BytesIO(data)).convert("RGB")
    width, height = image.size
    max_side = 3840
    if width > max_side or height > max_side:
        scale = min(max_side / width, max_side / height)
        image = image.resize((max(1, int(width * scale)), max(1, int(height * scale))), Image.Resampling.LANCZOS)
        width, height = image.size
    if width < 300 or height < 200:
        canvas = Image.new("RGB", (max(width, 300), max(height, 200)), (255, 255, 255))
        canvas.paste(image, ((canvas.width - width) // 2, (canvas.height - height) // 2))
        image = canvas
    out = io.BytesIO()
    image.save(out, format="JPEG", quality=85)
    blob = out.getvalue()
    if len(blob) > 8 * 1024 * 1024:
        out = io.BytesIO()
        image.save(out, format="JPEG", quality=70)
        blob = out.getvalue()
    return blob


def detail_html(params: dict, title: str, detail_urls: list[str] | None = None) -> str:
    images = "".join(
        f'<p style="margin:0;text-align:center"><img src="{url}" alt="{title}" loading="lazy" style="max-width:100%;height:auto"></p>'
        for url in (detail_urls or [])
    )
    rows = "".join(
        f"<tr><th style='text-align:left;padding:6px 12px;background:#f7f7f7'>{k}</th>"
        f"<td style='padding:6px 12px'>{v}</td></tr>"
        for k, v in params.items()
    )
    specs = (
        f"<h3 style='margin:24px 0 12px'>{title}</h3><table border='1' cellspacing='0' cellpadding='0'"
        f" style='border-collapse:collapse;width:100%'>{rows}</table>"
    ) if rows else f"<h3>{title}</h3>"
    return images + specs


class Admin:
    def __init__(self, base: str, authorization: str):
        self.base = base.rstrip("/")
        self.headers = {"Authorization": authorization}

    def request(self, method: str, path: str, data: bytes | None = None, content_type: str | None = None) -> tuple[int, bytes]:
        headers = dict(self.headers)
        if content_type:
            headers["Content-Type"] = content_type
        req = urllib.request.Request(self.base + path, data=data, headers=headers, method=method)
        opener = urllib.request.build_opener(urllib.request.ProxyHandler({}))
        try:
            with opener.open(req, timeout=90) as resp:
                return resp.status, resp.read()
        except urllib.error.HTTPError as exc:
            return exc.code, exc.read()

    def json(self, method: str, path: str, payload: dict | None = None):
        body = None if payload is None else json.dumps(payload, ensure_ascii=False).encode()
        ctype = "application/json" if payload is not None else None
        code, raw = self.request(method, path, body, ctype)
        parsed = json.loads(raw.decode("utf-8") or "{}") if raw else {}
        if code >= 400:
            detail = parsed.get("detail") or parsed.get("message") or raw[:400].decode("utf-8", "replace")
            status = 502 if code >= 500 or code == 429 else code
            raise CollectError("import_failed", f"{method} {path} -> {code} {detail}", status=status)
        return parsed

    def me(self) -> dict:
        code, raw = self.request("GET", "/api/admin/system/me")
        if code >= 400:
            raise CollectError("unauthorized", "后台登录已失效，请重新登录后再采集", status=401)
        return json.loads(raw)

    def upload_jpeg(self, blob: bytes, kind: str) -> str:
        boundary = "----JdCollectBoundary"
        filename = f"{kind}.jpg"
        parts = [
            f"--{boundary}\r\nContent-Disposition: form-data; name=\"file\"; filename=\"{filename}\"\r\n"
            f"Content-Type: image/jpeg\r\n\r\n".encode(),
            blob,
            f"\r\n--{boundary}--\r\n".encode(),
        ]
        code, raw = self.request(
            "POST",
            f"/api/admin/business/uploads/images?kind={kind}",
            b"".join(parts),
            f"multipart/form-data; boundary={boundary}",
        )
        if code >= 400:
            raise CollectError("import_failed", f"上传图片失败 {code}: {raw[:300]!r}", status=502)
        return json.loads(raw)["url"]


def as_rows(data) -> list:
    if isinstance(data, list):
        return data
    if isinstance(data, dict):
        return data.get("records") or data.get("items") or data.get("content") or []
    return []


def parse_jsonish(value, default):
    if value is None:
        return default
    if isinstance(value, (dict, list)):
        return value
    if isinstance(value, str):
        text = value.strip()
        if not text:
            return default
        try:
            parsed = json.loads(text)
        except json.JSONDecodeError:
            return default
        if isinstance(parsed, str):
            try:
                return json.loads(parsed)
            except json.JSONDecodeError:
                return parsed
        return parsed
    return default


def pick_default_template(raw) -> str:
    items = parse_jsonish(raw, [])
    for item in items:
        if item.get("isDefault"):
            return str(item.get("content") or "")
    if items:
        return str(items[0].get("content") or "")
    return ""


def default_templates(admin: Admin) -> tuple[str, str]:
    raw = admin.json("GET", "/api/admin/business/product-content-templates")
    delivery = pick_default_template(raw.get("deliveryTemplates"))
    after_sales = pick_default_template(raw.get("afterSalesTemplates"))
    if not delivery:
        delivery = "自营库存，支持全国配送；现货商品预计1至3个工作日送达，实际时效以收货地址和物流信息为准。"
    if not after_sales:
        after_sales = "商品签收后如发现质量问题，请在7日内联系企业采购管理员提交售后申请。非质量问题退换货以商品实际售后政策为准。"
    return delivery, after_sales


def all_service_ids(admin: Admin) -> list[int]:
    rows = as_rows(admin.json("GET", "/api/admin/business/product-service-options"))
    return [int(row["id"]) for row in rows if row.get("id") is not None]


def ensure_category(admin: Admin, crumb: list[str]) -> int:
    cats = admin.json("GET", "/api/admin/business/categories")
    if isinstance(cats, dict):
        cats = cats.get("records") or cats.get("items") or cats.get("content") or []
    by_parent: dict[object, list] = {}
    for row in cats:
        by_parent.setdefault(row.get("parentId"), []).append(row)
    names = [n for n in crumb if n and "京东" not in n][:3]
    if not names:
        names = ["未分类京东商品"]
    parent_id = None
    current = None
    for index, name in enumerate(names):
        level = index + 1
        siblings = by_parent.get(parent_id, [])
        match = next((row for row in siblings if row.get("name") == name), None)
        if match is None:
            admin.json("POST", "/api/admin/business/categories", {
                "name": name, "parentId": parent_id, "level": level, "sortOrder": 50, "icon": "", "status": 1,
            })
            cats = admin.json("GET", "/api/admin/business/categories")
            if isinstance(cats, dict):
                cats = cats.get("records") or cats.get("items") or []
            by_parent = {}
            for row in cats:
                by_parent.setdefault(row.get("parentId"), []).append(row)
            match = next(row for row in by_parent.get(parent_id, []) if row.get("name") == name)
        parent_id = match["id"]
        current = match
    while current and int(current.get("level") or 1) < 3:
        child_name = f"{current['name']}-默认"
        children = by_parent.get(current["id"], [])
        existing = next((row for row in children if row.get("name") == child_name), None)
        if existing is None:
            admin.json("POST", "/api/admin/business/categories", {
                "name": child_name, "parentId": current["id"],
                "level": int(current["level"]) + 1, "sortOrder": 50, "icon": "", "status": 1,
            })
            cats = admin.json("GET", "/api/admin/business/categories")
            if isinstance(cats, dict):
                cats = cats.get("records") or cats.get("items") or []
            by_parent = {}
            for row in cats:
                by_parent.setdefault(row.get("parentId"), []).append(row)
            existing = next(row for row in by_parent.get(current["id"], []) if row.get("name") == child_name)
        current = existing
    return int(current["id"])


def _brand_key(name: str) -> str:
    return re.sub(r"\s+", "", (name or "").strip()).casefold()


def _find_brand(rows: list, name: str) -> dict | None:
    key = _brand_key(name)
    if not key:
        return None
    for row in rows:
        if _brand_key(str(row.get("name") or "")) == key:
            return row
    return None


def ensure_brand(admin: Admin, name: str) -> int:
    name = (name or "").strip() or "未品牌"
    rows = as_rows(admin.json("GET", "/api/admin/content/brands/list"))
    matched = _find_brand(rows, name)
    if matched:
        return int(matched["id"])
    created = admin.json("POST", "/api/admin/content/brands/list", {
        "name": name, "logo": "", "description": f"由采集自动创建：{name}", "sortOrder": 50, "status": 1,
    })
    return int(created["id"])


def already_imported(admin: Admin, source_id: str, platform: str = "jd") -> dict | None:
    code = sku_code(platform, source_id)
    data = admin.json("GET", f"/api/admin/business/products?keyword={urllib.parse.quote(code)}&page=1&pageSize=20")
    items = data if isinstance(data, list) else data.get("records") or data.get("items") or data.get("content") or []
    for row in items:
        current = str(row.get("skuCode") or "")
        if current == code or source_id in current:
            return row
    return None


def parse_warranty_months(text: str) -> int | None:
    blob = text or ""
    month = re.search(r"(\d+(?:\.\d+)?)\s*个?月", blob)
    if month:
        return int(float(month.group(1)))
    year = re.search(r"([一二三四五六七八九十两\d]+)\s*年", blob)
    if not year:
        return None
    token = year.group(1)
    cn = {"一": 1, "二": 2, "两": 2, "三": 3, "四": 4, "五": 5, "六": 6, "七": 7, "八": 8, "九": 9, "十": 10}
    years = cn.get(token)
    if years is None:
        try:
            years = float(token)
        except ValueError:
            return None
    return int(years * 12)


def lookup_param(attr: dict, params: dict) -> str:
    name = str(attr.get("name") or "")
    code = str(attr.get("code") or "")
    keys = [name, code, *ATTR_ALIASES.get(name, []), *ATTR_ALIASES.get(code, [])]
    seen: set[str] = set()
    for key in keys:
        if not key or key in seen:
            continue
        seen.add(key)
        value = params.get(key)
        if value is not None and str(value).strip():
            return str(value).strip()
    return ""


def match_option_ids(attr: dict, raw: str) -> list[int]:
    options = [opt for opt in (attr.get("options") or []) if int(opt.get("status") or 1) == 1]
    if not options or not raw:
        return []
    hits: list[int] = []
    for opt in options:
        label = str(opt.get("optionLabel") or "")
        if not label:
            continue
        if label in raw or raw in label:
            hits.append(int(opt["id"]))
    return hits


def list_attributes(admin: Admin) -> list:
    data = admin.json("GET", "/api/admin/business/attributes")
    return as_rows(data)


def attr_to_payload(attr: dict, category_ids: list[int]) -> dict:
    return {
        "code": str(attr.get("code") or ""),
        "name": str(attr.get("name") or ""),
        "groupName": str(attr.get("groupName") or "规格参数"),
        "attributeType": str(attr.get("attributeType") or "BASIC"),
        "inputType": str(attr.get("inputType") or "TEXT"),
        "unit": attr.get("unit") or "",
        "requiredFlag": int(attr.get("requiredFlag") or 0),
        "filterable": int(attr.get("filterable") or 0),
        "searchable": int(attr.get("searchable") or 0),
        "visibleFlag": int(attr.get("visibleFlag") if attr.get("visibleFlag") is not None else 1),
        "allowCustom": int(attr.get("allowCustom") or 0),
        "globalFlag": int(attr.get("globalFlag") or 0),
        "sortOrder": int(attr.get("sortOrder") or 50),
        "status": int(attr.get("status") if attr.get("status") is not None else 1),
        "categoryIds": category_ids,
    }


def unique_attr_code(name: str) -> str:
    digest = hashlib.md5(name.encode("utf-8")).hexdigest()[:8].upper()
    return f"JD_{digest}"


def find_attribute(rows: list, name: str, code: str | None = None) -> dict | None:
    wanted_names = {name, *(ATTR_ALIASES.get(name) or [])}
    wanted_codes = {str(code or "").upper()} | {alias.upper() for alias in ATTR_ALIASES.get(code or "", []) if alias.isascii()}
    wanted_codes.discard("")
    for row in rows:
        row_name = str(row.get("name") or "")
        row_code = str(row.get("code") or "").upper()
        if row_name in wanted_names or name in (ATTR_ALIASES.get(row_name) or []) or name in (ATTR_ALIASES.get(row_code) or []):
            return row
        if wanted_codes and row_code in wanted_codes:
            return row
    return None


def bind_attribute(admin: Admin, attr: dict, category_id: int) -> None:
    if int(attr.get("globalFlag") or 0) == 1:
        return
    ids = [int(item) for item in (attr.get("categoryIds") or [])]
    cid = int(category_id)
    if cid in ids:
        return
    ids.append(cid)
    admin.json("PUT", f"/api/admin/business/attributes/{int(attr['id'])}", attr_to_payload(attr, ids))


def create_attribute(admin: Admin, name: str, category_id: int, spec: dict | None = None) -> None:
    meta = spec or {}
    payload = {
        "code": meta.get("code") or unique_attr_code(name),
        "name": name,
        "groupName": meta.get("groupName") or "规格参数",
        "attributeType": meta.get("attributeType") or "BASIC",
        "inputType": meta.get("inputType") or "TEXT",
        "unit": meta.get("unit") or "",
        "requiredFlag": int(meta.get("requiredFlag") or 0),
        "filterable": 0,
        "searchable": 1 if name == "型号" else 0,
        "visibleFlag": 1,
        "allowCustom": 1,
        "globalFlag": 0,
        "sortOrder": 50,
        "status": 1,
        "categoryIds": [int(category_id)],
    }
    try:
        admin.json("POST", "/api/admin/business/attributes", payload)
    except CollectError:
        existing = find_attribute(list_attributes(admin), name, payload["code"])
        if not existing:
            raise
        bind_attribute(admin, existing, category_id)


def canonical_param_key(key: str) -> str:
    if key in KNOWN_ATTR:
        return key
    for name, aliases in ATTR_ALIASES.items():
        if key == name or key in aliases:
            if name in KNOWN_ATTR:
                return name
            if name.isascii():
                matched = next((item for item, spec in KNOWN_ATTR.items() if spec["code"] == name), "")
                if matched:
                    return matched
            return name
    return key


def ensure_category_attributes(admin: Admin, category_id: int, params: dict) -> None:
    template = as_rows(admin.json("GET", f"/api/admin/business/attributes/category/{category_id}"))
    catalog = list_attributes(admin)
    pending: list[tuple[str, dict | None]] = []
    seen: set[str] = set()
    for key, value in (params or {}).items():
        if not key or key in SKIP_PARAM_KEYS or not str(value or "").strip():
            continue
        canonical = canonical_param_key(key)
        if canonical in seen:
            continue
        seen.add(canonical)
        if any(lookup_param(attr, {key: value, canonical: value}) for attr in template):
            continue
        pending.append((canonical, KNOWN_ATTR.get(canonical)))
    for name, spec in pending:
        existing = find_attribute(catalog, name, (spec or {}).get("code"))
        if existing:
            bind_attribute(admin, existing, category_id)
            catalog = list_attributes(admin)
            continue
        create_attribute(admin, name, category_id, spec)
        catalog = list_attributes(admin)


def map_attribute_values(admin: Admin, category_id: int, params: dict, spec: str, extra_text: str) -> dict:
    ensure_category_attributes(admin, category_id, params)
    template = as_rows(admin.json("GET", f"/api/admin/business/attributes/category/{category_id}"))
    values: dict[str, object] = {}
    blob = " ".join(part for part in [spec, extra_text, *[f"{k}{v}" for k, v in params.items()]] if part)
    for attr in template:
        attr_id = str(attr.get("id"))
        input_type = str(attr.get("inputType") or "TEXT").upper()
        name = str(attr.get("name") or "")
        code = str(attr.get("code") or "")
        raw = lookup_param(attr, params)
        if not raw and (name == "颜色" or code == "COLOR"):
            raw = spec
        if input_type in {"SELECT", "RADIO", "CHECKBOX"}:
            options = [opt for opt in (attr.get("options") or []) if int(opt.get("status") or 1) == 1]
            if not options:
                continue
            hits = match_option_ids(attr, raw or blob)
            if not hits:
                continue
            values[attr_id] = hits if input_type == "CHECKBOX" else hits[0]
            continue
        if (code == "WARRANTY" or name == "质保期") and not raw:
            months = parse_warranty_months(blob)
            if months:
                values[attr_id] = months
            continue
        if not raw:
            continue
        if input_type == "NUMBER":
            if code == "WARRANTY" or name == "质保期":
                months = parse_warranty_months(raw) or parse_warranty_months(blob)
                if months:
                    values[attr_id] = months
                continue
            number = re.search(r"(\d+(?:\.\d+)?)", raw)
            if number:
                num = float(number.group(1))
                values[attr_id] = int(num) if num.is_integer() else num
            continue
        values[attr_id] = raw
    return values


def extra_text_from_product(product: dict) -> str:
    services = product.get("services") or []
    if isinstance(services, str):
        services = [services]
    return " ".join([
        str(product.get("spec") or ""),
        str(product.get("title") or ""),
        " ".join(str(item) for item in services),
    ])


def cleaned_skus(existing: dict) -> list[dict]:
    skus = parse_jsonish(existing.get("skus"), [])
    cleaned = []
    for sku in skus:
        cleaned.append({
            "id": sku.get("id"),
            "skuCode": sku.get("skuCode"),
            "skuTitle": sku.get("skuTitle") or sku.get("title") or "",
            "specValues": parse_jsonish(sku.get("specValues"), {}),
            "skuImage": sku.get("skuImage") or "",
            "skuGallery": sku.get("skuGallery") or "",
            "marketPrice": sku.get("marketPrice"),
            "memberPrice": sku.get("memberPrice"),
            "stock": int(sku.get("stock") or 0),
            "status": int(sku.get("status") if sku.get("status") is not None else 1),
        })
    return cleaned


def put_existing(admin: Admin, existing: dict, overlays: dict) -> None:
    product_id = int(existing["id"])
    main_image = overlays["mainImage"] if overlays.get("mainImage") is not None else existing.get("mainImage")
    gallery = overlays["gallery"] if overlays.get("gallery") is not None else (existing.get("gallery") or "")
    body = {
        "title": existing.get("title"),
        "model": overlays.get("model") or existing.get("model") or "",
        "categoryId": int(existing["categoryId"]),
        "brandId": int(existing["brandId"]),
        "selfOperated": int(existing.get("selfOperated") or 1),
        "mainImage": main_image,
        "gallery": gallery,
        "summary": existing.get("summary") or existing.get("title"),
        "detailHtml": overlays["detailHtml"] if overlays.get("detailHtml") is not None else existing.get("detailHtml"),
        "deliveryDescription": overlays["deliveryDescription"],
        "afterSalesHtml": overlays["afterSalesHtml"],
        "spec": existing.get("spec") or "",
        "marketPrice": existing.get("marketPrice"),
        "memberPrice": existing.get("memberPrice"),
        "stock": int(existing.get("stock") or 0),
        "status": int(existing.get("status") if existing.get("status") is not None else 1),
        "attributeValues": overlays["attributeValues"],
        "serviceOptionIds": overlays["serviceOptionIds"],
        "badgeType": existing.get("badgeType") or "NONE",
    }
    skus = cleaned_skus(existing)
    if skus and overlays.get("mainImage") is not None:
        for sku in skus:
            sku["skuImage"] = main_image or sku.get("skuImage") or ""
            if overlays.get("gallery") is not None:
                sku["skuGallery"] = gallery
    if skus:
        body["skus"] = skus
    admin.json("PUT", f"/api/admin/business/products/{product_id}", body)


def upload_detail_images(admin: Admin, paths: list[str]) -> list[str]:
    from PIL import Image
    uploaded: list[str] = []
    seen: set[str] = set()
    for raw_path in paths[:40]:
        url = graphic_url(str(raw_path))
        if not url or url in seen:
            continue
        seen.add(url)
        try:
            raw = http_get(url)
            image = Image.open(io.BytesIO(raw))
            width, height = image.size
            if min(width, height) < 200 and max(width, height) < 400:
                continue
            dest = admin.upload_jpeg(to_rich_jpeg(raw), "rich")
            uploaded.append(dest)
        except Exception:
            continue
    return uploaded


def import_scraped(product: dict, authorization: str) -> dict:
    base = os.environ.get("SUPPLY_API_BASE", "http://api:8080")
    admin = Admin(base, authorization)
    admin.me()
    sku = str(product["sku"])
    platform = str(product.get("platform") or "jd")
    code = sku_code(platform, sku)
    title = (product.get("title") or "").strip()
    member = product.get("memberPrice")
    market = product.get("marketPrice") or member
    images = product.get("images") or []
    crumb = product.get("crumb") or []
    params = product.get("params") or {}
    brand_name = str(params.get("品牌") or (crumb[-1] if crumb else "") or "未品牌").strip() or "未品牌"
    spec = product.get("spec") or params.get("型号") or params.get("货号") or "默认"
    model = params.get("型号") or params.get("货号") or sku
    delivery, after_sales = default_templates(admin)
    service_ids = all_service_ids(admin)
    exists = already_imported(admin, sku, platform)
    if exists:
        category_id = int(exists["categoryId"])
        attribute_values = map_attribute_values(admin, category_id, params, spec, extra_text_from_product(product))
        detail_urls = upload_detail_images(admin, product.get("detailImages") or [])
        html = detail_html(params, title, detail_urls)
        overlays = {
            "model": model,
            "attributeValues": attribute_values,
            "serviceOptionIds": service_ids,
            "deliveryDescription": delivery,
            "afterSalesHtml": after_sales,
            "detailHtml": html,
        }
        # 重采时若拿到更多轮播图，刷新主图/配图（旧逻辑永远沿用库内旧图）
        existing_gallery = [line for line in str(exists.get("gallery") or "").splitlines() if line.strip()]
        existing_total = (1 if exists.get("mainImage") else 0) + len(existing_gallery)
        if images and len(images) > existing_total:
            uploaded = []
            for index, url in enumerate(images[:7]):
                jpeg = square_jpeg(http_get(jfs_upgrade(url) if platform == "jd" else url))
                kind = "main" if index == 0 else "gallery"
                uploaded.append(admin.upload_jpeg(jpeg, kind))
            if uploaded:
                overlays["mainImage"] = uploaded[0]
                overlays["gallery"] = "\n".join(uploaded[1:])
        put_existing(admin, exists, overlays)
        return {
            "ok": True,
            "updated": True,
            "platform": platform,
            "sourceId": sku,
            "id": exists.get("id"),
            "skuCode": exists.get("skuCode") or code,
            "title": exists.get("title") or title,
            "model": model,
            "memberPrice": exists.get("memberPrice") or member,
            "detailImages": len(detail_urls),
            "galleryImages": len(images),
        }
    category_id = ensure_category(admin, crumb[:-1] if crumb and crumb[-1] == brand_name else crumb)
    brand_id = ensure_brand(admin, brand_name)
    attribute_values = map_attribute_values(admin, category_id, params, spec, extra_text_from_product(product))
    uploaded = []
    for index, url in enumerate(images[:7]):
        jpeg = square_jpeg(http_get(jfs_upgrade(url) if platform == "jd" else url))
        kind = "main" if index == 0 else "gallery"
        uploaded.append(admin.upload_jpeg(jpeg, kind))
    main_image, gallery = uploaded[0], "\n".join(uploaded[1:])
    try:
        stock = int(admin.json("GET", "/api/admin/business/product-default-stock").get("stock") or 10000)
    except Exception:
        stock = 10000
    detail_urls = upload_detail_images(admin, product.get("detailImages") or [])
    payload = {
        "title": title,
        "model": model,
        "categoryId": category_id,
        "brandId": brand_id,
        "selfOperated": 1,
        "mainImage": main_image,
        "gallery": gallery,
        "summary": title,
        "detailHtml": detail_html(params, title, detail_urls),
        "deliveryDescription": delivery,
        "afterSalesHtml": after_sales,
        "spec": spec,
        "marketPrice": market,
        "memberPrice": member,
        "stock": stock,
        "status": 1,
        "attributeValues": attribute_values,
        "serviceOptionIds": service_ids,
        "skus": [{
            "skuCode": code,
            "skuTitle": title,
            "specValues": {"规格": spec},
            "skuImage": main_image,
            "skuGallery": gallery,
            "marketPrice": market,
            "memberPrice": member,
            "stock": stock,
            "status": 1,
        }],
    }
    created = admin.json("POST", "/api/admin/business/products", payload)
    return {
        "ok": True,
        "updated": False,
        "platform": platform,
        "sourceId": sku,
        "id": created.get("id"),
        "skuCode": code,
        "title": title,
        "model": model,
        "memberPrice": member,
        "detailImages": len(detail_urls),
    }
