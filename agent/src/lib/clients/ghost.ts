import crypto from "crypto";
import type { AgentConfig, BlogPost } from "../types";

export interface GhostResult {
  published: boolean;
  url?: string;
  note?: string;
}

/**
 * Publishes the generated blog post to Ghost as a draft using the Admin API.
 * If Ghost is not configured, returns a clean skip result.
 */
export async function publishToGhost(
  post: BlogPost,
  config: AgentConfig
): Promise<GhostResult> {
  if (!config.ghostAdminUrl || !config.ghostAdminKey) {
    return { published: false, note: "Ghost not configured." };
  }
  try {
    const token = makeGhostToken(config.ghostAdminKey);
    const base = config.ghostAdminUrl.replace(/\/$/, "");
    const res = await fetch(`${base}/ghost/api/admin/posts/?source=html`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Ghost ${token}`,
      },
      body: JSON.stringify({
        posts: [
          {
            title: post.title,
            slug: post.slug,
            html: markdownToHtml(post.body_markdown),
            excerpt: post.excerpt,
            status: "draft",
          },
        ],
      }),
    });
    if (!res.ok) {
      const text = await res.text();
      return {
        published: false,
        note: `Ghost ${res.status}: ${text.slice(0, 160)}`,
      };
    }
    const data = (await res.json()) as { posts?: { url?: string }[] };
    return {
      published: true,
      url: data.posts?.[0]?.url,
      note: "Draft created in Ghost",
    };
  } catch (err) {
    return { published: false, note: `Ghost error: ${(err as Error).message}` };
  }
}

function makeGhostToken(key: string): string {
  const [id, secret] = key.split(":");
  if (!id || !secret) {
    throw new Error("Ghost Admin key must be in id:secret form.");
  }
  const header = { alg: "HS256", typ: "JWT", kid: id };
  const iat = Math.floor(Date.now() / 1000);
  const payload = { iat, exp: iat + 5 * 60, aud: "/admin/" };
  const b64 = (buf: Buffer) => buf.toString("base64url");
  const unsigned = `${b64(Buffer.from(JSON.stringify(header)))}.${b64(
    Buffer.from(JSON.stringify(payload))
  )}`;
  const signature = crypto
    .createHmac("sha256", Buffer.from(secret, "hex"))
    .update(unsigned)
    .digest();
  return `${unsigned}.${b64(signature)}`;
}

/** Tiny, dependency-free Markdown → HTML for Ghost draft bodies. */
function markdownToHtml(md: string): string {
  const lines = md.split("\n");
  let html = "";
  let inList = false;
  const closeList = () => {
    if (inList) {
      html += "</ul>";
      inList = false;
    }
  };
  for (const line of lines) {
    const h = /^(#{1,6})\s+(.*)$/.exec(line);
    if (h) {
      closeList();
      html += `<h${h[1].length}>${inline(h[2])}</h${h[1].length}>`;
      continue;
    }
    const li = /^[-*]\s+(.*)$/.exec(line);
    if (li) {
      if (!inList) {
        html += "<ul>";
        inList = true;
      }
      html += `<li>${inline(li[1])}</li>`;
      continue;
    }
    if (!line.trim()) {
      closeList();
      continue;
    }
    closeList();
    html += `<p>${inline(line)}</p>`;
  }
  closeList();
  return html;
}

function inline(s: string): string {
  return s
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2">$1</a>');
}
