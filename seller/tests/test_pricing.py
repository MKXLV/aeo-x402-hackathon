from decimal import Decimal

from core.pricing import DEFAULT_PRICES_USDC, post_price, quote, resolve_provider
from core.schemas import OrderRequest, Platform, PostKind, PostSpec, PostTarget, ProviderKind


def _spec(platform: Platform, preference: ProviderKind | None = None, qty: int = 1) -> PostSpec:
    return PostSpec(
        platform=platform,
        kind=PostKind.UPVOTE if preference == ProviderKind.SMM else PostKind.POST,
        body="hello world",
        target=PostTarget(subreddit="test", handle="test"),
        provider_preference=preference,
        quantity=qty,
    )


def test_default_provider_is_cheapest():
    # SMM is cheaper than UGC in defaults; should be auto-picked when no preference
    assert resolve_provider(_spec(Platform.REDDIT)) == ProviderKind.SMM
    assert resolve_provider(_spec(Platform.TWITTER)) == ProviderKind.SMM


def test_caller_preference_honored():
    assert resolve_provider(_spec(Platform.REDDIT, ProviderKind.UGC)) == ProviderKind.UGC


def test_quote_sums_line_items():
    req = OrderRequest(posts=[
        _spec(Platform.REDDIT, ProviderKind.SMM, qty=10),
        _spec(Platform.TWITTER, ProviderKind.UGC, qty=1),
    ])
    expected = (
        DEFAULT_PRICES_USDC[(Platform.REDDIT, ProviderKind.SMM)] * 10
        + DEFAULT_PRICES_USDC[(Platform.TWITTER, ProviderKind.UGC)] * 1
    )
    assert quote(req) == expected.quantize(Decimal("0.000001"))


def test_post_price_returns_provider_used():
    price, provider = post_price(_spec(Platform.REDDIT, ProviderKind.UGC, qty=3))
    assert provider == ProviderKind.UGC
    assert price == DEFAULT_PRICES_USDC[(Platform.REDDIT, ProviderKind.UGC)] * 3
