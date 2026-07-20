import type { PaymentGateway } from "./gateway";
import { fakeGateway } from "./fake";

export function getGateway(): PaymentGateway {
  // When Stripe lands: return stripeGateway when STRIPE_SECRET_KEY is set.
  return fakeGateway;
}

export type { PaymentGateway } from "./gateway";
