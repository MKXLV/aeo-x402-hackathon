from __future__ import annotations

from dataclasses import dataclass
from decimal import Decimal
from typing import Protocol, runtime_checkable

from core.schemas import Platform, PostSpec, PostState, ProviderKind


@dataclass(frozen=True)
class SubmitResult:
    provider_order_id: str
    upstream: str
    charged_usdc: Decimal


@dataclass(frozen=True)
class StatusResult:
    state: PostState
    remains: int | None = None
    error: str | None = None


class ProviderError(RuntimeError):
    """Raised when a provider cannot accept or complete a submission."""


@runtime_checkable
class PostingProvider(Protocol):
    kind: ProviderKind
    supported_platforms: frozenset[Platform]

    async def quote(self, spec: PostSpec) -> Decimal: ...

    async def submit(self, spec: PostSpec) -> SubmitResult: ...

    async def status(self, provider_order_id: str, upstream: str) -> StatusResult: ...
