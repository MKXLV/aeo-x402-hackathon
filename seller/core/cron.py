"""Cron tick logic — poll non-terminal posts, transition, refund, fire callbacks.

Lives outside `api/` because Vercel treats every file in `api/` as a separate
function, and we want a single-function deploy.
"""
from __future__ import annotations

import datetime as dt
import logging
from uuid import UUID

import httpx

from core.schemas import TERMINAL_ORDER_STATES, Post, PostState
from core.state import derive_order_state, transition_post
from core.storage_protocol import OrderStore
from payments.refund import compute_refund, issue_refund
from providers.base import PostingProvider
from providers.registry import build_providers

log = logging.getLogger(__name__)


async def run_tick(store: OrderStore, providers: dict | None = None) -> dict:
    providers = providers or build_providers()
    pending = await store.list_non_terminal_posts(limit=500)

    advanced = 0
    failed = 0
    terminal_orders: set[UUID] = set()

    for post in pending:
        provider = providers.get(post.provider)
        if provider is None or post.provider_order_id is None or post.upstream is None:
            continue
        updated = await _advance(post, provider)
        if updated.state != post.state:
            updated = updated.model_copy(update={"updated_at": dt.datetime.now(dt.timezone.utc)})
            await store.update_post(updated)
            advanced += 1
            if updated.state == PostState.FAILED:
                failed += 1
                await _refund_and_mark(store, updated)
            terminal_orders.add(updated.order_id)

    callbacks = await _fire_callbacks(store, terminal_orders)
    return {"advanced": advanced, "failed": failed, "callbacks": callbacks}


async def _advance(post: Post, provider: PostingProvider) -> Post:
    try:
        result = await provider.status(post.provider_order_id, post.upstream)
    except Exception as exc:
        log.warning("status poll failed for %s: %s", post.id, exc)
        return post
    if result.state == post.state:
        return post
    try:
        return transition_post(post, result.state).model_copy(update={"error": result.error})
    except ValueError:
        return post


async def _refund_and_mark(store: OrderStore, post: Post) -> None:
    order = await store.get_order(post.order_id)
    if order is None:
        return
    intent = compute_refund(post, order.payer_address)
    if intent is None:
        return
    try:
        tx = await issue_refund(intent)
        note = f"refund tx={tx}" if tx else "refund logged (dry run)"
    except NotImplementedError:
        note = "refund not implemented"
    refunded = post.model_copy(update={"state": PostState.REFUNDED, "error": f"{post.error or ''} | {note}"})
    await store.update_post(refunded)


async def _fire_callbacks(store: OrderStore, order_ids: set[UUID]) -> int:
    fired = 0
    async with httpx.AsyncClient(timeout=10.0) as client:
        for oid in order_ids:
            order = await store.get_order(oid)
            if order is None or order.callback_url is None:
                continue
            state = derive_order_state(order.posts)
            if state not in TERMINAL_ORDER_STATES:
                continue
            try:
                await client.post(order.callback_url, json=order.model_dump(mode="json"))
                fired += 1
            except httpx.HTTPError as exc:
                log.warning("callback %s failed: %s", order.callback_url, exc)
    return fired
