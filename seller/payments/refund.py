"""Partial-refund logic.

When some posts in an order transition to FAILED, we owe the payer back the
per-post unit price. This module computes and issues the refund in USDC.

v1 implementation is deliberately minimal: it logs the intended refund and
records it on the post. Wiring to an actual on-chain transfer (via a funded
hot wallet or a facilitator-mediated refund call) is the next step.
"""
from __future__ import annotations

import logging
import os
from dataclasses import dataclass
from decimal import Decimal

from core.schemas import Post, PostState

log = logging.getLogger(__name__)


@dataclass(frozen=True)
class RefundIntent:
    payer_address: str
    amount_usdc: Decimal
    reason: str


def compute_refund(post: Post, payer_address: str) -> RefundIntent | None:
    if post.state != PostState.FAILED:
        return None
    return RefundIntent(
        payer_address=payer_address,
        amount_usdc=post.unit_price_usdc * post.spec.quantity,
        reason=post.error or "provider reported failure",
    )


async def issue_refund(intent: RefundIntent) -> str | None:
    """Issue a USDC refund. Returns tx hash on success, None on dry-run.

    Dry-run path (no wallet configured) logs and returns None — the caller still
    marks the post REFUNDED so state stays consistent; actual settlement happens
    when WALLET_PRIVATE_KEY / WALLET_RPC_URL are provisioned.
    """
    pk = os.environ.get("WALLET_PRIVATE_KEY")
    rpc = os.environ.get("WALLET_RPC_URL")
    if not (pk and rpc):
        log.warning(
            "Refund %s USDC to %s dry-run: %s (wallet not configured)",
            intent.amount_usdc, intent.payer_address, intent.reason,
        )
        return None

    # TODO: construct and broadcast a USDC ERC-20 transfer on Base.
    # Keep this thin on purpose — integrating a wallet client is scoped to the
    # refund task in v2 so we don't ship a half-working transfer here.
    log.error("issue_refund called with wallet configured, but transfer not implemented")
    raise NotImplementedError("on-chain refund not yet implemented")
