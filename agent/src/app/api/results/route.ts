import { NextResponse } from "next/server";
import { results } from "../../../../wundergraph/operations/results";

export async function GET() {
  const list = await results({});
  return NextResponse.json(list);
}
