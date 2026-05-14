import type { PaymentProvider } from "@workspace/contracts";
import type { PaymentProviderAdapter } from "./adapter";
import { AdapterConfigError } from "./adapter";
import { stripeEnabled } from "../env";
import { createStripeAdapter } from "./stripe";

const adapters = new Map<PaymentProvider, PaymentProviderAdapter>();

if (stripeEnabled) {
  adapters.set("stripe", createStripeAdapter());
}

export function getAdapter(provider: PaymentProvider): PaymentProviderAdapter {
  const adapter = adapters.get(provider);
  if (!adapter) {
    throw new AdapterConfigError(`payment provider not configured: ${provider}`);
  }
  return adapter;
}

export function isAdapterAvailable(provider: PaymentProvider): boolean {
  return adapters.has(provider);
}

export function listAvailableProviders(): PaymentProvider[] {
  return Array.from(adapters.keys());
}
