export type TierDTO = {
  id: number;
  label: string;
  amountCents: number;
  availableFrom: string | null;
  availableUntil: string | null;
};

export type AddOnDTO = { id: number; label: string; amountCents: number };

export type CouponInfo = { id: number; code: string; type: string; value: number };

export function tierIsActive(tier: TierDTO, now: Date) {
  if (tier.availableFrom && new Date(tier.availableFrom) > now) return false;
  if (tier.availableUntil && new Date(tier.availableUntil) < now) return false;
  return true;
}

export function couponDiscount(coupon: CouponInfo | null, subtotalCents: number) {
  if (!coupon) return 0;
  if (coupon.type === "percent") return Math.round((subtotalCents * coupon.value) / 100);
  return Math.min(coupon.value, subtotalCents);
}

export function computeTotal(
  tier: TierDTO,
  selectedAddOns: AddOnDTO[],
  coupon: CouponInfo | null
) {
  const subtotal = tier.amountCents + selectedAddOns.reduce((s, a) => s + a.amountCents, 0);
  const discount = couponDiscount(coupon, subtotal);
  return {
    subtotalCents: subtotal,
    discountCents: discount,
    totalCents: Math.max(0, subtotal - discount),
  };
}

export function formatCents(cents: number, currency = "AUD") {
  return new Intl.NumberFormat("en-AU", { style: "currency", currency }).format(cents / 100);
}
