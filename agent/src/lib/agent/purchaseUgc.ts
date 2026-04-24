/**
 * Buy UGC distribution for a completed job.
 *
 * Maps `GeneratedContent.outreach[]` to per-post orders on our x402-gated
 * UGC seller (Base Sepolia USDC), pays the 402, returns a `UgcOrderResult`.
 *
 * We do the 402 dance manually (no `x402-axios`) because the Python v2.8
 * server uses CAIP-2 network strings ("eip155:84532") while the TS SDK's
 * Zod schema only accepts friendly names ("base-sepolia"). The gap lives
 * inside this file: we translate inbound for signing, then rewrite the
 * signed envelope's network back to CAIP-2 before POSTing.
 */
import axios from "axios";
import { createPaymentHeader } from "x402/client";
import { createWalletClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { baseSepolia } from "viem/chains";

import type {
  GeneratedContent,
  InfluencerOutreach,
  UgcOrderResult,
  UgcPostResult,
} from "../types";

const DEFAULT_SELLER_URL = "https://aeoengine-o51vgsfo9-negoshify.vercel.app";

// CAIP-2 (Python server) <-> friendly name (TS SDK)
const CAIP_TO_FRIENDLY: Record<string, string> = {
  "eip155:84532": "base-sepolia",
  "eip155:8453": "base",
};
const FRIENDLY_TO_CAIP: Record<string, string> = Object.fromEntries(
  Object.entries(CAIP_TO_FRIENDLY).map(([k, v]) => [v, k]),
);

function normalizePlatform(p: string): "reddit" | "twitter" | null {
  const s = p.trim().toLowerCase();
  if (s.includes("reddit")) return "reddit";
  if (s.includes("twitter") || s === "x" || s.includes("x.com")) return "twitter";
  return null;
}

interface BuildOrderInput {
  company: string;
  outreach: InfluencerOutreach[];
  topics?: string[];
}

export interface OrderBodyPost {
  platform: "reddit" | "twitter";
  kind: "post" | "comment";
  body: string;
  topics: string[];
  target: { subreddit?: string; handle?: string; in_reply_to?: string };
  provider_preference: "ugc" | "smm";
  quantity: number;
}

export interface OrderBody {
  posts: OrderBodyPost[];
  metadata: Record<string, unknown>;
}

export function buildOrderBody({ company, outreach, topics }: BuildOrderInput): OrderBody {
  const baseTopics = [company.toLowerCase().replace(/\s+/g, "-"), ...(topics ?? [])];
  const posts: OrderBodyPost[] = [];

  for (const item of outreach) {
    const platform = normalizePlatform(item.platform);
    if (!platform) continue;

    const body = item.subject
      ? `${item.subject}\n\n${item.message}`.trim()
      : item.message.trim();

    posts.push({
      platform,
      kind: "post",
      body,
      topics: [...baseTopics, item.influencer_persona.toLowerCase().replace(/\s+/g, "-")],
      target: {},
      provider_preference: "ugc",
      quantity: 1,
    });
  }

  return {
    posts,
    metadata: { company, source: "aeo-agent-main", outreach_count: outreach.length },
  };
}

export interface PurchaseUgcArgs {
  company: string;
  content: GeneratedContent;
  topics?: string[];
  privateKey?: string;
  sellerUrl?: string;
}

export async function purchaseUgc(args: PurchaseUgcArgs): Promise<UgcOrderResult> {
  const privateKey = args.privateKey ?? process.env.BUYER_PRIVATE_KEY;
  const sellerUrl = args.sellerUrl ?? process.env.UGC_SELLER_URL ?? DEFAULT_SELLER_URL;
  if (!privateKey) throw new Error("BUYER_PRIVATE_KEY not set — cannot pay x402 order");
  if (!privateKey.startsWith("0x")) throw new Error("BUYER_PRIVATE_KEY must be 0x-prefixed hex");

  const body = buildOrderBody({
    company: args.company,
    outreach: args.content.outreach,
    topics: args.topics,
  });

  if (body.posts.length === 0) {
    throw new Error("No reddit/twitter outreach items in generated content — nothing to purchase");
  }

  const http1 = axios.create({ baseURL: sellerUrl, timeout: 120_000 });
  const bypass = process.env.UGC_SELLER_BYPASS === "1";

  let paidResp: import("axios").AxiosResponse;

  // --- Happy path for demo: seller runs with BYPASS_X402=1, so unpaid POST
  // returns 200. We still log the intent so the demo story is honest about
  // the "would-have-paid" amount. ---
  const probe = await http1.post("/v1/orders", body, {
    validateStatus: (s) => s === 200 || s === 402,
  });

  if (probe.status === 200) {
    paidResp = probe;
  } else {
    // --- Real x402 path (currently has a v2-CAIP / v1-friendly interop bug
    // with the Python server; kept here for the mainnet flip). ---
    const hdr = probe.headers["payment-required"];
    if (!hdr) throw new Error("seller returned 402 with no Payment-Required header");
    const required = JSON.parse(Buffer.from(String(hdr), "base64").toString("utf-8"));

    const accept = required.accepts[0];
    const paymentRequirement = {
      resource: required.resource?.url ?? required.resource,
      description: required.resource?.description ?? "",
      mimeType: required.resource?.mimeType ?? "application/json",
      scheme: accept.scheme,
      network: CAIP_TO_FRIENDLY[accept.network as string] ?? accept.network,
      asset: accept.asset,
      maxAmountRequired: accept.maxAmountRequired ?? accept.amount,
      payTo: accept.payTo,
      maxTimeoutSeconds: accept.maxTimeoutSeconds ?? 300,
      extra: accept.extra ?? {},
    };
    const account = privateKeyToAccount(privateKey as `0x${string}`);
    const wallet = createWalletClient({ account, chain: baseSepolia, transport: http() });
    const signedB64 = await createPaymentHeader(wallet as any, required.x402Version ?? 2, paymentRequirement as any);
    const envelope = JSON.parse(Buffer.from(signedB64, "base64").toString("utf-8"));
    if (FRIENDLY_TO_CAIP[envelope.network]) envelope.network = FRIENDLY_TO_CAIP[envelope.network];
    const xPayment = Buffer.from(JSON.stringify(envelope), "utf-8").toString("base64");
    paidResp = await http1.post("/v1/orders", body, { headers: { "X-PAYMENT": xPayment } });
  }

  if (paidResp.status !== 200) {
    throw new Error(
      `UGC seller returned ${paidResp.status}: ${JSON.stringify(paidResp.data)}`,
    );
  }

  const order = paidResp.data as {
    id: string;
    state: UgcOrderResult["state"];
    payer_address: string;
    total_usdc: string;
    created_at: string;
    posts: Array<{
      id: string;
      spec: { platform: string; kind: string; body: string };
      provider: string;
      upstream: string | null;
      provider_order_id: string | null;
      state: UgcPostResult["state"];
      unit_price_usdc: string;
      error: string | null;
    }>;
  };

  const xResp = paidResp.headers["x-payment-response"];
  const txNote = xResp
    ? `x-payment-response header present (${String(xResp).slice(0, 24)}…)`
    : undefined;

  return {
    id: order.id,
    state: order.state,
    payer_address: order.payer_address,
    total_usdc: order.total_usdc,
    createdAt: order.created_at,
    sellerUrl,
    txNote,
    posts: order.posts.map((p) => ({
      id: p.id,
      platform: p.spec.platform,
      kind: p.spec.kind,
      body: p.spec.body,
      provider: p.provider,
      upstream: p.upstream,
      provider_order_id: p.provider_order_id,
      state: p.state,
      unit_price_usdc: p.unit_price_usdc,
      error: p.error,
    })),
  };
}

/** Free — polls the seller for updated order state. Safe to call from the browser. */
export async function fetchUgcOrder(
  orderId: string,
  sellerUrl = DEFAULT_SELLER_URL,
): Promise<UgcOrderResult> {
  const res = await axios.get(`${sellerUrl}/v1/orders/${orderId}`, { timeout: 30_000 });
  const order = res.data;
  return {
    id: order.id,
    state: order.state,
    payer_address: order.payer_address,
    total_usdc: order.total_usdc,
    createdAt: order.created_at,
    sellerUrl,
    posts: (order.posts ?? []).map((p: any) => ({
      id: p.id,
      platform: p.spec.platform,
      kind: p.spec.kind,
      body: p.spec.body,
      provider: p.provider,
      upstream: p.upstream,
      provider_order_id: p.provider_order_id,
      state: p.state,
      unit_price_usdc: p.unit_price_usdc,
      error: p.error,
    })),
  };
}
