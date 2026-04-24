import { createPaymentHeader } from "x402/client";
import { createWalletClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { baseSepolia } from "viem/chains";

const PK = process.env.BUYER_PRIVATE_KEY as `0x${string}`;
const acc = privateKeyToAccount(PK);
const wallet = createWalletClient({ account: acc, chain: baseSepolia, transport: http() });

const req = {
  resource: "https://aeoengine-o51vgsfo9-negoshify.vercel.app/v1/orders",
  description: "Buy UGC — Reddit/Twitter posts delivered via SMM panels or UGC creators.",
  mimeType: "application/json",
  scheme: "exact" as const,
  network: "base-sepolia" as const,
  asset: "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
  maxAmountRequired: "1000000",
  payTo: "0xb416bd74540fe201fda0b51b4d12f855396208d2",
  maxTimeoutSeconds: 300,
  extra: { name: "USDC", version: "2" },
};

(async () => {
  try {
    const hdr = await createPaymentHeader(wallet as any, 2, req as any);
    console.log("OK, header length:", hdr.length);
    const decoded = JSON.parse(Buffer.from(hdr, "base64").toString("utf-8"));
    console.log("decoded payload:", JSON.stringify(decoded, null, 2));
  } catch (e: any) {
    console.error("SIGN FAILED:", e.message);
    console.error(e);
  }
})();
