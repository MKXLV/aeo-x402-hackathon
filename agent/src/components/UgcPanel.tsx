"use client";

import { useCallback, useEffect, useState } from "react";

import type { AnalysisJob, UgcOrderResult } from "@/lib/types";

const TERMINAL_ORDER_STATES = new Set(["completed", "partial", "failed"]);

export default function UgcPanel({ job }: { job: AnalysisJob }) {
  const [order, setOrder] = useState<UgcOrderResult | null>(job.ugc ?? null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setOrder(job.ugc ?? null);
  }, [job.ugc]);

  const refresh = useCallback(async (orderId: string) => {
    try {
      const res = await fetch(`/api/ugc/${orderId}`);
      if (!res.ok) return;
      const data = (await res.json()) as UgcOrderResult;
      setOrder((prev) => (prev ? { ...prev, ...data } : data));
    } catch {
      /* swallow — just keep last-known state */
    }
  }, []);

  // poll while non-terminal
  useEffect(() => {
    if (!order) return;
    if (TERMINAL_ORDER_STATES.has(order.state)) return;
    const id = setInterval(() => refresh(order.id), 4000);
    return () => clearInterval(id);
  }, [order, refresh]);

  const handlePurchase = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/ugc", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ jobId: job.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      setOrder((data.ugc ?? data) as UgcOrderResult);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const outreachCount = job.content?.outreach?.length ?? 0;
  const eligibleCount =
    job.content?.outreach?.filter((o) =>
      /reddit|twitter|^x$|x\.com/i.test(o.platform ?? ""),
    ).length ?? 0;

  return (
    <section className="rounded-[1.5rem] border border-slate-800 bg-[radial-gradient(circle_at_top_right,rgba(134,239,172,0.12),transparent_30%),linear-gradient(180deg,rgba(15,23,42,0.92),rgba(2,6,23,0.96))] p-6 shadow-[0_24px_60px_rgba(2,6,23,0.45)]">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="text-xs uppercase tracking-[0.24em] text-emerald-300">
            UGC Distribution
          </div>
          <h2 className="mt-2 text-xl font-semibold tracking-tight text-white">
            Purchase Reddit / Twitter posts via x402
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
            Pays the UGC seller in USDC on Base Sepolia. Each eligible outreach
            item becomes one paid post order.
          </p>
        </div>
        <div className="text-right text-xs text-slate-500">
          <div>
            <span className="text-slate-400">Outreach items:</span>{" "}
            <span className="text-slate-200">{outreachCount}</span>
          </div>
          <div>
            <span className="text-slate-400">Eligible (reddit/twitter):</span>{" "}
            <span className="text-slate-200">{eligibleCount}</span>
          </div>
        </div>
      </div>

      {!order && (
        <div className="flex flex-wrap items-center gap-4">
          <button
            onClick={handlePurchase}
            disabled={
              loading || !job.content || eligibleCount === 0 || job.status !== "complete"
            }
            className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-4 py-2 text-sm font-medium text-emerald-200 transition hover:bg-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {loading ? "Paying via x402…" : "Buy UGC distribution"}
          </button>
          {job.status !== "complete" && (
            <span className="text-xs text-slate-500">
              Run must finish before purchase.
            </span>
          )}
          {job.content && eligibleCount === 0 && (
            <span className="text-xs text-amber-400">
              No reddit / twitter platforms in the outreach list — nothing to buy.
            </span>
          )}
          {error && (
            <span className="text-xs text-red-400">Error: {error}</span>
          )}
        </div>
      )}

      {order && (
        <div className="space-y-4">
          <div className="grid gap-3 md:grid-cols-4">
            <StatCell label="Order" value={order.id.slice(0, 8)} sub={`state: ${order.state}`} />
            <StatCell label="Paid" value={`$${order.total_usdc} USDC`} sub="Base Sepolia" />
            <StatCell label="Posts" value={String(order.posts.length)} sub={postCountsByState(order)} />
            <StatCell label="Payer" value={order.payer_address.slice(0, 8) + "…"} sub={order.txNote ?? "on-chain settled"} />
          </div>

          <div className="space-y-2">
            {order.posts.map((p) => (
              <div
                key={p.id}
                className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-slate-800 bg-slate-950/70 p-4"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-emerald-300">
                    {p.platform}
                    <span className="text-slate-500">·</span>
                    <span className="text-slate-400">{p.kind}</span>
                    <span className="text-slate-500">·</span>
                    <span className="text-slate-400">{p.provider}</span>
                    {p.upstream && (
                      <>
                        <span className="text-slate-500">·</span>
                        <span className="text-slate-400">{p.upstream}</span>
                      </>
                    )}
                  </div>
                  <p className="mt-2 line-clamp-3 text-sm leading-6 text-slate-300">
                    {p.body}
                  </p>
                  {p.error && (
                    <p className="mt-1 text-xs text-red-400">err: {p.error}</p>
                  )}
                </div>
                <span className={postStatePill(p.state)}>{p.state}</span>
              </div>
            ))}
          </div>

          {!TERMINAL_ORDER_STATES.has(order.state) && (
            <div className="text-xs text-slate-500">
              Polling seller every 4s for state transitions…
            </div>
          )}
        </div>
      )}
    </section>
  );
}

function postCountsByState(order: UgcOrderResult): string {
  const counts: Record<string, number> = {};
  for (const p of order.posts) counts[p.state] = (counts[p.state] ?? 0) + 1;
  return Object.entries(counts)
    .map(([s, n]) => `${n} ${s}`)
    .join(", ");
}

function StatCell({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3">
      <div className="text-[11px] uppercase tracking-[0.22em] text-slate-500">{label}</div>
      <div className="mt-1 truncate text-lg font-semibold text-white">{value}</div>
      {sub && <div className="mt-1 truncate text-xs text-slate-400">{sub}</div>}
    </div>
  );
}

function postStatePill(state: string): string {
  const base =
    "rounded-full border px-3 py-1 text-xs uppercase tracking-[0.2em]";
  if (state === "posted")
    return `${base} border-emerald-500/30 bg-emerald-500/10 text-emerald-300`;
  if (state === "failed")
    return `${base} border-red-500/30 bg-red-500/10 text-red-300`;
  if (state === "refunded")
    return `${base} border-amber-500/30 bg-amber-500/10 text-amber-300`;
  return `${base} border-slate-700 bg-slate-800/80 text-slate-300`;
}
