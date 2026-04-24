import { jobStore } from "../../src/lib/store";
import type { AnalysisJob } from "../../src/lib/types";

export interface ResultsInput {
  id?: string;
}

export type ResultsOperation = (
  input: ResultsInput
) => Promise<AnalysisJob | AnalysisJob[] | null>;

export const results: ResultsOperation = async ({ id }) => {
  if (id) return jobStore.get(id) || null;
  return jobStore.list();
};
