import type { ExtractedContent } from "../types";

const NOISE_PATTERNS: RegExp[] = [
  /cookie/i,
  /accept all/i,
  /subscribe to our newsletter/i,
  /all rights reserved/i,
  /privacy policy/i,
  /terms of (service|use)/i,
  /sign up for/i,
  /back to top/i,
  /^\s*menu\s*$/i,
];

export function clean(content: ExtractedContent): ExtractedContent {
  const seen = new Set<string>();
  const paragraphs: string[] = [];
  for (const p of content.paragraphs) {
    if (NOISE_PATTERNS.some((re) => re.test(p))) continue;
    // Dedupe on a prefix so near-duplicates (common on marketing pages) collapse
    const key = p.slice(0, 80).toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    paragraphs.push(p);
  }
  const headings = content.headings.filter(
    (h) => h.text.length > 2 && h.text.length < 160
  );
  return { ...content, paragraphs, headings };
}
