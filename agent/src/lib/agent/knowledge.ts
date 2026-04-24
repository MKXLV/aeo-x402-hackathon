import { chatJson } from "../clients/llm";
import type {
  AgentConfig,
  AnswerBlock,
  CompanyProfile,
  StructuredSource,
} from "../types";

interface KnowledgeOutput {
  profile: CompanyProfile;
  answer_blocks: AnswerBlock[];
}

/**
 * Cross-source synthesis step: merges the structured per-source outputs into a
 * single company profile plus a set of AEO answer blocks optimized for
 * citation by LLM-based answer engines.
 */
export async function synthesizeKnowledge(
  company: string,
  sources: StructuredSource[],
  config: AgentConfig
): Promise<{ profile: CompanyProfile; answerBlocks: AnswerBlock[] }> {
  const digest = sources
    .map(
      (s, i) =>
        `[S${i + 1}] ${s.source.toUpperCase()} — ${s.title}
URL: ${s.url}
Summary: ${s.content}
Claims: ${s.claims.slice(0, 5).join(" | ")}
Entities: ${s.entities.slice(0, 6).join(", ")}`
    )
    .join("\n\n")
    .slice(0, 9000);

  const result = await chatJson<KnowledgeOutput>(
    [
      {
        role: "system",
        content:
          "You are an AEO (Answer Engine Optimization) strategist. Write concise, factual, citation-ready answers suitable for LLM answer engines. No hype, no filler, no superlatives. JSON only.",
      },
      {
        role: "user",
        content: [
          `Company: ${company}`,
          ``,
          `Source digest:`,
          digest,
          ``,
          `Return JSON with exactly these keys:`,
          `- "profile": {name, category, problem, solution, capabilities[], differentiators[], audience, summary}`,
          `- "answer_blocks": array of 6 items, each {question, answer, sources[]}. Sources must be URLs drawn from the digest.`,
          ``,
          `Choose the 6 questions that most commonly get asked to LLMs about a company in this category (what it is, how it works, pricing, integrations, alternatives, security/compliance, typical use cases). Answers must be 2-4 sentences, self-contained, directly answer the question, and cite the relevant source URL(s).`,
        ].join("\n"),
      },
    ],
    config,
    { maxTokens: 1800 }
  );

  return {
    profile: result.profile,
    answerBlocks: result.answer_blocks || [],
  };
}
