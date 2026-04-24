from __future__ import annotations

import json
import os
from decimal import Decimal
from pathlib import Path
from uuid import UUID

import psycopg
from psycopg.rows import dict_row

from core.schemas import (
    Order,
    OrderState,
    Platform,
    Post,
    PostKind,
    PostSpec,
    PostState,
    PostTarget,
    ProviderKind,
)

_SCHEMA_PATH = Path(__file__).parent / "schema.sql"


def _conn_str() -> str:
    url = os.environ.get("DATABASE_URL")
    if not url:
        raise RuntimeError("DATABASE_URL is not set")
    return url


async def init_schema() -> None:
    async with await psycopg.AsyncConnection.connect(_conn_str()) as conn:
        await conn.execute(_SCHEMA_PATH.read_text())


def _row_to_post(row: dict) -> Post:
    spec = PostSpec(
        platform=Platform(row["platform"]),
        kind=PostKind(row["kind"]),
        body=row["body"],
        topics=row["topics"] if isinstance(row["topics"], list) else json.loads(row["topics"]),
        target=PostTarget(**(row["target"] if isinstance(row["target"], dict) else json.loads(row["target"]))),
        quantity=row["quantity"],
    )
    return Post(
        id=row["id"],
        order_id=row["order_id"],
        spec=spec,
        provider=ProviderKind(row["provider"]),
        upstream=row["upstream"],
        provider_order_id=row["provider_order_id"],
        state=PostState(row["state"]),
        unit_price_usdc=Decimal(row["unit_price_usdc"]),
        error=row["error"],
        updated_at=row["updated_at"],
    )


class PostgresStore:
    """Implementation of `core.storage_protocol.OrderStore` backed by Neon."""

    async def save_order(self, order: Order) -> None:
        async with await psycopg.AsyncConnection.connect(_conn_str()) as conn:
            async with conn.transaction():
                await conn.execute(
                    """
                    INSERT INTO orders (id, state, payer_address, total_usdc, callback_url, metadata, created_at)
                    VALUES (%s, %s, %s, %s, %s, %s::jsonb, %s)
                    ON CONFLICT (id) DO UPDATE SET
                        state = EXCLUDED.state,
                        total_usdc = EXCLUDED.total_usdc,
                        callback_url = EXCLUDED.callback_url,
                        metadata = EXCLUDED.metadata
                    """,
                    (
                        str(order.id),
                        order.state.value,
                        order.payer_address,
                        order.total_usdc,
                        order.callback_url,
                        json.dumps(order.metadata),
                        order.created_at,
                    ),
                )
                for post in order.posts:
                    await self._upsert_post(conn, post)

    async def get_order(self, order_id: UUID) -> Order | None:
        async with await psycopg.AsyncConnection.connect(_conn_str()) as conn:
            async with conn.cursor(row_factory=dict_row) as cur:
                await cur.execute("SELECT * FROM orders WHERE id = %s", (str(order_id),))
                row = await cur.fetchone()
                if row is None:
                    return None
                await cur.execute(
                    "SELECT * FROM posts WHERE order_id = %s ORDER BY updated_at",
                    (str(order_id),),
                )
                post_rows = await cur.fetchall()

        return Order(
            id=row["id"],
            state=OrderState(row["state"]),
            payer_address=row["payer_address"],
            total_usdc=Decimal(row["total_usdc"]),
            callback_url=row["callback_url"],
            metadata=row["metadata"] if isinstance(row["metadata"], dict) else json.loads(row["metadata"]),
            posts=[_row_to_post(r) for r in post_rows],
            created_at=row["created_at"],
        )

    async def update_post(self, post: Post) -> None:
        async with await psycopg.AsyncConnection.connect(_conn_str()) as conn:
            async with conn.transaction():
                await self._upsert_post(conn, post)

    async def list_non_terminal_posts(self, limit: int = 200) -> list[Post]:
        async with await psycopg.AsyncConnection.connect(_conn_str()) as conn:
            async with conn.cursor(row_factory=dict_row) as cur:
                await cur.execute(
                    """
                    SELECT * FROM posts
                    WHERE state NOT IN ('posted', 'failed', 'refunded')
                    ORDER BY updated_at ASC
                    LIMIT %s
                    """,
                    (limit,),
                )
                rows = await cur.fetchall()
        return [_row_to_post(r) for r in rows]

    @staticmethod
    async def _upsert_post(conn: psycopg.AsyncConnection, post: Post) -> None:
        await conn.execute(
            """
            INSERT INTO posts (id, order_id, platform, kind, body, topics, target,
                               quantity, provider, upstream, provider_order_id,
                               state, unit_price_usdc, error, updated_at)
            VALUES (%s, %s, %s, %s, %s, %s::jsonb, %s::jsonb,
                    %s, %s, %s, %s, %s, %s, %s, %s)
            ON CONFLICT (id) DO UPDATE SET
                upstream = EXCLUDED.upstream,
                provider_order_id = EXCLUDED.provider_order_id,
                state = EXCLUDED.state,
                error = EXCLUDED.error,
                updated_at = EXCLUDED.updated_at
            """,
            (
                str(post.id),
                str(post.order_id),
                post.spec.platform.value,
                post.spec.kind.value,
                post.spec.body,
                json.dumps(post.spec.topics),
                json.dumps(post.spec.target.model_dump()),
                post.spec.quantity,
                post.provider.value,
                post.upstream,
                post.provider_order_id,
                post.state.value,
                post.unit_price_usdc,
                post.error,
                post.updated_at,
            ),
        )
