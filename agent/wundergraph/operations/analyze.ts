import { runPipeline } from "../../src/lib/agent/pipeline";
import type { AgentConfig, AnalysisJob } from "../../src/lib/types";

export interface AnalyzeInput {
  company: string;
  urls: string[];
  config: AgentConfig;
  publishGhost?: boolean;
  publishSubstack?: boolean;
}

export type AnalyzeOperation = (input: AnalyzeInput) => Promise<AnalysisJob>;

export const analyze: AnalyzeOperation = async (input) => {
  if (!input.company?.trim()) throw new Error("company is required");
  if (!Array.isArray(input.urls) || input.urls.length === 0) {
    throw new Error("at least one URL is required");
  }
  return runPipeline(input);
};
