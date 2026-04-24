"""End-to-end test of `purchase_ugc` without FastAPI.

This is the same code path the larger agent skill will hit when it imports
`core.service.purchase_ugc` directly. Passing here proves the reusability
contract called out in the plan.
"""
from decimal import Decimal

import pytest

from core.schemas import (
    OrderRequest,
    OrderState,
    PaymentContext,
    Platform,
    PostKind,
    PostSpec,
    PostState,
    PostTarget,
    ProviderKind,
)
from core.service import UnderpaidError, purchase_ugc
from providers.fake import FakeProvider
from storage.memory import InMemoryStore


def _req() -> OrderRequest:
    return OrderRequest(
        posts=[
            PostSpec(
                platform=Platform.REDDIT,
                kind=PostKind.UPVOTE,
                body="please upvote",
                topics=["aeo"],
                target=PostTarget(subreddit="test"),
                provider_preference=ProviderKind.SMM,
                quantity=10,
            ),
            PostSpec(
                platform=Platform.TWITTER,
                kind=PostKind.POST,
                body="finished tweet text",
                target=PostTarget(handle="claude"),
                provider_preference=ProviderKind.UGC,
            ),
        ]
    )


def _paid(amount: Decimal) -> PaymentContext:
    return PaymentContext(
        payer_address="0xpayer",
        amount_usdc=amount,
        network="base",
        tx_hash="0xtx",
    )


async def test_happy_path_dispatches_and_persists():
    smm = FakeProvider(kind=ProviderKind.SMM, name="fake-smm")
    ugc = FakeProvider(kind=ProviderKind.UGC, name="fake-ugc")
    store = InMemoryStore()

    order = await purchase_ugc(_req(), _paid(Decimal("100")), {ProviderKind.SMM: smm, ProviderKind.UGC: ugc}, store)

    assert order.state == OrderState.DISPATCHED
    assert len(order.posts) == 2
    assert all(p.state == PostState.SUBMITTED for p in order.posts)
    assert all(p.provider_order_id and p.upstream for p in order.posts)

    # Persisted
    persisted = await store.get_order(order.id)
    assert persisted is not None
    assert persisted.total_usdc == order.total_usdc


async def test_underpaid_rejects_before_dispatch():
    smm = FakeProvider(kind=ProviderKind.SMM, name="fake-smm")
    ugc = FakeProvider(kind=ProviderKind.UGC, name="fake-ugc")
    store = InMemoryStore()

    with pytest.raises(UnderpaidError):
        await purchase_ugc(
            _req(),
            _paid(Decimal("0.01")),
            {ProviderKind.SMM: smm, ProviderKind.UGC: ugc},
            store,
        )
    assert store.orders == {}


async def test_partial_failure_reflected_in_posts():
    good = FakeProvider(kind=ProviderKind.SMM, name="fake-smm")

    class FailingUgc(FakeProvider):
        async def submit(self, spec):
            from providers.base import ProviderError
            raise ProviderError("creator marketplace unreachable")

    bad = FailingUgc(kind=ProviderKind.UGC, name="fake-ugc-broken")
    store = InMemoryStore()

    order = await purchase_ugc(
        _req(),
        _paid(Decimal("100")),
        {ProviderKind.SMM: good, ProviderKind.UGC: bad},
        store,
    )

    states = {p.provider: p.state for p in order.posts}
    assert states[ProviderKind.SMM] == PostState.SUBMITTED
    assert states[ProviderKind.UGC] == PostState.FAILED
    assert order.state == OrderState.DISPATCHED  # UGC is failed, SMM still in flight

    # Confirm persistence reflects the same
    persisted = await store.get_order(order.id)
    assert persisted is not None
    assert {p.state for p in persisted.posts} == {PostState.SUBMITTED, PostState.FAILED}
