import { randomUUID } from "crypto";
import type { CheckoutInput, CheckoutResult, PaymentGateway } from "./gateway";

// Dev/stub gateway: "checkout" is a local /pay page with a Pay button that
// marks the payment as paid. Swap for StripeGateway when a Stripe account exists.
export const fakeGateway: PaymentGateway = {
  name: "fake",

  async createCheckout(input: CheckoutInput): Promise<CheckoutResult> {
    return {
      redirectUrl: `/pay/${input.reference}`,
      gatewayRef: `fake_ch_${randomUUID().slice(0, 12)}`,
    };
  },

  async refund(gatewayRef: string) {
    return { gatewayRef: `fake_re_${gatewayRef.slice(-12)}` };
  },
};
