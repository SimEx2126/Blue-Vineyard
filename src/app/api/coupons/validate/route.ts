import { NextResponse } from "next/server";
import { z } from "zod";
import { findValidCoupon } from "@/lib/registration";

const bodySchema = z.object({ eventId: z.number().int(), code: z.string().min(1) });

export async function POST(req: Request) {
  let body: z.infer<typeof bodySchema>;
  try {
    body = bodySchema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  const { error, coupon } = await findValidCoupon(body.eventId, body.code);
  if (error || !coupon) return NextResponse.json({ error }, { status: 400 });
  return NextResponse.json({
    coupon: { id: coupon.id, code: coupon.code, type: coupon.type, value: coupon.value },
  });
}
