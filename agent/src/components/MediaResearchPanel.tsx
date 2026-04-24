"use client";

import { useCallback, useState } from "react";

import type { AnalysisJob } from "@/lib/types";

interface MediaTargetRow {
  id: string;
  target_type: string;
  name: string;
  role?: string | null;
  outlet?: string | null;
  audience_size?: number | null;
  audience_unit?: string | null;
  recent_work?: Array<{ title: string; url?: string; date?: string | null; summary?: string | null }>;
  contact?: { email?: string | null; twitter?: string | null; linkedin?: string | null; website?: string | null };
  score?: number | null;
  pitch_angle?: string | null;
}

interface Report {
  targets: MediaTargetRow[];
  limitations: string[];
  generated_at: string;
  brief: { topic: string; target_type: string; num_results: number };
}

export default function MediaResearchPanel({ job }: { job: AnalysisJob }) {
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [targetType, setTargetType] = useState<"mixed" | "podcasts" | "journalists" | "publications">("mixed");

  const topic = [job.profile?.category, ...(job.profile?.capabilities ?? [])]
    .filter(Boolean)
    .join(", ")
    .trim();

  const extraNotes =
    [job.profile?.audience, job.profile?.summary].filter(Boolean).join("\n\n").slice(0, 1200) ||
    job.company;

  const run = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/media-research", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          topic: topic || job.company,
          target_type: targetType,
          num_results: 10,
          depth: "medium",
          extra_notes: extraNotes,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      setReport(data as Report);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [topic, targetType, extraNotes, job.company]);

  return (
    <section className="rounded-[1.5rem] border border-slate-800 bg-[radial-gradient(circle_at_top_left,rgba(244,114,182,0.12),transparent_30%),linear-gradient(180deg,rgba(15,23,42,0.92),rgba(2,6,23,0.96))] p-6 shadow-[0_24px_60px_rgba(2,6,23,0.45)]">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="text-xs uppercase tracking-[0.24em] text-pink-300">
            Media Research
          </div>
          <h2 className="mt-2 text-xl font-semibold tracking-tight text-white">
            Find journalists, podcasts, and publications to pitch
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
            Synthesizes a brief from the company profile and runs the
            <code className="mx-1 rounded bg-slate-800 px-1.5 py-0.5 text-xs text-pink-200">media-researcher</code>
            skill. Degrades gracefully — missing API keys surface as
            <em className="text-slate-300">limitations</em>, not failures.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={targetType}
            onChange={(e) => setTargetType(e.target.value as typeof targetType)}
            className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-200"
            disabled={loading}
          >
            <option value="mixed">Mixed</option>
            <option value="journalists">Journalists</option>
            <option value="podcasts">Podcasts</option>
            <option value="publications">Publications</option>
          </select>
          <button
            onClick={run}
            disabled={loading || !job.profile}
            className="rounded-lg border border-pink-500/40 bg-pink-500/10 px-4 py-2 text-sm font-medium text-pink-200 transition hover:bg-pink-500/20 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {loading ? "Researching…" : "Find targets"}
          </button>
        </div>
      </div>

      {!job.profile && (
        <div className="rounded-xl border border-dashed border-slate-700 bg-slate-950/60 p-4 text-sm text-slate-500">
          Run the agent first so the brief can be synthesized from the company profile.
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/5 p-4 text-sm text-red-300">
          {error}
        </div>
      )}

      {report && (
        <div className="space-y-4">
          <div className="text-xs text-slate-400">
            Brief topic: <span className="text-slate-200">{report.brief.topic}</span>
            <span className="mx-2 text-slate-600">·</span>
            {report.targets.length} targets returned
          </div>

          {report.limitations.length > 0 && (
            <ul className="space-y-1 rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 text-xs text-amber-200">
              {report.limitations.map((l, i) => (
                <li key={i}>• {l}</li>
              ))}
            </ul>
          )}

          <div className="grid gap-3 md:grid-cols-2">
            {report.targets.map((t) => (
              <div
                key={t.id}
                className="rounded-xl border border-slate-800 bg-slate-950/70 p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="text-xs uppercase tracking-[0.2em] text-pink-300">
                      {t.target_type}
                    </div>
                    <h3 className="mt-1 truncate text-base font-semibold text-white">
                      {t.name}
                    </h3>
                    {(t.role || t.outlet) && (
                      <p className="mt-1 truncate text-sm text-slate-400">
                        {[t.role, t.outlet].filter(Boolean).join(" · ")}
                      </p>
                    )}
                  </div>
                  {typeof t.score === "number" && (
                    <span className="rounded-full border border-slate-700 bg-slate-800/80 px-2 py-1 text-[10px] uppercase tracking-[0.18em] text-slate-300">
                      {(t.score * 100).toFixed(0)}
                    </span>
                  )}
                </div>

                {t.audience_size && (
                  <div className="mt-2 text-xs text-slate-400">
                    Audience: {t.audience_size.toLocaleString()}{" "}
                    {t.audience_unit ?? ""}
                  </div>
                )}

                {t.pitch_angle && (
                  <p className="mt-3 text-sm leading-6 text-slate-300">
                    {t.pitch_angle}
                  </p>
                )}

                {(t.recent_work ?? []).length > 0 && (
                  <div className="mt-3 space-y-1">
                    <div className="text-[11px] uppercase tracking-[0.2em] text-slate-500">
                      Recent work
                    </div>
                    {(t.recent_work ?? []).slice(0, 3).map((w, i) => (
                      <a
                        key={i}
                        href={w.url ?? "#"}
                        target="_blank"
                        rel="noreferrer"
                        className="block truncate text-xs text-pink-200 hover:underline"
                      >
                        {w.title}
                      </a>
                    ))}
                  </div>
                )}

                {(t.contact?.email || t.contact?.twitter || t.contact?.linkedin || t.contact?.website) && (
                  <div className="mt-3 flex flex-wrap gap-2 text-[11px]">
                    {t.contact?.email && (
                      <a
                        href={`mailto:${t.contact.email}`}
                        className="rounded-full border border-slate-700 bg-slate-800/80 px-2 py-1 text-slate-300"
                      >
                        email
                      </a>
                    )}
                    {t.contact?.twitter && (
                      <a
                        href={t.contact.twitter}
                        target="_blank"
                        rel="noreferrer"
                        className="rounded-full border border-slate-700 bg-slate-800/80 px-2 py-1 text-slate-300"
                      >
                        twitter
                      </a>
                    )}
                    {t.contact?.linkedin && (
                      <a
                        href={t.contact.linkedin}
                        target="_blank"
                        rel="noreferrer"
                        className="rounded-full border border-slate-700 bg-slate-800/80 px-2 py-1 text-slate-300"
                      >
                        linkedin
                      </a>
                    )}
                    {t.contact?.website && (
                      <a
                        href={t.contact.website}
                        target="_blank"
                        rel="noreferrer"
                        className="rounded-full border border-slate-700 bg-slate-800/80 px-2 py-1 text-slate-300"
                      >
                        website
                      </a>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
