# aeo-x402-hackathon

Three-piece AEO agent:

- **seller/** — Python FastAPI, x402-gated UGC seller (Vercel). Accepts USDC on Base Sepolia, dispatches Reddit/Twitter posts through pluggable providers (JAP / Peakerr / Billo / Insense). Demo runs with `BYPASS_X402=1 USE_FAKE_PROVIDERS=1`.
- **agent/** — Next.js App Router. Researches a company, generates content (blog / podcast / outreach / substack), and pays the seller via x402 to distribute the outreach leg.
- **media-researcher/** — Python CLI (separate skill). Given a brief, finds journalists, podcasts, and publications to pitch. Called from the agent via a server-side subprocess; degrades gracefully when discovery keys are missing.

## Local setup

```bash
# 1. Seller deps (shared with media-researcher)
cd seller && python3 -m venv .venv && .venv/bin/pip install -r requirements.txt

# 2. Install media-researcher into the same venv
../.venv/bin/pip install -e ../media-researcher/media-researcher-core

# 3. Agent
cd ../agent && npm install
cp .env.example .env.local   # fill in keys (see .env.example)
npm run dev
```

## Demo env (agent/.env.local)

```
BUYER_PRIVATE_KEY=0x...                                # Base Sepolia wallet with test USDC
UGC_SELLER_URL=https://<seller>.vercel.app
TINYFISH_API_KEY=sk-tinyfish-...
MEDIA_RESEARCHER_BIN=/absolute/path/to/.venv/bin/media-researcher
```
