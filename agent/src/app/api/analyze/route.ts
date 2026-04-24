import { NextResponse } from "next/server";
import { analyze } from "../../../../wundergraph/operations/analyze";
import { readConfigFromHeaders } from "@/lib/config";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const config = readConfigFromHeaders(req.headers);
    const job = await analyze({
      company: body.company,
      urls: body.urls || [],
      publishGhost: Boolean(body.publishGhost),
      publishSubstack: Boolean(body.publishSubstack),
      config,
    });
    return NextResponse.json(job);
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 400 }
    );
  }
}
