import type { SourceType } from "../types";

/**
 * Lightweight heuristic classifier. Good enough for the first pass — we pass
 * the inferred type into the structurer so the LLM can adjust tone/shape.
 */
export function classifyUrl(url: string): SourceType {
  try {
    const u = new URL(url);
    const host = u.hostname.toLowerCase();
    const path = u.pathname.toLowerCase();

    if (host.includes("github.com") || host.includes("gitlab.com")) return "github";

    if (
      host.includes("youtube.com") ||
      host.includes("youtu.be") ||
      host.includes("vimeo.com") ||
      host.includes("loom.com")
    )
      return "video";

    if (
      host.includes("linkedin.com") ||
      host.includes("twitter.com") ||
      host.includes("x.com") ||
      host.includes("crunchbase.com") ||
      host.includes("producthunt.com")
    )
      return "profile";

    if (
      host.startsWith("docs.") ||
      path.startsWith("/docs") ||
      path.includes("/documentation") ||
      path.includes("/reference") ||
      path.includes("/guide") ||
      path.includes("/manual")
    )
      return "docs";

    if (
      host.startsWith("blog.") ||
      path.startsWith("/blog") ||
      path.includes("/posts") ||
      path.includes("/articles") ||
      host.includes("medium.com") ||
      host.includes("substack.com") ||
      host.includes("dev.to") ||
      host.includes("hashnode.dev")
    )
      return "blog";

    return "other";
  } catch {
    return "other";
  }
}
