from __future__ import annotations

from core.schemas import (
    TERMINAL_POST_STATES,
    Order,
    OrderState,
    Post,
    PostState,
)


_POST_TRANSITIONS: dict[PostState, set[PostState]] = {
    PostState.QUEUED: {PostState.SUBMITTED, PostState.FAILED},
    PostState.SUBMITTED: {PostState.POSTED, PostState.FAILED},
    PostState.POSTED: set(),
    PostState.FAILED: {PostState.REFUNDED},
    PostState.REFUNDED: set(),
}


class InvalidTransition(ValueError):
    pass


def transition_post(post: Post, new_state: PostState) -> Post:
    allowed = _POST_TRANSITIONS[post.state]
    if new_state not in allowed:
        raise InvalidTransition(f"{post.state} -> {new_state} not allowed")
    return post.model_copy(update={"state": new_state})


def derive_order_state(posts: list[Post]) -> OrderState:
    """Roll up per-post states into a single order state.

    Rules:
    - Any non-terminal post  -> DISPATCHED
    - All POSTED             -> COMPLETED
    - All FAILED/REFUNDED    -> FAILED
    - Mixed terminal outcome -> PARTIAL
    """
    if not posts:
        return OrderState.PAID

    if any(p.state not in TERMINAL_POST_STATES for p in posts):
        return OrderState.DISPATCHED

    if all(p.state == PostState.POSTED for p in posts):
        return OrderState.COMPLETED

    if all(p.state in {PostState.FAILED, PostState.REFUNDED} for p in posts):
        return OrderState.FAILED

    return OrderState.PARTIAL


def recompute_order(order: Order) -> Order:
    return order.model_copy(update={"state": derive_order_state(order.posts)})
