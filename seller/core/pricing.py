from __future__ import annotations

import os
from decimal import Decimal

from core.schemas import OrderRequest, Platform, PostSpec, ProviderKind

DEFAULT_PRICES_USDC: dict[tuple[Platform, ProviderKind], Decimal] = {
    (Platform.REDDIT, ProviderKind.SMM): Decimal("0.25"),
    (Platform.REDDIT, ProviderKind.UGC): Decimal("12.00"),
    (Platform.TWITTER, ProviderKind.SMM): Decimal("0.15"),
    (Platform.TWITTER, ProviderKind.UGC): Decimal("9.00"),
}


def _env_price(platform: Platform, provider: ProviderKind) -> Decimal | None:
    key = f"PRICE_{platform.value.upper()}_{provider.value.upper()}"
    raw = os.environ.get(key)
    if raw is None:
        return None
    return Decimal(raw)


def unit_price(platform: Platform, provider: ProviderKind) -> Decimal:
    return _env_price(platform, provider) or DEFAULT_PRICES_USDC[(platform, provider)]


def resolve_provider(spec: PostSpec) -> ProviderKind:
    """If the caller expressed a preference, honor it. Otherwise pick SMM (cheapest)."""
    if spec.provider_preference is not None:
        return spec.provider_preference
    smm = unit_price(spec.platform, ProviderKind.SMM)
    ugc = unit_price(spec.platform, ProviderKind.UGC)
    return ProviderKind.SMM if smm <= ugc else ProviderKind.UGC


def post_price(spec: PostSpec) -> tuple[Decimal, ProviderKind]:
    provider = resolve_provider(spec)
    return unit_price(spec.platform, provider) * spec.quantity, provider


def quote(order: OrderRequest) -> Decimal:
    total = Decimal("0")
    for spec in order.posts:
        price, _ = post_price(spec)
        total += price
    return total.quantize(Decimal("0.000001"))
