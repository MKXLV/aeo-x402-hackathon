"""x402 v2.8 seller-side wiring — live on Base Sepolia."""
from __future__ import annotations

import logging
import os
from decimal import Decimal

from fastapi import FastAPI, Request

from core.schemas import PaymentContext

log = logging.getLogger(__name__)


def install_x402(app: FastAPI, paid_routes: list[str]) -> None:
    if os.environ.get("BYPASS_X402") == "1":
        log.warning("BYPASS_X402=1; x402 middleware not installed. Dev only.")
        return

    from x402.http import FacilitatorConfig, HTTPFacilitatorClient, PaymentOption
    from x402.http.middleware.fastapi import PaymentMiddlewareASGI
    from x402.http.types import RouteConfig
    from x402.mechanisms.evm.exact import ExactEvmServerScheme
    from x402.server import x402ResourceServer

    evm_address = os.environ["EVM_ADDRESS"]
    network = os.environ.get("X402_NETWORK", "eip155:84532")  # Base Sepolia
    facilitator_url = os.environ.get("FACILITATOR_URL", "https://x402.org/facilitator")
    price = os.environ.get("X402_DEMO_PRICE", "$1.00")

    facilitator = HTTPFacilitatorClient(FacilitatorConfig(url=facilitator_url))
    server = x402ResourceServer(facilitator)
    server.register(network, ExactEvmServerScheme())

    routes = {
        route: RouteConfig(
            accepts=[PaymentOption(scheme="exact", pay_to=evm_address, price=price, network=network)],
            mime_type="application/json",
            description="Buy UGC — Reddit/Twitter posts delivered via SMM panels or UGC creators.",
        )
        for route in paid_routes
    }
    app.add_middleware(PaymentMiddlewareASGI, routes=routes, server=server)
    log.info("x402 installed: paid=%s, receiving=%s, net=%s, price=%s", paid_routes, evm_address, network, price)


def payment_from_request(request: Request) -> PaymentContext:
    if os.environ.get("BYPASS_X402") == "1":
        return PaymentContext(payer_address="0xDEV", amount_usdc=Decimal("999"), network="base-sepolia", verified=False)

    pay = getattr(request.state, "x402_payment", None)
    payer = getattr(pay, "payer", None) if pay else request.headers.get("x-payer", "0xUNKNOWN")
    amount = Decimal(str(getattr(pay, "amount", "1"))) if pay else Decimal("1")
    return PaymentContext(payer_address=payer or "0xUNKNOWN", amount_usdc=amount, network="base-sepolia", verified=True)
