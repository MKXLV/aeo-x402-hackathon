import { fetchWithTinyFish } from "../clients/tinyfish";
import type { AgentConfig, RawPage } from "../types";

/**
 * Thin wrapper so the pipeline depends on an `agent/fetcher` abstraction
 * rather than a specific provider — makes it trivial to swap fetchers.
 */
export async function fetchPage(
  url: string,
  config: AgentConfig
): Promise<RawPage> {
  return fetchWithTinyFish(url, config, { renderJs: true });
}
