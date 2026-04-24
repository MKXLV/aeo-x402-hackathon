"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import type { AgentConfig, AnalysisJob } from "@/lib/types";
import { encodeConfigHeader } from "@/lib/config";
import {
  DEFAULT_AGENT_CONFIG,
  DEFAULT_DEMO_URLS,
  formatApiBase,
  loadAgentConfig,
  resolveApiUrl,
} from "@/lib/settings";
import ResultsView from "./ResultsView";

export default function Dashboard() {
  const [config, setConfig] = useState<AgentConfig>(DEFAULT_AGENT_CONFIG);
  const [company, setCompany] = useState("Ghost");
  const [urlsText, setUrlsText] = useState(DEFAULT_DEMO_URLS.join("\n"));
  const [publishGhost, setPublishGhost] = useState(false);
  const [publishSubstack, setPublishSubstack] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [job, setJob] = useState<AnalysisJob | null>(null);
  const [recentJobs, setRecentJobs] = useState<AnalysisJob[]>([]);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const sync = () => setConfig(loadAgentConfig());
    sync();
    window.addEventListener("storage", sync);
    return () => window.removeEventListener("storage", sync);
  }, []);

  // Small ticking indicator while the backend processes
  useEffect(() => {
    if (!loading) return;
    const t = setInterval(() => setTick((n) => (n + 1) % 4), 500);
    return () => clearInterval(t);
  }, [loading]);

  useEffect(() => {
    void loadRecentRuns(config).then(setRecentJobs).catch(() => undefined);
  }, [config]);

  async function run() {
    setError(null);
    if (!config.llmApiKey) {
      setError("Configure your LLM API key in Settings first.");
      return;
    }
    const urls = urlsText
      .split("\n")
      .map((u) => u.trim())
      .filter(Boolean);
    if (urls.length === 0) {
      setError("Add at least one URL.");
      return;
    }
    setLoading(true);
    setJob(null);
    try {
      const res = await fetch(resolveApiUrl(config.wundergraphEndpoint, "/analyze"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-aeo-config": encodeConfigHeader(config),
        },
        body: JSON.stringify({ company, urls, publishGhost, publishSubstack }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Pipeline failed");
      setJob(data);
      void loadRecentRuns(config).then(setRecentJobs).catch(() => undefined);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  const needsConfig = !config.llmApiKey;
  const hasTinyFish = Boolean(config.tinyfishApiKey);
  const hasGhost = Boolean(config.ghostAdminKey && config.ghostAdminUrl);
  const hasSubstack = Boolean(
    config.substackPublicationUrl &&
      config.substackEmail &&
      config.substackPassword &&
      config.tinyfishApiKey
  );

  return (
    <div className="space-y-6">
      <div className="grid gap-4 xl:grid-cols-[1.3fr_0.7fr]">
        <div className="rounded-[1.75rem] border border-slate-800 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.18),transparent_30%),linear-gradient(135deg,rgba(15,23,42,0.98),rgba(2,6,23,0.94))] p-7 shadow-[0_28px_80px_rgba(2,6,23,0.45)]">
          <div className="text-xs uppercase tracking-[0.28em] text-cyan-300">
            Demo Control Room
          </div>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-white">
            Autonomous AEO Agent
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            Give a company and a few URLs. The agent crawls via TinyFish,
            orchestrates through the WunderGraph-style API layer, synthesizes a
            company profile, and ships AEO answers, a blog draft, a podcast
            script, and outreach DMs.
          </p>

          <div className="mt-5 flex flex-wrap gap-2 text-xs text-slate-400">
            <Badge on={!needsConfig} label="LLM" />
            <Badge on={hasTinyFish} label="TinyFish" />
            <Badge on label="WunderGraph" />
            <Badge on={hasGhost} label="Ghost" />
            <Badge on={hasSubstack} label="Substack" />
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-3">
            <MiniStat
              label="API base"
              value={formatApiBase(config.wundergraphEndpoint)}
            />
            <MiniStat
              label="Fetch mode"
              value={hasTinyFish ? "TinyFish live" : "Built-in fallback"}
            />
            <MiniStat
              label="Publishing"
              value={
                hasSubstack
                  ? "Substack automation ready"
                  : hasGhost
                  ? "Ghost ready"
                  : "Draft only"
              }
            />
          </div>
        </div>

        <div className="rounded-[1.5rem] border border-slate-800 bg-slate-900/60 p-6 shadow-[0_18px_60px_rgba(2,6,23,0.35)]">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-sm font-semibold uppercase tracking-[0.22em] text-slate-300">
                Recent Runs
              </h2>
              <p className="mt-2 text-sm text-slate-400">
                Pulls from the `/results` operation to keep the last jobs visible
                during the demo.
              </p>
            </div>
            <Link className="text-sm text-cyan-300 underline" href="/settings">
              Open Settings
            </Link>
          </div>

          <div className="mt-5 space-y-3">
            {recentJobs.length > 0 ? (
              recentJobs.slice(0, 4).map((item) => (
                <button
                  key={item.id}
                  className="block w-full rounded-xl border border-slate-800 bg-slate-950/80 p-4 text-left transition hover:border-cyan-500/30 hover:bg-slate-950"
                  onClick={() => setJob(item)}
                >
                  <div className="flex items-center justify-between gap-4">
                    <div className="text-sm font-medium text-white">
                      {item.company}
                    </div>
                    <span className={badgeClass(item.status)}>
                      {item.status}
                    </span>
                  </div>
                  <div className="mt-2 text-xs text-slate-500">
                    {new Date(item.createdAt).toLocaleString()}
                  </div>
                </button>
              ))
            ) : (
              <div className="rounded-xl border border-dashed border-slate-700 bg-slate-950/60 p-4 text-sm text-slate-500">
                No saved runs yet. Start with the sample Ghost URLs or paste your
                own.
              </div>
            )}
          </div>
        </div>
      </div>

      {needsConfig && (
        <div className="rounded-md border border-amber-500/40 bg-amber-900/20 p-4 text-sm text-amber-200">
          No LLM key found.{" "}
          <Link className="underline" href="/settings">
            Open Settings
          </Link>{" "}
          and paste your keys.
        </div>
      )}

      <section className="space-y-4 rounded-[1.5rem] border border-slate-800 bg-slate-900/55 p-6 shadow-[0_18px_60px_rgba(2,6,23,0.28)]">
        <div className="grid gap-4 md:grid-cols-[1fr_2fr]">
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-slate-300">
              Company name
            </span>
            <input
              className="input"
              value={company}
              onChange={(e) => setCompany(e.target.value)}
              placeholder="e.g. Ghost"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-slate-300">
              URLs (one per line)
            </span>
            <textarea
              className="input min-h-[110px] font-mono"
              value={urlsText}
              onChange={(e) => setUrlsText(e.target.value)}
            />
          </label>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4 text-sm text-slate-400">
          <div className="font-medium text-slate-200">Demo flow</div>
          <p className="mt-2 leading-6">
            1. Save keys in Settings. 2. Paste a company and URLs here. 3. Run
            the agent. 4. Walk through the profile, answers, content bundle, and
            structured sources below.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-4">
          <label className="flex items-center gap-2 text-sm text-slate-300">
            <input
              type="checkbox"
              checked={publishGhost}
              onChange={(e) => setPublishGhost(e.target.checked)}
              disabled={!hasGhost}
            />
            Publish blog draft to Ghost
            {!hasGhost && (
              <span className="text-xs text-slate-500">(not configured)</span>
            )}
          </label>
          <label className="flex items-center gap-2 text-sm text-slate-300">
            <input
              type="checkbox"
              checked={publishSubstack}
              onChange={(e) => setPublishSubstack(e.target.checked)}
              disabled={!hasSubstack}
            />
            Publish Substack-ready edition via TinyFish
            {!hasSubstack && (
              <span className="text-xs text-slate-500">
                (needs TinyFish + Substack credentials)
              </span>
            )}
          </label>
          <button
            onClick={run}
            disabled={loading || needsConfig}
            className="ml-auto rounded-md bg-gradient-to-r from-cyan-500 to-indigo-500 px-5 py-2 text-sm font-medium text-white shadow-lg shadow-indigo-500/20 disabled:opacity-50"
          >
            {loading ? `Running agent${".".repeat(tick)}` : "Run Agent"}
          </button>
        </div>

        {error && (
          <div className="rounded-md border border-red-500/40 bg-red-900/20 p-3 text-sm text-red-200">
            {error}
          </div>
        )}
      </section>

      {job && <ResultsView job={job} />}
    </div>
  );
}

function Badge({ on, label }: { on: boolean; label: string }) {
  return (
    <span
      className={`rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-wider ${
        on
          ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
          : "border-slate-700 bg-slate-800/40 text-slate-500"
      }`}
    >
      {label} {on ? "on" : "off"}
    </span>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-4">
      <div className="text-xs uppercase tracking-[0.2em] text-slate-400">
        {label}
      </div>
      <div className="mt-2 text-sm font-medium text-slate-100">{value}</div>
    </div>
  );
}

function badgeClass(status: AnalysisJob["status"]): string {
  if (status === "complete") {
    return "rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-1 text-[10px] uppercase tracking-[0.18em] text-emerald-300";
  }
  if (status === "error") {
    return "rounded-full border border-red-500/30 bg-red-500/10 px-2 py-1 text-[10px] uppercase tracking-[0.18em] text-red-300";
  }
  if (status === "running") {
    return "rounded-full border border-cyan-500/30 bg-cyan-500/10 px-2 py-1 text-[10px] uppercase tracking-[0.18em] text-cyan-300";
  }
  return "rounded-full border border-slate-700 bg-slate-800/70 px-2 py-1 text-[10px] uppercase tracking-[0.18em] text-slate-400";
}

async function loadRecentRuns(config: AgentConfig): Promise<AnalysisJob[]> {
  const res = await fetch(resolveApiUrl(config.wundergraphEndpoint, "/results"), {
    headers: {
      "x-aeo-config": encodeConfigHeader(config),
    },
  });

  if (!res.ok) return [];
  const data = (await res.json()) as AnalysisJob[];
  return Array.isArray(data) ? data : [];
}
