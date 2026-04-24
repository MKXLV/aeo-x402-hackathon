import type { AgentConfig } from "./types";

export const AEO_CONFIG_STORAGE_KEY = "aeo-agent-config";

export const DEFAULT_AGENT_CONFIG: AgentConfig = {
  llmProvider: "openai",
  llmApiKey: "",
  llmModel: "gpt-4o-mini",
  tinyfishApiKey: "",
  tinyfishEndpoint: "https://api.fetch.tinyfish.ai",
  tinyfishAgentEndpoint: "https://agent.tinyfish.ai/v1/automation",
  wundergraphEndpoint: "/api",
  ghostAdminUrl: "",
  ghostAdminKey: "",
  substackPublicationUrl: "",
  substackEmail: "",
  substackPassword: "",
  substackPublishMode: "draft",
  substackSendEmail: false,
  substackAudience: "everyone",
  databaseUrl: "",
};

export const DEFAULT_DEMO_URLS = [
  "https://ghost.org",
  "https://ghost.org/docs/",
  "https://ghost.org/pricing/",
];

export function loadAgentConfig(): AgentConfig {
  if (typeof window === "undefined") {
    return DEFAULT_AGENT_CONFIG;
  }

  const raw = window.localStorage.getItem(AEO_CONFIG_STORAGE_KEY);
  if (!raw) return DEFAULT_AGENT_CONFIG;

  try {
    return { ...DEFAULT_AGENT_CONFIG, ...(JSON.parse(raw) as Partial<AgentConfig>) };
  } catch {
    return DEFAULT_AGENT_CONFIG;
  }
}

export function resolveApiUrl(base: string | undefined, path: string): string {
  const normalizedBase = normalizeBase(base);
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;

  if (/^https?:\/\//i.test(normalizedBase)) {
    return `${normalizedBase}${normalizedPath}`;
  }

  return `${normalizedBase}${normalizedPath}`;
}

export function formatApiBase(base: string | undefined): string {
  return normalizeBase(base);
}

function normalizeBase(base: string | undefined): string {
  const value = (base || DEFAULT_AGENT_CONFIG.wundergraphEndpoint || "/api")
    .trim()
    .replace(/\/$/, "");

  if (!value) return "/api";
  if (/^https?:\/\//i.test(value)) return value;
  if (value.startsWith("/")) return value;

  return `/${value.replace(/^\/+/, "")}`;
}
