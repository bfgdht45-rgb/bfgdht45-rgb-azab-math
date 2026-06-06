import { loadStripe } from '@stripe/stripe-js';

const publishableKey = (import.meta as any).env.VITE_STRIPE_PUBLISHABLE_KEY || 'pk_test_placeholder';

export const stripePromise = loadStripe(publishableKey);
