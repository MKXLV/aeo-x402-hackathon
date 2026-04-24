"""Reusable entry point.

This module is the composition seam: the FastAPI handler and the larger agent
skill both call `purchase_ugc(...)` with injected providers and storage. `core/`
imports nothing from `api/`, `providers/*` (concrete), or `payments/*` — only
protocols.
"""
from __future__ import annotations

import uuid
from datetime import datetime, timezone

from core.pricing import post_price, quote
from core.schemas import (
    Order,
    OrderRequest,
    OrderState,
    PaymentContext,
    Post,
    PostState,
    ProviderKind,
)
from core.state import derive_order_state
from core.storage_protocol import OrderStore
from providers.base import PostingProvider, ProviderError


class UnderpaidError(ValueError):
    pass


class UnsupportedError(ValueError):
    pass


async def purchase_ugc(
    request: OrderRequest,
    payment: PaymentContext,
    providers: dict[ProviderKind, PostingProvider],
    store: OrderStore,
) -> Order:
    """Accept a paid order, persist it, dispatch each post, return the Order."""
    expected = quote(request)
    if payment.amount_usdc < expected:
        raise UnderpaidError(f"paid {payment.amount_usdc} USDC, need {expected}")

    order_id = uuid.uuid4()
    now = datetime.now(timezone.utc)
    posts: list[Post] = []

    for spec in request.posts:
        unit, provider_kind = post_price(spec)
        if provider_kind not in providers:
            raise UnsupportedError(f"no provider registered for {provider_kind}")
        provider = providers[provider_kind]
        if spec.platform not in provider.supported_platforms:
            raise UnsupportedError(
                f"{provider_kind} provider does not support {spec.platform}"
            )

        post = Post(
            id=uuid.uuid4(),
            order_id=order_id,
            spec=spec,
            provider=provider_kind,
            upstream=None,
            provider_order_id=None,
            state=PostState.QUEUED,
            unit_price_usdc=unit,
            error=None,
            updated_at=now,
        )
        posts.append(post)

    order = Order(
        id=order_id,
        state=OrderState.PAID,
        payer_address=payment.payer_address,
        total_usdc=expected,
        callback_url=request.callback_url,
        metadata=request.metadata,
        posts=posts,
        created_at=now,
    )
    await store.save_order(order)

    dispatched: list[Post] = []
    for post in posts:
        provider = providers[post.provider]
        try:
            result = await provider.submit(post.spec)
            updated = post.model_copy(
                update={
                    "state": PostState.SUBMITTED,
                    "upstream": result.upstream,
                    "provider_order_id": result.provider_order_id,
                    "updated_at": datetime.now(timezone.utc),
                }
            )
        except ProviderError as exc:
            updated = post.model_copy(
                update={
                    "state": PostState.FAILED,
                    "error": str(exc),
                    "updated_at": datetime.now(timezone.utc),
                }
            )
        await store.update_post(updated)
        dispatched.append(updated)

    final = order.model_copy(
        update={"posts": dispatched, "state": derive_order_state(dispatched)}
    )
    return final
