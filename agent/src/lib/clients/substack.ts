import type {
  AgentConfig,
  AnalysisJob,
  PublishResult,
  SubstackEdition,
} from "../types";

interface TinyFishRunResponse {
  run_id: string | null;
  status: "COMPLETED" | "FAILED";
  result: {
    published: boolean;
    post_url?: string;
    status?: string;
    title?: string;
    note?: string;
  } | null;
  error?: { message?: string } | null;
}

export function buildSubstackEdition(job: Pick<
  AnalysisJob,
  "company" | "sources" | "profile" | "answerBlocks" | "content"
>): SubstackEdition {
  if (!job.profile || !job.content) {
    throw new Error("Substack edition requires profile and generated content.");
  }

  return {
    title: job.content.blog.title,
    subtitle: job.profile.summary,
    slug: job.content.blog.slug,
    tags: unique([
      job.profile.category,
      "AEO",
      "Answer Engine Optimization",
      job.company,
    ]),
    body_markdown: [
      job.content.blog.excerpt,
      "",
      "## What You’ll Get In This Issue",
      "- A concise company snapshot",
      "- Citation-ready AEO answers",
      "- A longform brief",
      "- A podcast companion transcript",
      "- Reusable outreach copy",
      "",
      "## Company Snapshot",
      `**Company:** ${job.profile.name}`,
      `**Category:** ${job.profile.category}`,
      `**Audience:** ${job.profile.audience}`,
      "",
      `**Problem:** ${job.profile.problem}`,
      "",
      `**Solution:** ${job.profile.solution}`,
      "",
      `**Capabilities:** ${job.profile.capabilities.join(", ")}`,
      "",
      `**Differentiators:** ${job.profile.differentiators.join(", ")}`,
      "",
      "## AEO Answer Blocks",
      ...job.answerBlocks.flatMap((block) => [
        `### ${block.question}`,
        block.answer,
        block.sources.length
          ? `Sources: ${block.sources
              .map((source) => `[${trimUrl(source)}](${source})`)
              .join(", ")}`
          : "",
        "",
      ]),
      "## Longform Brief",
      stripLeadingTitle(job.content.blog.body_markdown, job.content.blog.title),
      "",
      "## Podcast Companion",
      `**Episode:** ${job.content.podcast.title}`,
      "",
      job.content.podcast.intro,
      "",
      ...job.content.podcast.segments.flatMap((segment) => [
        `### ${segment.speaker}`,
        segment.text,
        "",
      ]),
      "### Closing",
      job.content.podcast.outro,
      "",
      "## Outreach Swipe File",
      ...job.content.outreach.flatMap((item) => [
        `### ${item.influencer_persona} (${item.platform})`,
        `**Subject:** ${item.subject}`,
        "",
        item.message,
        "",
      ]),
      "## Source List",
      ...job.sources.map(
        (source) => `- [${source.title || trimUrl(source.url)}](${source.url})`
      ),
    ]
      .filter(Boolean)
      .join("\n"),
  };
}

export async function publishToSubstack(
  edition: SubstackEdition,
  config: AgentConfig
): Promise<PublishResult> {
  if (!config.substackPublicationUrl) {
    return {
      published: false,
      note: "Substack publication URL not configured. Edition generated only.",
      status: "not_configured",
    };
  }

  if (!config.tinyfishApiKey) {
    return {
      published: false,
      note: "TinyFish API key missing. Substack edition generated only.",
      status: "missing_tinyfish",
    };
  }

  if (!config.substackEmail || !config.substackPassword) {
    return {
      published: false,
      note:
        "Substack email/password missing. Save them in Settings to automate publishing via TinyFish.",
      status: "missing_credentials",
    };
  }

  const base =
    config.tinyfishAgentEndpoint ||
    "https://agent.tinyfish.ai/v1/automation";

  const goal = [
    `Open the Substack publication dashboard for ${config.substackPublicationUrl}.`,
    `If authentication is required, sign in with email "${config.substackEmail}" and password "${config.substackPassword}".`,
    "Create a new text post.",
    `Set the title to "${edition.title}".`,
    `Use this subtitle near the top of the post: "${edition.subtitle}".`,
    "Paste the following markdown into the editor body exactly as the draft content:",
    "",
    edition.body_markdown,
    "",
    "Open the publish flow.",
    config.substackPublishMode === "publish"
      ? [
          `Set the audience to ${audienceLabel(config.substackAudience)}.`,
          config.substackSendEmail
            ? "Keep email and Substack app inbox delivery enabled."
            : "Disable email and Substack app inbox delivery so the post only appears on the web.",
          "Publish the post.",
        ].join(" ")
      : "Do not publish. Save the post as a draft only.",
    "Return JSON with exactly: {published, post_url, status, title, note}.",
  ].join("\n");

  const res = await fetch(`${base.replace(/\/$/, "")}/run`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-API-Key": config.tinyfishApiKey,
    },
    body: JSON.stringify({
      url: config.substackPublicationUrl,
      goal,
      browser_profile: "stealth",
      output_schema: {
        type: "object",
        properties: {
          published: { type: "boolean" },
          post_url: { type: "string" },
          status: { type: "string" },
          title: { type: "string" },
          note: { type: "string" },
        },
        required: ["published", "status", "note"],
      },
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    return {
      published: false,
      note: `TinyFish Agent ${res.status}: ${text.slice(0, 220)}`,
      status: "failed",
    };
  }

  const data = (await res.json()) as TinyFishRunResponse;
  if (data.status !== "COMPLETED" || !data.result) {
    return {
      published: false,
      note:
        data.error?.message ||
        "TinyFish automation failed before returning a Substack result.",
      status: "failed",
      runId: data.run_id || undefined,
    };
  }

  return {
    published: data.result.published,
    url: data.result.post_url,
    note: data.result.note,
    status: data.result.status,
    runId: data.run_id || undefined,
  };
}

function audienceLabel(audience: AgentConfig["substackAudience"]): string {
  if (audience === "free") return "free subscribers only";
  if (audience === "paid") return "paid subscribers only";
  if (audience === "founding") return "founding members only";
  return "everyone";
}

function stripLeadingTitle(markdown: string, title: string): string {
  const lines = markdown.split("\n");
  if (lines[0]?.trim() === `# ${title}`) {
    return lines.slice(1).join("\n").trim();
  }
  return markdown.trim();
}

function trimUrl(value: string): string {
  try {
    const url = new URL(value);
    return `${url.hostname}${url.pathname === "/" ? "" : url.pathname}`;
  } catch {
    return value;
  }
}

function unique(values: string[]): string[] {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
}
