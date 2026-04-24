from __future__ import annotations

from typing import Protocol, runtime_checkable
from uuid import UUID

from core.schemas import Order, Post


@runtime_checkable
class OrderStore(Protocol):
    async def save_order(self, order: Order) -> None: ...
    async def get_order(self, order_id: UUID) -> Order | None: ...
    async def update_post(self, post: Post) -> None: ...
    async def list_non_terminal_posts(self, limit: int = 200) -> list[Post]: ...
