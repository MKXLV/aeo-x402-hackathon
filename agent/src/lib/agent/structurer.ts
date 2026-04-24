import { chatJson } from "../clients/llm";
import type { AgentConfig, ExtractedContent, StructuredSource } from "../types";

interface StructurerOutput {
  summary: string;
  sections: { heading: string; body: string }[];
  entities: string[];
  claims: string[];
}

/**
 * Turns extracted, cleaned content into a structured JSON representation
 * the rest of the pipeline can reason over.
 */
export async function structure(
  content: ExtractedContent,
  config: AgentConfig
): Promise<StructuredSource> {
  const body = content.paragraphs.slice(0, 40).join("\n\n").slice(0, 8000);

  if (!body) {
    return {
      source: content.source,
      url: content.url,
      title: content.title,
      content: "",
      sections: content.headings.map((h) => ({ heading: h.text, body: "" })),
      entities: [],
      claims: [],
    };
  }

  const result = await chatJson<StructurerOutput>(
    [
      {
        role: "system",
        content:
          "You are a research agent that extracts structured facts from web pages. Respond only with a JSON object that matches the requested schema.",
      },
      {
        role: "user",
        content: [
          `URL: ${content.url}`,
          `Title: ${content.title}`,
          `Source type: ${content.source}`,
          `Description: ${content.metadata.description || content.metadata["og:description"] || "(none)"}`,
          ``,
          `Content:`,
          body,
          ``,
          `Return JSON with exactly these keys:`,
          `- "summary": 2-3 sentence factual summary (no marketing adjectives)`,
          `- "sections": array of up to 5 {heading, body} objects capturing the main ideas`,
          `- "entities": up to 8 named entities (people, products, technologies, companies)`,
          `- "claims": up to 6 short factual claims made on this page`,
        ].join("\n"),
      },
    ],
    config,
    { maxTokens: 900 }
  );

  return {
    source: content.source,
    url: content.url,
    title: content.title,
    content: result.summary || "",
    sections: result.sections || [],
    entities: result.entities || [],
    claims: result.claims || [],
  };
}
