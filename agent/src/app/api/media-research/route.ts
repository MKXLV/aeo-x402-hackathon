import { NextResponse } from "next/server";
import { spawn, type ChildProcess } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdtemp, readFile, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

export const runtime = "nodejs";
export const maxDuration = 180;

const DEFAULT_BIN =
  "/Users/mustafa/Documents/aeo_engine/.venv/bin/media-researcher";

interface Body {
  topic?: string;
  target_type?: "podcasts" | "journalists" | "publications" | "mixed";
  num_results?: number;
  depth?: "light" | "medium" | "deep";
  extra_notes?: string;
  recency_days?: number;
  geo_filter?: string;
}

/**
 * POST /api/media-research
 *   body: { topic, target_type?, num_results?, depth?, extra_notes? }
 *
 * Spawns the `media-researcher` Python CLI with a synthesized YAML brief,
 * reads the JSON report back, and returns it. Degrades gracefully when no
 * discovery keys are set — returns empty targets + a `limitations` list
 * explaining which keys are missing.
 */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as Body;
  if (!body.topic || !body.topic.trim()) {
    return NextResponse.json({ error: "topic is required" }, { status: 400 });
  }

  const target_type = body.target_type ?? "mixed";
  const num_results = clamp(body.num_results ?? 10, 1, 50);
  const depth = body.depth ?? "medium";
  const recency_days = body.recency_days ?? 90;
  const geo_filter = body.geo_filter ?? "";
  const extra_notes = (body.extra_notes ?? "").slice(0, 1500);

  const brief = [
    `target_type: ${target_type}`,
    `topic: ${yamlStr(body.topic.trim())}`,
    `recency_days: ${recency_days}`,
    geo_filter ? `geo_filter: ${yamlStr(geo_filter)}` : null,
    `language: "en"`,
    `num_results: ${num_results}`,
    `depth: ${depth}`,
    extra_notes
      ? `extra_notes: |\n${extra_notes
          .split("\n")
          .map((l) => `  ${l}`)
          .join("\n")}`
      : null,
  ]
    .filter(Boolean)
    .join("\n");

  const workDir = await mkdtemp(join(tmpdir(), `mr-${randomUUID().slice(0, 8)}-`));
  const briefPath = join(workDir, "brief.yaml");
  const outPath = join(workDir, "report.json");

  try {
    await writeFile(briefPath, brief, "utf-8");

    const bin = process.env.MEDIA_RESEARCHER_BIN || DEFAULT_BIN;
    const { code, stderr } = await run(
      bin,
      ["run", "--brief", briefPath, "--format", "json", "--out", outPath, "--depth", depth],
      process.env as Record<string, string>,
    );
    if (code !== 0) {
      return NextResponse.json(
        { error: `media-researcher exited ${code}`, stderr: stderr.slice(0, 2000) },
        { status: 500 },
      );
    }

    const raw = await readFile(outPath, "utf-8");
    const report = JSON.parse(raw);
    return NextResponse.json(report);
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 500 },
    );
  } finally {
    rm(workDir, { recursive: true, force: true }).catch(() => undefined);
  }
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, Math.trunc(n)));
}

function yamlStr(s: string): string {
  return `"${s.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

function run(
  cmd: string,
  args: string[],
  env: Record<string, string>,
): Promise<{ code: number; stdout: string; stderr: string }> {
  return new Promise((resolve) => {
    const proc: ChildProcess = spawn(cmd, args, { env: env as NodeJS.ProcessEnv });
    let stdout = "";
    let stderr = "";
    proc.stdout?.on("data", (d: Buffer) => (stdout += String(d)));
    proc.stderr?.on("data", (d: Buffer) => (stderr += String(d)));
    proc.on("error", (err: Error) =>
      resolve({ code: -1, stdout, stderr: stderr + "\n" + err.message }),
    );
    proc.on("close", (code: number | null) =>
      resolve({ code: code ?? -1, stdout, stderr }),
    );
  });
}
