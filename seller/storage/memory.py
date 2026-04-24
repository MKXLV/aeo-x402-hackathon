from __future__ import annotations

from dataclasses import dataclass, field
from uuid import UUID

from core.schemas import TERMINAL_POST_STATES, Order, Post


@dataclass
class InMemoryStore:
    """Non-persistent `OrderStore` used by tests and local dev."""
    orders: dict[UUID, Order] = field(default_factory=dict)

    async def save_order(self, order: Order) -> None:
        self.orders[order.id] = order

    async def get_order(self, order_id: UUID) -> Order | None:
        return self.orders.get(order_id)

    async def update_post(self, post: Post) -> None:
        order = self.orders.get(post.order_id)
        if order is None:
            return
        posts = [post if p.id == post.id else p for p in order.posts]
        self.orders[order.id] = order.model_copy(update={"posts": posts})

    async def list_non_terminal_posts(self, limit: int = 200) -> list[Post]:
        out: list[Post] = []
        for order in self.orders.values():
            for p in order.posts:
                if p.state not in TERMINAL_POST_STATES:
                    out.append(p)
                    if len(out) >= limit:
                        return out
        return out
