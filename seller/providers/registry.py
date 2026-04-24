"""Central wiring: decide which concrete providers back SMM/UGC at runtime."""
from __future__ import annotations

import os
from functools import lru_cache

from core.schemas import ProviderKind
from providers.base import PostingProvider
from providers.billo import BilloProvider
from providers.fake import FakeProvider
from providers.insense import InsenseProvider
from providers.smm_panel import SmmPanelProvider


def _truthy(name: str) -> bool:
    return os.environ.get(name, "0").lower() in {"1", "true", "yes"}


@lru_cache(maxsize=1)
def build_providers() -> dict[ProviderKind, PostingProvider]:
    if _truthy("USE_FAKE_PROVIDERS"):
        smm = FakeProvider(kind=ProviderKind.SMM, name="fake-smm")
        ugc = FakeProvider(kind=ProviderKind.UGC, name="fake-ugc")
        return {ProviderKind.SMM: smm, ProviderKind.UGC: ugc}

    providers: dict[ProviderKind, PostingProvider] = {
        ProviderKind.SMM: SmmPanelProvider(),
    }

    ugc_primary = os.environ.get("UGC_PRIMARY", "billo").lower()
    if ugc_primary == "insense" or not os.environ.get("BILLO_API_KEY"):
        if os.environ.get("INSENSE_API_KEY"):
            providers[ProviderKind.UGC] = InsenseProvider()
        elif os.environ.get("BILLO_API_KEY"):
            providers[ProviderKind.UGC] = BilloProvider()
    else:
        providers[ProviderKind.UGC] = BilloProvider()

    return providers
