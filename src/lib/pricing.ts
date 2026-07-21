export type TierDTO = {
  id: number;
  label: string;
  amountCents: number;
};

export type AddOnDTO = { id: number; label: string; amountCents: number };

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
