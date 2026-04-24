import crypto from "crypto";
import { jobStore } from "../store";
import { classifyUrl } from "./classifier";
import { fetchPage } from "./fetcher";
import { extract } from "./extractor";
import { clean } from "./cleaner";
import { structure } from "./structurer";
import { synthesizeKnowledge } from "./knowledge";
import { generateContent } from "./generator";
import { publishToGhost } from "../clients/ghost";
import { buildSubstackEdition, publishToSubstack } from "../clients/substack";
import type {
  AgentConfig,
  AnalysisJob,
  JobStep,
  StructuredSource,
} from "../types";

export interface RunInput {
  company: string;
  urls: string[];
  config: AgentConfig;
  publishGhost?: boolean;
  publishSubstack?: boolean;
}

/**
 * End-to-end agent pipeline:
 *   URL → classify → TinyFish fetch → extract → clean →
 *   structure (LLM) → knowledge (LLM) → generate (LLM) → [Ghost publish]
 */
export async function runPipeline(input: RunInput): Promise<AnalysisJob> {
  const id = crypto.randomUUID();
  const job: AnalysisJob = {
    id,
    createdAt: new Date().toISOString(),
    status: "running",
    company: input.company,
    urls: input.urls,
    steps: [],
    sources: [],
    answerBlocks: [],
  };
  jobStore.create(job);

  try {
    // 1. Classify
    const classified = input.urls.map((url) => ({ url, source: classifyUrl(url) }));
    addStep(id, "classify", "done", describeClassification(classified));

    // 2. Fetch via TinyFish
    const rawPages = await Promise.all(
      classified.map(async ({ url }) => {
        try {
          return await fetchPage(url, input.config);
        } catch (err) {
          addStep(id, `fetch:${hostOf(url)}`, "warn", (err as Error).message);
          return null;
        }
      })
    );
    const okPages = rawPages.filter((p): p is NonNullable<typeof p> => Boolean(p));
    const via = okPages[0]?.fetchedBy === "tinyfish" ? "TinyFish" : "built-in";
    addStep(id, "fetch", "done", `Fetched ${okPages.length}/${rawPages.length} via ${via}`);

    // 3 + 4. Extract + clean
    const extracted = rawPages
      .map((r, i) => (r ? clean(extract(r, classified[i].source)) : null))
      .filter((x): x is NonNullable<typeof x> => Boolean(x));
    addStep(
      id,
      "extract+clean",
      "done",
      `Extracted ${extracted.length} pages, ${extracted.reduce((n, e) => n + e.paragraphs.length, 0)} paragraphs`
    );

    // 5. Structure via LLM
    const structured: StructuredSource[] = [];
    for (const e of extracted) {
      try {
        structured.push(await structure(e, input.config));
      } catch (err) {
        addStep(id, `structure:${hostOf(e.url)}`, "warn", (err as Error).message);
      }
    }
    jobStore.update(id, { sources: structured });
    addStep(id, "structure", "done", `Structured ${structured.length} sources`);

    if (structured.length === 0) {
      throw new Error("No sources could be structured. Check TinyFish/network access or URLs.");
    }

    // 6. Knowledge synthesis
    const { profile, answerBlocks } = await synthesizeKnowledge(
      input.company,
      structured,
      input.config
    );
    jobStore.update(id, { profile, answerBlocks });
    addStep(id, "knowledge", "done", `Profile + ${answerBlocks.length} answer blocks`);

    // 7. Content generation (parallel)
    let content = await generateContent(profile, answerBlocks, input.config);
    content = {
      ...content,
      substack: buildSubstackEdition({
        company: input.company,
        profile,
        answerBlocks,
        sources: structured,
        content,
      }),
    };
    jobStore.update(id, { content });
    addStep(id, "generate", "done", `Blog, podcast, ${content.outreach.length} outreach messages`);

    // 8. Optional Ghost publishing
    if (input.publishGhost) {
      const ghost = await publishToGhost(content.blog, input.config);
      jobStore.update(id, { ghost });
      addStep(id, "ghost", ghost.published ? "done" : "skip", ghost.note || "");
    }

    // 9. Optional Substack publishing via TinyFish Agent API
    if (input.publishSubstack) {
      const substack = await publishToSubstack(content.substack, input.config);
      jobStore.update(id, { substack });
      addStep(
        id,
        "substack",
        substack.published ? "done" : "skip",
        substack.note || ""
      );
    }

    return jobStore.update(id, { status: "complete" })!;
  } catch (err) {
    const msg = (err as Error).message;
    addStep(id, "error", "error", msg);
    return jobStore.update(id, { status: "error", error: msg })!;
  }
}

function addStep(
  id: string,
  name: string,
  status: JobStep["status"],
  detail?: string
) {
  const job = jobStore.get(id);
  if (!job) return;
  jobStore.update(id, {
    steps: [
      ...job.steps,
      { name, status, detail, at: new Date().toISOString() },
    ],
  });
}

function hostOf(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

function describeClassification(
  classified: { url: string; source: string }[]
): string {
  const counts: Record<string, number> = {};
  for (const c of classified) counts[c.source] = (counts[c.source] || 0) + 1;
  return Object.entries(counts)
    .map(([k, v]) => `${v} ${k}`)
    .join(", ");
}
