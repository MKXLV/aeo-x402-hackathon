import { NextResponse } from "next/server";

import { fetchUgcOrder } from "@/lib/agent/purchaseUgc";

export const runtime = "nodejs";

/** GET /api/ugc/:orderId — proxies to the seller and returns live order state. */
export async function GET(
  _req: Request,
  { params }: { params: { orderId: string } },
) {
  try {
    const sellerUrl = process.env.UGC_SELLER_URL;
    const order = await fetchUgcOrder(params.orderId, sellerUrl);
    return NextResponse.json(order);
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 500 },
    );
  }
}
