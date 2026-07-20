// Payment gateway abstraction. v1 ships FakeGateway; a StripeGateway
// implementing the same interface (Checkout Session + webhook) slots in later
// without touching the registration flow.

export type CheckoutInput = {
  registrationId: number;
  amountCents: number;
  currency: string;
  description: string;
};

export type CheckoutResult = {
  redirectUrl: string;
  gatewayRef: string;
};

export interface PaymentGateway {
  name: string;
  createCheckout(input: CheckoutInput): Promise<CheckoutResult>;
  // Issue a refund for a gateway charge reference. Returns the refund's ref.
  refund(gatewayRef: string, amountCents: number): Promise<{ gatewayRef: string }>;
}
