from __future__ import annotations

import uuid
from dataclasses import dataclass, field
from decimal import Decimal

from core.pricing import unit_price
from core.schemas import Platform, PostSpec, PostState, ProviderKind
from providers.base import PostingProvider, StatusResult, SubmitResult


@dataclass
class FakeProvider:
    """In-memory provider for tests and `USE_FAKE_PROVIDERS=1` local dev.

    By default, every submitted post transitions to POSTED on the next `status()` call.
    Override `force_state` to drive failure scenarios deterministically.
    """
    kind: ProviderKind = ProviderKind.SMM
    supported_platforms: frozenset[Platform] = frozenset({Platform.REDDIT, Platform.TWITTER})
    name: str = "fake"
    force_state: PostState | None = None
    _submissions: dict[str, PostSpec] = field(default_factory=dict)

    async def quote(self, spec: PostSpec) -> Decimal:
        return unit_price(spec.platform, self.kind) * spec.quantity

    async def submit(self, spec: PostSpec) -> SubmitResult:
        pid = f"fake-{uuid.uuid4().hex[:12]}"
        self._submissions[pid] = spec
        return SubmitResult(
            provider_order_id=pid,
            upstream=self.name,
            charged_usdc=await self.quote(spec),
        )

    async def status(self, provider_order_id: str, upstream: str) -> StatusResult:
        if provider_order_id not in self._submissions:
            return StatusResult(state=PostState.FAILED, error="unknown provider_order_id")
        state = self.force_state or PostState.POSTED
        return StatusResult(state=state, remains=0)
