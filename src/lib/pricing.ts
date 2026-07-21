export type TierDTO = {
  id: number;
  label: string;
  amountCents: number;
  availableFrom: string | null;
  availableUntil: string | null;
};

export type AddOnDTO = { id: number; label: string; amountCents: number };

export function tierIsActive(tier: TierDTO, now: Date) {
  if (tier.availableFrom && new Date(tier.availableFrom) > now) return false;
  if (tier.availableUntil && new Date(tier.availableUntil) < now) return false;
  return true;
}

export function computeTotal(tier: TierDTO, selectedAddOns: AddOnDTO[]) {
  const subtotal = tier.amountCents + selectedAddOns.reduce((s, a) => s + a.amountCents, 0);
  return {
    subtotalCents: subtotal,
    discountCents: 0,
    totalCents: subtotal,
  };
}

export function formatCents(cents: number, currency = "AUD") {
  return new Intl.NumberFormat("en-AU", { style: "currency", currency }).format(cents / 100);
}
