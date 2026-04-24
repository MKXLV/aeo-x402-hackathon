"""Billo UGC partner API adapter.

Billo's partner REST API is behind an onboarding gate (help.billo.app). The
endpoint paths and payload shape below are the minimal brief-creation contract
we design against; confirm and adjust once partner credentials are issued.
"""
from __future__ import annotations

import logging
import os
from dataclasses import dataclass
from decimal import Decimal

import httpx

from core.pricing import unit_price
from core.schemas import Platform, PostSpec, PostState, ProviderKind
from providers.base import PostingProvider, ProviderError, StatusResult, SubmitResult

log = logging.getLogger(__name__)

# Provisional — confirm against Billo partner docs.
_BRIEF_ENDPOINT = "/briefs"
_BRIEF_STATUS_ENDPOINT = "/briefs/{id}"

_STATUS_MAP = {
    "draft": PostState.SUBMITTED,
    "open": PostState.SUBMITTED,
    "matched": PostState.SUBMITTED,
    "delivered": PostState.POSTED,
    "approved": PostState.POSTED,
    "rejected": PostState.FAILED,
    "canceled": PostState.FAILED,
}


@dataclass
class BilloProvider:
    kind: ProviderKind = ProviderKind.UGC
    supported_platforms: frozenset[Platform] = frozenset({Platform.REDDIT, Platform.TWITTER})
    base_url: str = ""
    api_key: str = ""
    http_timeout: float = 30.0

    def __post_init__(self) -> None:
        self.base_url = self.base_url or os.environ.get("BILLO_API_URL", "")
        self.api_key = self.api_key or os.environ.get("BILLO_API_KEY", "")
        if not self.api_key:
            log.warning(
                "BILLO_API_KEY is unset; BilloProvider will reject submissions. "
                "UGC traffic should route to Insense until partner access lands."
            )

    def _headers(self) -> dict[str, str]:
        return {"Authorization": f"Bearer {self.api_key}", "Content-Type": "application/json"}

    async def quote(self, spec: PostSpec) -> Decimal:
        return unit_price(spec.platform, self.kind) * spec.quantity

    async def submit(self, spec: PostSpec) -> SubmitResult:
        if not self.api_key:
            raise ProviderError("Billo partner API key not configured")

        brief = {
            "platform": spec.platform.value,
            "quantity": spec.quantity,
            "topics": spec.topics,
            "content": spec.body,
            "target": spec.target.model_dump(exclude_none=True),
            "delivery": {"require_post_url": True, "require_screenshot": True},
        }

        async with httpx.AsyncClient(timeout=self.http_timeout, base_url=self.base_url) as client:
            r = await client.post(_BRIEF_ENDPOINT, headers=self._headers(), json=brief)
        if r.status_code >= 400:
            raise ProviderError(f"Billo brief creation failed: {r.status_code} {r.text}")
        body = r.json()
        brief_id = body.get("id") or body.get("brief_id")
        if not brief_id:
            raise ProviderError(f"Billo response missing brief id: {body}")

        return SubmitResult(
            provider_order_id=str(brief_id),
            upstream="billo",
            charged_usdc=await self.quote(spec),
        )

    async def status(self, provider_order_id: str, upstream: str) -> StatusResult:
        if not self.api_key:
            return StatusResult(state=PostState.FAILED, error="Billo API key not configured")

        async with httpx.AsyncClient(timeout=self.http_timeout, base_url=self.base_url) as client:
            r = await client.get(
                _BRIEF_STATUS_ENDPOINT.format(id=provider_order_id),
                headers=self._headers(),
            )
        if r.status_code == 404:
            return StatusResult(state=PostState.FAILED, error="brief not found")
        r.raise_for_status()
        body = r.json()
        raw = (body.get("status") or "").lower()
        return StatusResult(state=_STATUS_MAP.get(raw, PostState.SUBMITTED))
