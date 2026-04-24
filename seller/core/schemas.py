from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from enum import Enum
from typing import Any, Literal
from uuid import UUID

from pydantic import BaseModel, Field, field_validator


class Platform(str, Enum):
    REDDIT = "reddit"
    TWITTER = "twitter"


class PostKind(str, Enum):
    POST = "post"
    COMMENT = "comment"
    UPVOTE = "upvote"
    LIKE = "like"
    RETWEET = "retweet"


class ProviderKind(str, Enum):
    UGC = "ugc"
    SMM = "smm"


class PostState(str, Enum):
    QUEUED = "queued"
    SUBMITTED = "submitted"
    POSTED = "posted"
    FAILED = "failed"
    REFUNDED = "refunded"


class OrderState(str, Enum):
    PAID = "paid"
    DISPATCHED = "dispatched"
    COMPLETED = "completed"
    PARTIAL = "partial"
    FAILED = "failed"


TERMINAL_POST_STATES = {PostState.POSTED, PostState.FAILED, PostState.REFUNDED}
TERMINAL_ORDER_STATES = {OrderState.COMPLETED, OrderState.PARTIAL, OrderState.FAILED}


class PostTarget(BaseModel):
    subreddit: str | None = None
    in_reply_to: str | None = None
    handle: str | None = None


class PostSpec(BaseModel):
    platform: Platform
    kind: PostKind = PostKind.POST
    body: str = Field(min_length=1, max_length=10_000)
    topics: list[str] = Field(default_factory=list, max_length=16)
    target: PostTarget = Field(default_factory=PostTarget)
    provider_preference: ProviderKind | None = None
    quantity: int = Field(default=1, ge=1, le=1000)

    @field_validator("topics")
    @classmethod
    def normalize_topics(cls, v: list[str]) -> list[str]:
        return [t.strip().lower() for t in v if t.strip()]


class OrderRequest(BaseModel):
    posts: list[PostSpec] = Field(min_length=1, max_length=500)
    callback_url: str | None = None
    metadata: dict[str, Any] = Field(default_factory=dict)


class PaymentContext(BaseModel):
    """Info extracted from a verified x402 payment. Populated by middleware."""
    payer_address: str
    amount_usdc: Decimal
    network: Literal["base", "base-sepolia"] = "base"
    tx_hash: str | None = None
    verified: bool = True


class Post(BaseModel):
    id: UUID
    order_id: UUID
    spec: PostSpec
    provider: ProviderKind
    upstream: str | None = None
    provider_order_id: str | None = None
    state: PostState = PostState.QUEUED
    unit_price_usdc: Decimal
    error: str | None = None
    updated_at: datetime


class Order(BaseModel):
    id: UUID
    state: OrderState
    payer_address: str
    total_usdc: Decimal
    callback_url: str | None = None
    metadata: dict[str, Any] = Field(default_factory=dict)
    posts: list[Post]
    created_at: datetime
