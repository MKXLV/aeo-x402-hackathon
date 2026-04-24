from __future__ import annotations

import os
from uuid import UUID

from fastapi import FastAPI, HTTPException, Request

from core.cron import run_tick
from core.pricing import quote
from core.schemas import OrderRequest
from core.service import UnderpaidError, UnsupportedError, purchase_ugc
from core.state import recompute_order
from core.storage_protocol import OrderStore
from payments.x402_config import install_x402, payment_from_request
from providers.registry import build_providers
from storage.memory import InMemoryStore

app = FastAPI(title="aeo_engine UGC purchase", version="0.1.0")

PAID_ROUTES = ["POST /v1/orders"]
install_x402(app, PAID_ROUTES)

_in_memory_store = InMemoryStore()


def _store() -> OrderStore:
    if os.environ.get("USE_FAKE_PROVIDERS") == "1" and not os.environ.get("DATABASE_URL"):
        return _in_memory_store
    from storage.db import PostgresStore
    return PostgresStore()


@app.get("/healthz")
async def healthz() -> dict:
    return {"ok": True}


@app.get("/")
async def service_descriptor() -> dict:
    """Discovery payload for agentic.market crawlers."""
    return {
        "name": "aeo_engine",
        "description": "Buy UGC — Reddit and Twitter posts delivered via human creators or SMM panels. Pay per order in USDC via x402.",
        "paid_endpoints": [{"method": "POST", "path": "/v1/orders", "network": "base", "asset": "USDC"}],
        "schema": "https://github.com/anthropic/aeo_engine/blob/main/core/schemas.py",
    }


@app.post("/v1/orders/quote")
async def quote_order(request: OrderRequest) -> dict:
    """Free endpoint — callers use this to preview price before paying."""
    total = quote(request)
    return {"total_usdc": str(total), "network": "base", "asset": "USDC"}


@app.post("/v1/orders")
async def create_order(request: OrderRequest, http: Request) -> dict:
    payment = payment_from_request(http)
    providers = build_providers()
    try:
        order = await purchase_ugc(request, payment, providers, _store())
    except UnderpaidError as exc:
        raise HTTPException(status_code=402, detail=str(exc))
    except UnsupportedError as exc:
        raise HTTPException(status_code=422, detail=str(exc))
    return order.model_dump(mode="json")


@app.get("/v1/orders/{order_id}")
async def get_order(order_id: UUID) -> dict:
    order = await _store().get_order(order_id)
    if order is None:
        raise HTTPException(status_code=404, detail="order not found")
    return recompute_order(order).model_dump(mode="json")


@app.get("/api/tick")
async def tick_local() -> dict:
    """Expose the cron handler locally too, so `curl /api/tick` advances state."""
    return await run_tick(_store())
