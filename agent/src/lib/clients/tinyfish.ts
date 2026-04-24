import type { AgentConfig, RawPage } from "../types";

export interface FetchOptions {
  renderJs?: boolean;
  waitMs?: number;
}

/**
 * TinyFish is the primary browsing/scraping channel for the agent. When a
 * TinyFish key is configured we hit their dynamic-rendering endpoint. If the
 * call fails (or no key is configured), we degrade gracefully to a plain
 * fetch so the demo still works offline.
 */
export async function fetchWithTinyFish(
  url: string,
  config: AgentConfig,
  opts: FetchOptions = {}
): Promise<RawPage> {
  if (!config.tinyfishApiKey) {
    return fetchWithBuiltInBrowser(url);
  }

  const endpoint =
    (config.tinyfishEndpoint || "https://api.fetch.tinyfish.ai").replace(
      /\/$/,
      ""
    );

  try {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": config.tinyfishApiKey,
      },
      body: JSON.stringify({
        urls: [url],
        format: "html",
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`TinyFish ${res.status}: ${text.slice(0, 200)}`);
    }

    const data = (await res.json()) as Record<string, any>;

    if (data.errors?.length) {
      throw new Error(
        `TinyFish fetch failed: ${data.errors
          .map((entry: any) => `${entry.url || url} ${entry.error || "unknown error"}`)
          .join("; ")}`
      );
    }

    // TinyFish response shape varies by plan/endpoint. Probe every plausible
    // field we've seen in the wild before giving up.
    const page: Record<string, any> =
      data.results?.[0] ??
      data.result ??
      (Array.isArray(data.pages) ? data.pages[0] : undefined) ??
      data;
    const html =
      page?.html ||
      page?.text ||
      page?.content ||
      page?.body ||
      page?.data ||
      page?.rendered_html ||
      "";

    if (!html) {
      console.warn(
        `[TinyFish] ${url} returned no html-like field. Top-level keys: ${Object.keys(
          data,
        ).join(", ")}. Page keys: ${Object.keys(page ?? {}).join(", ")}`,
      );
      throw new Error("TinyFish response contained no html/text/content field");
    }

    return {
      url: page?.final_url || page?.url || url,
      html,
      status: res.status,
      fetchedBy: "tinyfish",
      fetchedAt: new Date().toISOString(),
    };
  } catch (err) {
    console.warn(
      `[TinyFish] ${url} failed, falling back: ${(err as Error).message}`
    );
    return fetchWithBuiltInBrowser(url);
  }
}

async function fetchWithBuiltInBrowser(url: string): Promise<RawPage> {
  const res = await fetch(url, {
    redirect: "follow",
    headers: {
      "User-Agent":
        "Mozilla/5.0 (AEO-Agent/1.0 +https://github.com/aeo-agent) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122 Safari/537.36",
      Accept:
        "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,*/*;q=0.8",
    },
  });
  const html = await res.text();
  return {
    url,
    html,
    status: res.status,
    fetchedBy: "fetch",
    fetchedAt: new Date().toISOString(),
  };
}
