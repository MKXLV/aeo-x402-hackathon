import type { AgentConfig } from "./types";

/**
 * Settings flow:
 *   1. User saves config via /settings page → localStorage
 *   2. Client attaches `x-aeo-config: <base64 json>` header to each API call
 *   3. This helper merges that header with server-side env fallbacks
 */
export function readConfigFromHeaders(headers: Headers): AgentConfig {
  const fallback = fromEnv();
  const raw = headers.get("x-aeo-config");
  if (!raw) return fallback;
  try {
    let jsonText = raw;
    if (!raw.trim().startsWith("{")) {
      jsonText = Buffer.from(raw, "base64").toString("utf-8");
    }
    const parsed = JSON.parse(jsonText) as Partial<AgentConfig>;
    return { ...fallback, ...stripEmpty(parsed) };
  } catch {
    return fallback;
  }
}

/** Client-side helper: encode the config for the x-aeo-config header. */
export function encodeConfigHeader(config: AgentConfig): string {
  const json = JSON.stringify(config);
  if (typeof window === "undefined") {
    return Buffer.from(json, "utf-8").toString("base64");
  }
  return btoa(unescape(encodeURIComponent(json)));
}

export function fromEnv(): AgentConfig {
  return {
    llmProvider: (process.env.LLM_PROVIDER as "openai" | "anthropic") || "openai",
    llmApiKey: process.env.LLM_API_KEY || "",
    llmModel: process.env.LLM_MODEL || "gpt-4o-mini",
    tinyfishApiKey: process.env.TINYFISH_API_KEY || "",
    tinyfishEndpoint:
      process.env.TINYFISH_ENDPOINT || "https://api.fetch.tinyfish.ai",
    tinyfishAgentEndpoint:
      process.env.TINYFISH_AGENT_ENDPOINT ||
      "https://agent.tinyfish.ai/v1/automation",
    wundergraphEndpoint: process.env.WUNDERGRAPH_ENDPOINT || "/api",
    ghostAdminUrl: process.env.GHOST_ADMIN_URL || "",
    ghostAdminKey: process.env.GHOST_ADMIN_KEY || "",
    substackPublicationUrl: process.env.SUBSTACK_PUBLICATION_URL || "",
    substackEmail: process.env.SUBSTACK_EMAIL || "",
    substackPassword: process.env.SUBSTACK_PASSWORD || "",
    substackPublishMode:
      (process.env.SUBSTACK_PUBLISH_MODE as "draft" | "publish") || "draft",
    substackSendEmail: process.env.SUBSTACK_SEND_EMAIL === "true",
    substackAudience:
      (process.env.SUBSTACK_AUDIENCE as
        | "everyone"
        | "free"
        | "paid"
        | "founding") || "everyone",
    databaseUrl: process.env.DATABASE_URL || "",
  };
}

function stripEmpty<T extends Record<string, unknown>>(obj: T): Partial<T> {
  const out: Partial<T> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined || v === null) continue;
    if (typeof v === "string") {
      const cleaned = sanitizeHeaderValue(v);
      if (cleaned.trim() === "") continue;
      (out as Record<string, unknown>)[k] = cleaned;
    } else {
      (out as Record<string, unknown>)[k] = v;
    }
  }
  return out;
}

/**
 * Strips non-ASCII characters that HTTP headers can't carry. Copy-paste of
 * API keys inserts U+2028 / U+00A0 / zero-width chars which crash fetch()
 * with "Cannot convert argument to a ByteString…".
 */
function sanitizeHeaderValue(s: string): string {
  return s.replace(/[^\x20-\x7E]/g, "").trim();
}
