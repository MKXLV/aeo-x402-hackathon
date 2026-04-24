import type { AgentConfig } from "../types";

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface ChatOptions {
  json?: boolean;
  maxTokens?: number;
  temperature?: number;
}

/**
 * Provider-agnostic chat completion. Supports OpenAI and Anthropic.
 * Uses the official REST API directly to avoid SDK bloat.
 */
export async function chat(
  messages: ChatMessage[],
  config: AgentConfig,
  opts: ChatOptions = {}
): Promise<string> {
  if (!config.llmApiKey) {
    throw new Error("LLM API key is missing. Open Settings and paste one.");
  }
  if (config.llmProvider === "anthropic") {
    return callAnthropic(messages, config, opts);
  }
  return callOpenAI(messages, config, opts);
}

export async function chatJson<T>(
  messages: ChatMessage[],
  config: AgentConfig,
  opts: ChatOptions = {}
): Promise<T> {
  const content = await chat(messages, config, { ...opts, json: true });
  return extractJson<T>(content);
}

async function callOpenAI(
  messages: ChatMessage[],
  config: AgentConfig,
  opts: ChatOptions
): Promise<string> {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.llmApiKey}`,
    },
    body: JSON.stringify({
      model: config.llmModel || "gpt-4o-mini",
      messages,
      temperature: opts.temperature ?? 0.4,
      max_tokens: opts.maxTokens ?? 1400,
      ...(opts.json ? { response_format: { type: "json_object" } } : {}),
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`OpenAI ${res.status}: ${text.slice(0, 300)}`);
  }
  const data = (await res.json()) as {
    choices: { message: { content: string } }[];
  };
  return data.choices[0].message.content;
}

async function callAnthropic(
  messages: ChatMessage[],
  config: AgentConfig,
  opts: ChatOptions
): Promise<string> {
  const system = messages
    .filter((m) => m.role === "system")
    .map((m) => m.content)
    .join("\n\n");
  const turns = messages
    .filter((m) => m.role !== "system")
    .map((m) => ({ role: m.role, content: m.content }));

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": config.llmApiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: config.llmModel || "claude-sonnet-4-5",
      system: system || undefined,
      max_tokens: opts.maxTokens ?? 1400,
      temperature: opts.temperature ?? 0.4,
      messages: turns,
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Anthropic ${res.status}: ${text.slice(0, 300)}`);
  }
  const data = (await res.json()) as { content: { text: string }[] };
  return data.content.map((c) => c.text).join("");
}

/**
 * Tolerant JSON extraction — LLMs sometimes wrap output in prose or code fences.
 */
export function extractJson<T>(content: string): T {
  const cleaned = content
    .replace(/```json\s*/gi, "")
    .replace(/```\s*/g, "")
    .trim();
  try {
    return JSON.parse(cleaned) as T;
  } catch {
    const braces = cleaned.indexOf("{");
    const brackets = cleaned.indexOf("[");
    const candidates = [braces, brackets].filter((i) => i >= 0);
    if (candidates.length === 0) {
      throw new Error("No JSON object/array found in LLM output");
    }
    const first = Math.min(...candidates);
    const last = Math.max(cleaned.lastIndexOf("}"), cleaned.lastIndexOf("]"));
    if (last <= first) throw new Error("Malformed JSON in LLM output");
    return JSON.parse(cleaned.slice(first, last + 1)) as T;
  }
}
