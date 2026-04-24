/**
 * Standalone smoke test for the UGC purchase flow.
 *
 * Runs purchaseUgc() against a synthetic completed-job payload. Verifies:
 *   (1) x402 SDK + viem wiring works
 *   (2) BUYER_PRIVATE_KEY is set and signs a valid EIP-3009 auth
 *   (3) the UGC seller accepts the payment and returns 200 + order JSON
 *
 * Run with:
 *   npx tsx --env-file .env.local scripts/smoke-ugc.ts
 *
 * Expected: prints the order id, total USDC, and per-post state.
 */
import { purchaseUgc } from "../src/lib/agent/purchaseUgc";
import type { GeneratedContent } from "../src/lib/types";

const mockContent: GeneratedContent = {
  faq: [],
  blog: {
    title: "Claude for pre-launch B2B",
    slug: "claude-pre-launch-b2b",
    excerpt: "Ignored by the UGC buyer.",
    body_markdown: "Ignored by the UGC buyer.",
  },
  podcast: { title: "", intro: "", segments: [], outro: "" },
  outreach: [
    {
      platform: "reddit",
      influencer_persona: "r/SaaS moderator",
      subject: "New AEO tool for pre-launch founders",
      message:
        "Short demo post: AEO engine auto-generates the content that makes ChatGPT cite you before launch. Curious for feedback from this sub.",
    },
    {
      platform: "twitter",
      influencer_persona: "AI dev influencer",
      subject: "Thread starter",
      message:
        "Pre-launch AEO beats post-launch SEO for LLM-native brands. Change my mind.",
    },
  ],
  substack: {
    title: "",
    subtitle: "",
    slug: "",
    body_markdown: "",
    tags: [],
  },
};

(async () => {
  console.log("→ running purchaseUgc smoke test");
  console.log("  seller:", process.env.UGC_SELLER_URL ?? "(default)");
  console.log("  outreach items:", mockContent.outreach.length);

  const result = await purchaseUgc({
    company: "aeo-smoke-test",
    content: mockContent,
  });

  console.log();
  console.log("✓ order", result.id);
  console.log("  state:     ", result.state);
  console.log("  paid:      ", result.total_usdc, "USDC");
  console.log("  payer:     ", result.payer_address);
  console.log("  txNote:    ", result.txNote ?? "-");
  console.log();
  for (const p of result.posts) {
    console.log(
      `  post ${p.id.slice(0, 8)} ${p.platform.padEnd(8)} ` +
        `${p.provider.padEnd(4)} state=${p.state} pid=${p.provider_order_id ?? "-"}`,
    );
  }
})().catch((err) => {
  console.error("✗ smoke test failed:", err.message ?? err);
  process.exit(1);
});
