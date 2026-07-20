// Payment gateway abstraction. v1 ships FakeGateway; a StripeGateway
// implementing the same interface (Checkout Session + webhook) slots in later
// without touching the registration flow.

export type CheckoutInput = {
  registrationId: number;
  // The registration's ticket reference. Used in customer-facing URLs so they
  // never carry a guessable sequential id.
  reference: string;
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
