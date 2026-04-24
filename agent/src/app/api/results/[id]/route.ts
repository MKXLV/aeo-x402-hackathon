import { NextResponse } from "next/server";
import { results } from "../../../../../wundergraph/operations/results";

export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const job = await results({ id: params.id });
  if (!job) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  return NextResponse.json(job);
}
