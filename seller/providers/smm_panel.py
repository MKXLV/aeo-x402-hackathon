from __future__ import annotations

import os
from dataclasses import dataclass
from decimal import Decimal
from pathlib import Path

import httpx
import yaml

from core.pricing import unit_price
from core.schemas import Platform, PostKind, PostSpec, PostState, ProviderKind
from providers.base import PostingProvider, ProviderError, StatusResult, SubmitResult

_SERVICE_MAP_PATH = Path(__file__).parent / "smm_service_map.yaml"

# SMM v2 status strings → our PostState
_STATUS_MAP = {
    "Pending": PostState.SUBMITTED,
    "In progress": PostState.SUBMITTED,
    "Processing": PostState.SUBMITTED,
    "Completed": PostState.POSTED,
    "Partial": PostState.POSTED,
    "Canceled": PostState.FAILED,
    "Cancelled": PostState.FAILED,
}


@dataclass(frozen=True)
class Upstream:
    name: str
    url: str
    key: str


def _load_upstreams() -> list[Upstream]:
    names = [n.strip() for n in os.environ.get("SMM_UPSTREAMS", "").split(",") if n.strip()]
    upstreams: list[Upstream] = []
    for name in names:
        prefix = f"SMM_{name.upper()}_"
        url = os.environ.get(prefix + "URL")
        key = os.environ.get(prefix + "KEY")
        if url and key:
            upstreams.append(Upstream(name=name, url=url, key=key))
    return upstreams


def _load_service_map() -> dict:
    if not _SERVICE_MAP_PATH.exists():
        return {}
    return yaml.safe_load(_SERVICE_MAP_PATH.read_text()) or {}


@dataclass
class SmmPanelProvider:
    kind: ProviderKind = ProviderKind.SMM
    supported_platforms: frozenset[Platform] = frozenset({Platform.REDDIT, Platform.TWITTER})
    upstreams: list[Upstream] = None  # type: ignore[assignment]
    service_map: dict = None  # type: ignore[assignment]
    http_timeout: float = 20.0

    def __post_init__(self) -> None:
        if self.upstreams is None:
            self.upstreams = _load_upstreams()
        if self.service_map is None:
            self.service_map = _load_service_map()

    def _service_id(self, upstream: str, spec: PostSpec) -> int | None:
        return (
            self.service_map
            .get(upstream, {})
            .get(spec.platform.value, {})
            .get(spec.kind.value)
        )

    async def quote(self, spec: PostSpec) -> Decimal:
        return unit_price(spec.platform, self.kind) * spec.quantity

    async def submit(self, spec: PostSpec) -> SubmitResult:
        if not self.upstreams:
            raise ProviderError("no SMM upstreams configured (check SMM_UPSTREAMS env)")

        link = spec.target.in_reply_to or _link_for(spec)
        if not link:
            raise ProviderError(
                f"SMM panel requires a target link; set target.in_reply_to or target.handle for {spec.platform}"
            )

        last_err: Exception | None = None
        async with httpx.AsyncClient(timeout=self.http_timeout) as client:
            for upstream in self.upstreams:
                service_id = self._service_id(upstream.name, spec)
                if service_id is None:
                    last_err = ProviderError(
                        f"no service ID mapped for {upstream.name}/{spec.platform.value}/{spec.kind.value}"
                    )
                    continue

                payload = {
                    "key": upstream.key,
                    "action": "add",
                    "service": service_id,
                    "link": link,
                    "quantity": spec.quantity,
                }
                if spec.kind == PostKind.COMMENT:
                    payload["comments"] = spec.body

                try:
                    r = await client.post(upstream.url, data=payload)
                    r.raise_for_status()
                    body = r.json()
                except (httpx.HTTPError, ValueError) as exc:
                    last_err = exc
                    continue

                if "error" in body:
                    last_err = ProviderError(f"{upstream.name}: {body['error']}")
                    continue

                provider_order_id = str(body.get("order"))
                return SubmitResult(
                    provider_order_id=provider_order_id,
                    upstream=upstream.name,
                    charged_usdc=await self.quote(spec),
                )

        raise ProviderError(f"all SMM upstreams failed: {last_err}")

    async def status(self, provider_order_id: str, upstream: str) -> StatusResult:
        target = next((u for u in self.upstreams if u.name == upstream), None)
        if target is None:
            return StatusResult(state=PostState.FAILED, error=f"unknown upstream {upstream}")

        async with httpx.AsyncClient(timeout=self.http_timeout) as client:
            r = await client.post(
                target.url,
                data={"key": target.key, "action": "status", "order": provider_order_id},
            )
            r.raise_for_status()
            body = r.json()

        if "error" in body:
            return StatusResult(state=PostState.FAILED, error=body["error"])

        raw_status = body.get("status", "")
        state = _STATUS_MAP.get(raw_status, PostState.SUBMITTED)
        remains = body.get("remains")
        try:
            remains_int = int(remains) if remains is not None else None
        except (TypeError, ValueError):
            remains_int = None
        return StatusResult(state=state, remains=remains_int)


def _link_for(spec: PostSpec) -> str | None:
    """Build a default target link from handle/subreddit when no explicit URL is given."""
    if spec.platform == Platform.TWITTER and spec.target.handle:
        return f"https://x.com/{spec.target.handle.lstrip('@')}"
    if spec.platform == Platform.REDDIT and spec.target.subreddit:
        name = spec.target.subreddit.lstrip("/").removeprefix("r/")
        return f"https://www.reddit.com/r/{name}/"
    return None
