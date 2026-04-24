import { chatJson } from "../clients/llm";
import { buildSubstackEdition } from "../clients/substack";
import type {
  AgentConfig,
  AnswerBlock,
  BlogPost,
  CompanyProfile,
  GeneratedContent,
  InfluencerOutreach,
  PodcastScript,
} from "../types";

/**
 * Generates the full content bundle in parallel:
 *   - blog post (AEO-structured markdown)
 *   - podcast script (2 hosts, 6-8 segments)
 *   - influencer outreach DMs (3 platforms)
 *
 * The FAQ is just the answer blocks from the knowledge step so we don't
 * pay for a redundant LLM call.
 */
export async function generateContent(
  profile: CompanyProfile,
  answerBlocks: AnswerBlock[],
  config: AgentConfig
): Promise<GeneratedContent> {
  const context = JSON.stringify({ profile, answerBlocks }).slice(0, 8000);

  const [blog, podcast, outreach] = await Promise.all([
    generateBlog(context, config),
    generatePodcast(context, config),
    generateOutreach(context, config),
  ]);

  const baseContent = { faq: answerBlocks, blog, podcast, outreach };
  const substack = buildSubstackEdition({
    company: profile.name,
    profile,
    answerBlocks,
    sources: [],
    content: {
      ...baseContent,
      substack: {
        title: blog.title,
        subtitle: profile.summary,
        slug: blog.slug,
        body_markdown: "",
        tags: [],
      },
    },
  });

  return { ...baseContent, substack };
}

async function generateBlog(
  context: string,
  config: AgentConfig
): Promise<BlogPost> {
  return chatJson<BlogPost>(
    [
      {
        role: "system",
        content:
          "You write AEO-optimized blog posts. Use clear H2/H3 structure, a TL;DR at the top, and a short FAQ at the bottom. JSON only.",
      },
      {
        role: "user",
        content: [
          `Context:`,
          context,
          ``,
          `Return JSON matching exactly: {title, slug, excerpt, body_markdown}.`,
          `- body_markdown must include: a TL;DR, 3 H2 sections with relevant H3 subsections, a "Why this matters" section, and a 3-question FAQ.`,
          `- Length: 600-900 words.`,
          `- No hype language, no emojis, no clickbait.`,
        ].join("\n"),
      },
    ],
    config,
    { maxTokens: 1800 }
  );
}

async function generatePodcast(
  context: string,
  config: AgentConfig
): Promise<PodcastScript> {
  return chatJson<PodcastScript>(
    [
      {
        role: "system",
        content:
          "You write punchy, conversational podcast scripts with two hosts (Host A, Host B). JSON only.",
      },
      {
        role: "user",
        content: [
          `Context:`,
          context,
          ``,
          `Return JSON matching exactly: {title, intro, segments:[{speaker, text}], outro}. Include 6-8 alternating segments between Host A and Host B. Total 400-700 words.`,
        ].join("\n"),
      },
    ],
    config,
    { maxTokens: 1400 }
  );
}

async function generateOutreach(
  context: string,
  config: AgentConfig
): Promise<InfluencerOutreach[]> {
  const result = await chatJson<{ outreach: InfluencerOutreach[] }>(
    [
      {
        role: "system",
        content:
          "You write warm, specific influencer outreach messages. No emojis, no superlatives, no corporate fluff. JSON only.",
      },
      {
        role: "user",
        content: [
          `Context:`,
          context,
          ``,
          `Return JSON: {"outreach": [3 items of {influencer_persona, platform, subject, message}]}. Targets: one YouTube explainer creator, one LinkedIn operator/exec, one X/Twitter developer-influencer. Each message 90-140 words, references a specific concrete use case, ends with a clear low-friction ask.`,
        ].join("\n"),
      },
    ],
    config,
    { maxTokens: 1200 }
  );
  return result.outreach || [];
}
