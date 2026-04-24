/**
 * Verbose smoke test. Captures every request/response so we can see what the
 * signed retry actually looks like and what the server says when it rejects.
 */
import axios from "axios";
import { withPaymentInterceptor } from "x402-axios";
import { createWalletClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { baseSepolia } from "viem/chains";

const SELLER = process.env.UGC_SELLER_URL ?? "https://aeoengine-o51vgsfo9-negoshify.vercel.app";
const PK = process.env.BUYER_PRIVATE_KEY as `0x${string}`;

const ORDER = {
  posts: [
    {
      platform: "reddit",
      kind: "post",
      body: "smoke test",
      topics: ["smoke"],
      target: {},
      provider_preference: "ugc",
      quantity: 1,
    },
  ],
  metadata: { smoke: true },
};

async function main() {
  const account = privateKeyToAccount(PK);
  const wallet = createWalletClient({ account, chain: baseSepolia, transport: http() });
  const client = axios.create({ baseURL: SELLER, timeout: 120_000 });

  client.interceptors.response.use(
    (r) => r,
    (error) => {
      const resp = error?.response;
      if (resp?.status === 402 && (!resp.data || typeof resp.data !== "object" || !("x402Version" in resp.data))) {
        const header = resp.headers?.["payment-required"];
        if (typeof header === "string") {
          const decoded = JSON.parse(Buffer.from(header, "base64").toString("utf-8"));
          const resourceObj = decoded.resource ?? {};
          const resourceUrl = typeof resourceObj === "string" ? resourceObj : resourceObj.url;
          const description = resourceObj.description ?? "";
          const mimeType = resourceObj.mimeType ?? "application/json";
          const NET: Record<string,string> = { "eip155:84532": "base-sepolia" };
          const flatAccepts = (decoded.accepts ?? []).map((a: any) => ({
            resource: resourceUrl,
            description,
            mimeType,
            ...a,
            network: NET[a.network] ?? a.network,
            maxAmountRequired: a.maxAmountRequired ?? a.amount,
          }));
          error.response.data = {
            x402Version: decoded.x402Version ?? 2,
            accepts: flatAccepts,
            error: decoded.error,
          };
          console.log(">> translated 402 payload:", JSON.stringify(error.response.data, null, 2));
        }
      }
      return Promise.reject(error);
    },
  );

  withPaymentInterceptor(client, wallet as any);

  client.interceptors.request.use((cfg) => {
    const payHeader = cfg.headers["X-PAYMENT"] || (cfg.headers as any)["x-payment"];
    if (payHeader) {
      console.log(">> sending X-PAYMENT header (len):", String(payHeader).length);
      try {
        const decoded = JSON.parse(Buffer.from(String(payHeader), "base64").toString("utf-8"));
        console.log(">> decoded X-PAYMENT:", JSON.stringify(decoded, null, 2));
      } catch (e) {
        console.log(">> could not decode X-PAYMENT header", e);
      }
    }
    return cfg;
  });

  try {
    const r = await client.post("/v1/orders", ORDER);
    console.log("✓ 200", r.status);
    console.log(JSON.stringify(r.data, null, 2));
  } catch (err: any) {
    console.log("✗ final error", err.message);
    if (err.response) {
      console.log("   status:", err.response.status);
      console.log("   headers:", Object.keys(err.response.headers));
      console.log("   body:", JSON.stringify(err.response.data, null, 2));
      const pr = err.response.headers?.["payment-required"];
      if (pr) {
        console.log("   decoded payment-required on retry:", JSON.parse(Buffer.from(String(pr), "base64").toString("utf-8")));
      }
    }
  }
}

main().catch(console.error);
