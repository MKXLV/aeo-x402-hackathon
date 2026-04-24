"""One-shot x402 payer for the hackathon demo.

Usage:
    export BUYER_PRIVATE_KEY=0x...   # your Base Sepolia wallet's private key
    export TARGET_URL=https://aeoengine-o51vgsfo9-negoshify.vercel.app/v1/orders
    python scripts/pay_demo.py

What it does:
    1. POSTs an order to TARGET_URL without payment -> gets 402
    2. Reads the payment requirements from the x402 response
    3. Signs an EIP-3009 USDC authorization for the quoted amount
    4. Retries with X-PAYMENT -> gets 200 + order JSON
    5. Prints the tx hash so you can open it on BaseScan
"""
from __future__ import annotations

import asyncio
import json
import os
import sys
from pathlib import Path

from eth_account import Account
import httpx

from x402.client import x402Client
from x402.http.clients.httpx import x402HttpxClient
from x402.http.x402_http_client import x402HTTPClient
from x402.mechanisms.evm import EthAccountSigner
from x402.mechanisms.evm.exact import ExactEvmClientScheme


FIXTURE = Path(__file__).parent.parent / "fixtures" / "order.json"


async def main() -> int:
    pk = os.environ.get("BUYER_PRIVATE_KEY")
    url = os.environ.get("TARGET_URL")
    if not pk or not url:
        print("ERROR: set BUYER_PRIVATE_KEY and TARGET_URL", file=sys.stderr)
        return 1

    account = Account.from_key(pk)
    print(f"buyer:     {account.address}")
    print(f"target:    {url}")

    signer = EthAccountSigner(account)
    scheme = ExactEvmClientScheme(signer)

    client = x402Client()
    client.register(scheme)

    http_client = x402HTTPClient(client)
    order_body = json.loads(FIXTURE.read_text())

    async with x402HttpxClient(http_client) as session:
        resp = await session.post(url, json=order_body, timeout=60.0)
        print(f"status:    {resp.status_code}")
        print(f"headers:   X-Payment-Response = {resp.headers.get('x-payment-response', '(none)')}")
        if resp.status_code >= 400:
            print("body:", resp.text)
            return 2
        data = resp.json()
        print("order id:  ", data.get("id"))
        print("state:     ", data.get("state"))
        print("total:     ", data.get("total_usdc"), "USDC")
        print("payer:     ", data.get("payer_address"))
    return 0


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
