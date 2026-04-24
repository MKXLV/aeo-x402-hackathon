import type { AnalysisJob } from "./types";

/**
 * In-memory job store.
 *
 * For a hackathon demo we keep state in module scope. Swap this for Postgres
 * (pgvector-ready) or Supabase when DATABASE_URL is configured — the interface
 * below is the only contract the rest of the app uses.
 */
const store = new Map<string, AnalysisJob>();

export const jobStore = {
  create(job: AnalysisJob): AnalysisJob {
    store.set(job.id, job);
    return job;
  },
  get(id: string): AnalysisJob | undefined {
    return store.get(id);
  },
  update(id: string, patch: Partial<AnalysisJob>): AnalysisJob | undefined {
    const existing = store.get(id);
    if (!existing) return undefined;
    const next = { ...existing, ...patch };
    store.set(id, next);
    return next;
  },
  list(): AnalysisJob[] {
    return Array.from(store.values()).sort((a, b) =>
      a.createdAt < b.createdAt ? 1 : -1
    );
  },
};
