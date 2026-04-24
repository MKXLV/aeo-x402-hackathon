from datetime import datetime, timezone
from decimal import Decimal
from uuid import uuid4

import pytest

from core.schemas import (
    Platform,
    PostKind,
    Post,
    PostSpec,
    PostState,
    PostTarget,
    OrderState,
    ProviderKind,
)
from core.state import InvalidTransition, derive_order_state, transition_post


def _post(state: PostState) -> Post:
    return Post(
        id=uuid4(),
        order_id=uuid4(),
        spec=PostSpec(
            platform=Platform.REDDIT,
            kind=PostKind.UPVOTE,
            body="x",
            target=PostTarget(subreddit="test"),
        ),
        provider=ProviderKind.SMM,
        state=state,
        unit_price_usdc=Decimal("0.25"),
        updated_at=datetime.now(timezone.utc),
    )


def test_legal_transitions():
    p = _post(PostState.QUEUED)
    assert transition_post(p, PostState.SUBMITTED).state == PostState.SUBMITTED
    assert transition_post(_post(PostState.SUBMITTED), PostState.POSTED).state == PostState.POSTED
    assert transition_post(_post(PostState.FAILED), PostState.REFUNDED).state == PostState.REFUNDED


def test_illegal_transitions():
    with pytest.raises(InvalidTransition):
        transition_post(_post(PostState.POSTED), PostState.FAILED)
    with pytest.raises(InvalidTransition):
        transition_post(_post(PostState.QUEUED), PostState.POSTED)
    with pytest.raises(InvalidTransition):
        transition_post(_post(PostState.REFUNDED), PostState.POSTED)


def test_order_state_rollup():
    assert derive_order_state([]) == OrderState.PAID
    assert derive_order_state([_post(PostState.QUEUED)]) == OrderState.DISPATCHED
    assert derive_order_state([_post(PostState.POSTED), _post(PostState.POSTED)]) == OrderState.COMPLETED
    assert derive_order_state([_post(PostState.FAILED), _post(PostState.REFUNDED)]) == OrderState.FAILED
    assert derive_order_state([_post(PostState.POSTED), _post(PostState.FAILED)]) == OrderState.PARTIAL
