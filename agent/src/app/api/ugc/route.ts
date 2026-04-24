import { NextResponse } from "next/server";

import { jobStore } from "@/lib/store";
import { fetchUgcOrder, purchaseUgc } from "@/lib/agent/purchaseUgc";

export const runtime = "nodejs";
export const maxDuration = 180;

/**
 * POST /api/ugc { jobId } -> purchase UGC for the job's generated outreach,
 * pay via x402, attach the resulting order onto the job, return it.
 */
export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const jobId = body.jobId;
    if (!jobId) {
      return NextResponse.json({ error: "jobId required" }, { status: 400 });
    }

    const job = jobStore.get(jobId);
    if (!job) return NextResponse.json({ error: "job not found" }, { status: 404 });
    if (!job.content) {
      return NextResponse.json(
        { error: "job has no generated content yet" },
        { status: 409 },
      );
    }

    const topics = [
      job.profile?.category,
      ...(job.profile?.capabilities ?? []),
    ]
      .filter((t): t is string => Boolean(t))
      .map((t) => t.toLowerCase().replace(/\s+/g, "-"))
      .slice(0, 8);

    const order = await purchaseUgc({
      company: job.company,
      content: job.content,
      topics,
    });

    const updated = jobStore.update(jobId, { ugc: order });
    return NextResponse.json(updated ?? { ugc: order });
  } catch (err) {
    console.error("POST /api/ugc failed", err);
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 500 },
    );
  }
}
