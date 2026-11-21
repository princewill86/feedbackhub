import { createHmac, timingSafeEqual } from 'node:crypto';
import { env } from '$env/dynamic/private';

export function stripeEnabled() {
  return Boolean(/^(sk|rk)_(test|live)_/.test(env.STRIPE_SECRET_KEY ?? '')
    && env.STRIPE_WEBHOOK_SECRET?.startsWith('whsec_') && env.BETTER_AUTH_URL);
}

export async function stripeRequest<T>(path: string, fields?: Record<string, string>, idempotencyKey?: string): Promise<T> {
  if (!stripeEnabled()) throw new Error('Stripe billing is unavailable.');
  const headers = new Headers({ authorization: 'Bearer ' + env.STRIPE_SECRET_KEY });
  if (idempotencyKey) headers.set('idempotency-key', idempotencyKey);
  const response = await fetch('https://api.stripe.com/v1/' + path, {
    method: fields ? 'POST' : 'GET', headers, body: fields ? new URLSearchParams(fields) : undefined,
    redirect: 'error', signal: AbortSignal.timeout(12000)
  });
  if (!response.ok) throw new Error('Stripe returned HTTP ' + response.status);
  return await response.json() as T;
}

export function stripeRedirect(value: string | null | undefined, host: string) {
  if (!value) throw new Error('Stripe did not return a hosted page.');
  const url = new URL(value);
  if (url.protocol !== 'https:' || url.hostname !== host || url.username || url.password || url.port) {
    throw new Error('Stripe returned an unexpected hosted URL.');
  }
  return url.href;
}

export function verifyStripeSignature(body: string, header: string) {
  const secret = env.STRIPE_WEBHOOK_SECRET;
  const fields = header.split(',').map((value) => value.trim());
  const timestamps = fields.filter((value) => value.startsWith('t='));
  const timestamp = timestamps[0]?.slice(2);
  if (!secret || timestamps.length !== 1 || !timestamp || !/^\d{1,12}$/.test(timestamp)
    || Math.abs(Date.now() / 1000 - Number(timestamp)) > 300) return false;
  const expected = createHmac('sha256', secret).update(timestamp + '.' + body).digest();
  return fields.some((value) => /^v1=[a-f0-9]{64}$/i.test(value)
    && timingSafeEqual(expected, Buffer.from(value.slice(3), 'hex')));
}

export const paidStripeStatus = (status: string) => status === 'active' || status === 'trialing';
