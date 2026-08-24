from __future__ import annotations

import asyncio
from contextlib import asynccontextmanager

from fastapi import FastAPI, Header, HTTPException
from pydantic import BaseModel, Field

from huiecai import scrape_huiecai
from importer import import_scraped
from jd import BrowserPool, scrape_jd
from platforms import CollectError, detect_platform
from qilu import scrape_qilu
from taobao import scrape_taobao

pool = BrowserPool()
busy = asyncio.Lock()


@asynccontextmanager
async def lifespan(app: FastAPI):
    await pool.start()
    yield
    await pool.stop()


app = FastAPI(title="supply-chain collector", lifespan=lifespan)


class CollectRequest(BaseModel):
    url: str = Field(min_length=6)
    platform: str | None = None
    memberPrice: float | None = Field(default=None, gt=0)


@app.get("/health")
def health():
    return {"status": "UP"}


@app.post("/collect")
async def collect(body: CollectRequest, authorization: str | None = Header(default=None)):
    if busy.locked():
        raise HTTPException(status_code=429, detail="采集任务进行中，请稍后再试")
    if not authorization:
        raise HTTPException(status_code=401, detail="缺少后台登录凭证")
    async with busy:
        try:
            platform = detect_platform(body.url, body.platform)
            if platform == "taobao":
                product = await scrape_taobao(body.url)
            elif platform == "huiecai":
                product = await scrape_huiecai(pool, body.url)
            elif platform == "qilu":
                product = await scrape_qilu(pool, body.url)
            else:
                product = await scrape_jd(pool, body.url)
            if body.memberPrice:
                product["memberPrice"] = body.memberPrice
                product["marketPrice"] = product.get("marketPrice") or body.memberPrice
            if product.get("memberPrice") is None:
                hint = {
                    "jd": "京东隐藏了售价，请在采集窗口填写售价后重试",
                    "huiecai": "徽e采未解析到售价，请在采集窗口填写售价后重试",
                    "qilu": "齐鲁云采未解析到售价，请在采集窗口填写售价后重试",
                    "taobao": "淘宝/天猫未解析到售价，请在采集窗口填写售价后重试",
                }.get(platform, "未解析到售价，请在采集窗口填写售价后重试")
                raise CollectError("price_hidden", hint, status=422)
            return await asyncio.to_thread(import_scraped, product, authorization)
        except CollectError as exc:
            raise HTTPException(status_code=exc.status, detail=exc.message) from exc
