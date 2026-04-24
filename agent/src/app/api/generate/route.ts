import { NextResponse } from "next/server";
import { generate } from "../../../../wundergraph/operations/generate";
import { readConfigFromHeaders } from "@/lib/config";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const config = readConfigFromHeaders(req.headers);
    const content = await generate({
      profile: body.profile,
      answerBlocks: body.answerBlocks || [],
      config,
    });
    return NextResponse.json(content);
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 400 }
    );
  }
}
