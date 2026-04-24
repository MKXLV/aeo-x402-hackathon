# aeo_engine — UGC purchase flow

End-to-end seller-side service that accepts USDC payments via **x402**
(listable on [agentic.market](https://agentic.market)) and dispatches Reddit /
Twitter posts through pluggable providers:

- **SMM path** — JustAnotherPanel (primary) + Peakerr (failover), both behind
  one adapter implementing the SMM v2 JSON standard.
- **UGC path** — Billo (primary) + Insense (fallback), both partner-gated REST
  APIs.

The reusable entry point for a larger agent skill is
`core.service.purchase_ugc(request, payment, providers, store)` — it has no
HTTP coupling, so the FastAPI layer and an agent-skill function tool can share
the same orchestrator.

## Module map

| Path | Role |
| --- | --- |
| `api/index.py` | FastAPI app — POST `/v1/orders`, GET `/v1/orders/{id}`, `/v1/orders/quote`, service descriptor |
| `api/tick.py` | Vercel Cron — polls non-terminal posts, transitions state, refunds failures, fires callbacks |
| `core/service.py` | **Reusable entry point** — `purchase_ugc(...)` |
| `core/schemas.py` | Pydantic contracts (OrderRequest, PostSpec, PaymentContext, Order, Post) |
| `core/pricing.py` | Quote builder with env-overridable unit prices |
| `core/state.py` | Post + order state machine |
| `core/storage_protocol.py` | `OrderStore` protocol — implemented by `storage/db.py` and `storage/memory.py` |
| `payments/x402_config.py` | x402 middleware + `PaymentContext` extraction |
| `payments/refund.py` | Partial-refund compute + issue (dry-run until wallet configured) |
| `providers/base.py` | `PostingProvider` protocol |
| `providers/smm_panel.py` | SMM v2 adapter — multi-upstream with failover |
| `providers/billo.py` / `providers/insense.py` | UGC adapters |
| `providers/fake.py` | In-memory provider for tests + `USE_FAKE_PROVIDERS=1` dev |
| `providers/registry.py` | Runtime wiring of the provider set |
| `storage/db.py` / `storage/memory.py` | Postgres (Neon) + in-memory stores |

## Local dev

```bash
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env         # then fill in keys

# Run tests (no external deps)
pytest

# Run the API with fakes (no real providers, no payments)
USE_FAKE_PROVIDERS=1 BYPASS_X402=1 vercel dev
```

## Ship checklist

1. `vercel link` + `vercel env add` for every key in `.env.example`.
2. Install the Neon Postgres integration from the Vercel Marketplace.
3. Run `psql $DATABASE_URL < storage/schema.sql` once.
4. Fund the receiving wallet on Base (USDC).
5. Refresh `providers/smm_service_map.yaml` with real service IDs from each panel's `action=services` response.
6. `vercel deploy --prod` and submit the public URL to agentic.market's directory.

## Reuse in a larger agent skill

```python
from core.service import purchase_ugc
from core.schemas import OrderRequest, PaymentContext
from providers.registry import build_providers
from storage.db import PostgresStore

order = await purchase_ugc(
    request=OrderRequest(...),
    payment=PaymentContext(...),
    providers=build_providers(),
    store=PostgresStore(),
)
```

`core/` imports nothing from `api/`, `providers/` (concrete), or `payments/` —
only protocols. That's the composition seam.
