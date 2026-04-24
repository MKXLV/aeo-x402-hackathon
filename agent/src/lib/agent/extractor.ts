import * as cheerio from "cheerio";
import type { ExtractedContent, RawPage, SourceType } from "../types";

export function extract(raw: RawPage, source: SourceType): ExtractedContent {
  const $ = cheerio.load(raw.html);

  const title =
    $("meta[property='og:title']").attr("content") ||
    $("meta[name='twitter:title']").attr("content") ||
    $("title").first().text().trim() ||
    raw.url;

  const metadata: Record<string, string> = {};
  const metaPairs: [string, string | undefined][] = [
    ["description", $("meta[name='description']").attr("content")],
    ["og:description", $("meta[property='og:description']").attr("content")],
    ["og:site_name", $("meta[property='og:site_name']").attr("content")],
    ["author", $("meta[name='author']").attr("content")],
    ["keywords", $("meta[name='keywords']").attr("content")],
  ];
  for (const [k, v] of metaPairs) if (v) metadata[k] = v.trim();

  const headings: { level: number; text: string }[] = [];
  $("h1, h2, h3").each((_, el) => {
    const tag = ((el as { name?: string }).name || "h3").toLowerCase();
    const level = Number(tag.replace("h", "")) || 3;
    const text = $(el).text().replace(/\s+/g, " ").trim();
    if (text) headings.push({ level, text });
  });

  // Strip obvious chrome before paragraph scraping
  $("script, style, noscript, nav, footer, header, aside, form, iframe").remove();

  const paragraphs: string[] = [];
  $("p, li, article, section").each((_, el) => {
    const t = $(el).text().replace(/\s+/g, " ").trim();
    if (t.length > 40 && t.length < 1200) paragraphs.push(t);
  });

  return {
    url: raw.url,
    source,
    title: title.replace(/\s+/g, " ").trim(),
    headings,
    paragraphs,
    metadata,
  };
}
