/**
 * WunderGraph-style orchestration config.
 *
 * For the hackathon demo the app uses Next.js API routes as thin transport,
 * but each route delegates to a typed operation under /wundergraph/operations.
 * The operations follow the exact shape WunderGraph Cloud expects so you can
 * lift them into a real `.wundergraph/operations` directory with no code
 * changes:
 *
 *   import { createOperation, z } from '@wundergraph/sdk/operations';
 *   export default createOperation.mutation({ input: z.object({...}), handler: analyze });
 *
 * The orchestration layer lets us fan out to multiple upstreams (TinyFish for
 * browsing, the LLM for reasoning, Ghost for publishing) from a single API.
 */
import type { AnalyzeOperation } from "./operations/analyze";
import type { GenerateOperation } from "./operations/generate";
import type { ResultsOperation } from "./operations/results";

export interface WunderGraphOperations {
  analyze: AnalyzeOperation;
  generate: GenerateOperation;
  results: ResultsOperation;
}

export const wundergraphConfig = {
  api: {
    namespace: "aeo",
    operations: ["analyze", "generate", "results"] as const,
  },
  dataSources: {
    tinyfish: {
      kind: "rest" as const,
      description: "Browser automation + dynamic page fetch",
    },
    llm: {
      kind: "rest" as const,
      description: "OpenAI or Anthropic (chosen per-request from Settings)",
    },
    ghost: {
      kind: "rest" as const,
      description: "Ghost Admin API for publishing blog drafts",
    },
  },
};
