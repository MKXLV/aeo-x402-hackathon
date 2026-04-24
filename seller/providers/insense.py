"""Insense UGC partner API adapter (fallback for Billo).

Same provider shape as Billo, different auth/endpoints. Used when UGC_PRIMARY=insense
or when Billo partner access is pending. Endpoint shape below is provisional —
confirm against Insense partner docs.
"""
from __future__ import annotations

import logging
import os
from dataclasses import dataclass
from decimal import Decimal

import httpx

from core.pricing import unit_price
from core.schemas import Platform, PostSpec, PostState, ProviderKind
from providers.base import ProviderError, StatusResult, SubmitResult

log = logging.getLogger(__name__)

_CAMPAIGN_ENDPOINT = "/campaigns"
_CAMPAIGN_STATUS_ENDPOINT = "/campaigns/{id}"

_STATUS_MAP = {
    "pending": PostState.SUBMITTED,
    "in_review": PostState.SUBMITTED,
    "in_progress": PostState.SUBMITTED,
    "delivered": PostState.POSTED,
    "completed": PostState.POSTED,
    "rejected": PostState.FAILED,
    "canceled": PostState.FAILED,
}


@dataclass
class InsenseProvider:
    kind: ProviderKind = ProviderKind.UGC
    supported_platforms: frozenset[Platform] = frozenset({Platform.REDDIT, Platform.TWITTER})
    base_url: str = ""
    api_key: str = ""
    http_timeout: float = 30.0

    def __post_init__(self) -> None:
        self.base_url = self.base_url or os.environ.get("INSENSE_API_URL", "")
        self.api_key = self.api_key or os.environ.get("INSENSE_API_KEY", "")
        if not self.api_key:
            log.warning("INSENSE_API_KEY is unset; InsenseProvider will reject submissions.")

    def _headers(self) -> dict[str, str]:
        return {"X-Api-Key": self.api_key, "Content-Type": "application/json"}

    async def quote(self, spec: PostSpec) -> Decimal:
        return unit_price(spec.platform, self.kind) * spec.quantity

    async def submit(self, spec: PostSpec) -> SubmitResult:
        if not self.api_key:
            raise ProviderError("Insense partner API key not configured")

        campaign = {
            "platform": spec.platform.value,
            "quantity": spec.quantity,
            "tags": spec.topics,
            "brief": spec.body,
            "target": spec.target.model_dump(exclude_none=True),
            "deliverables": ["post_url", "screenshot"],
        }

        async with httpx.AsyncClient(timeout=self.http_timeout, base_url=self.base_url) as client:
            r = await client.post(_CAMPAIGN_ENDPOINT, headers=self._headers(), json=campaign)
        if r.status_code >= 400:
            raise ProviderError(f"Insense campaign creation failed: {r.status_code} {r.text}")
        body = r.json()
        campaign_id = body.get("id") or body.get("campaign_id")
        if not campaign_id:
            raise ProviderError(f"Insense response missing campaign id: {body}")

        return SubmitResult(
            provider_order_id=str(campaign_id),
            upstream="insense",
            charged_usdc=await self.quote(spec),
        )

    async def status(self, provider_order_id: str, upstream: str) -> StatusResult:
        if not self.api_key:
            return StatusResult(state=PostState.FAILED, error="Insense API key not configured")

        async with httpx.AsyncClient(timeout=self.http_timeout, base_url=self.base_url) as client:
            r = await client.get(
                _CAMPAIGN_STATUS_ENDPOINT.format(id=provider_order_id),
                headers=self._headers(),
            )
        if r.status_code == 404:
            return StatusResult(state=PostState.FAILED, error="campaign not found")
        r.raise_for_status()
        body = r.json()
        raw = (body.get("status") or "").lower()
        return StatusResult(state=_STATUS_MAP.get(raw, PostState.SUBMITTED))
