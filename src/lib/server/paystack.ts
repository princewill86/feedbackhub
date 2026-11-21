import { createHmac, timingSafeEqual } from 'node:crypto';
import { env } from '$env/dynamic/private';
import { and, eq } from 'drizzle-orm';
import { grantPrepaidPayment } from './prepaid';
import { getDb } from './db';
import { prepaidPayments } from './schema';

export function paystackEnabled() {
  return Boolean(/^sk_(test|live)_/.test(env.PAYSTACK_SECRET_KEY ?? '') && env.BETTER_AUTH_URL);
}

export async function paystackRequest<T>(path: string, payload?: Record<string, unknown>) {
  if (!paystackEnabled()) throw new Error('Paystack billing is unavailable.');
  const response = await fetch('https://api.paystack.co/' + path, {
    method: payload ? 'POST' : 'GET', redirect: 'error', signal: AbortSignal.timeout(12000),
    headers: { authorization: 'Bearer ' + env.PAYSTACK_SECRET_KEY, 'content-type': 'application/json' },
    body: payload ? JSON.stringify(payload) : undefined
  });
  if (!response.ok) throw new Error('Paystack returned HTTP ' + response.status);
  const result = await response.json() as { status: boolean; data: T };
  if (!result.status || !result.data) throw new Error('Paystack rejected the request.');
  return result.data;
}

export function verifyPaystackSignature(bytes: Buffer, headers: Headers) {
  const current = headers.get('paystack-signature');
  const match = (digest: Buffer, signature: string) =>
    /^[a-f0-9]{128}$/i.test(signature) && timingSafeEqual(digest, Buffer.from(signature, 'hex'));

  if (current) {
    const secret = env.PAYSTACK_WEBHOOK_SECRET;
    const parts = current.split(',').map((value) => value.trim());
    const timestamps = parts.filter((value) => value.startsWith('t='));
    const time = timestamps[0]?.slice(2);
    if (!secret || timestamps.length !== 1 || !time || !/^\d{1,12}$/.test(time)
      || Math.abs(Date.now() / 1000 - Number(time)) > 300) return false;
    const digest = createHmac('sha512', secret).update(time + '.').update(bytes).digest();
    return parts.some((value) => {
      const signature = /^v1=whk_[A-Za-z0-9]+:([a-f0-9]{128})$/i.exec(value)?.[1];
      return Boolean(signature && match(digest, signature));
    });
  }

  const secret = env.PAYSTACK_SECRET_KEY;
  const legacy = headers.get('x-paystack-signature');
  return Boolean(secret && legacy && match(createHmac('sha512', secret).update(bytes).digest(), legacy));
}

export const paystackReference = /^fh-[a-f0-9-]{36}$/;

export async function reconcilePaystack(reference: string, expectedWorkspace?: string) {
  if (!paystackReference.test(reference) || !paystackEnabled()) return false;
  const db = getDb();
  const [payment] = await db.select().from(prepaidPayments).where(and(eq(prepaidPayments.reference, reference), eq(prepaidPayments.provider, 'paystack')));
  if (!payment || (expectedWorkspace && payment.workspaceId !== expectedWorkspace)) return false;
  if (payment.paidAt) return true;
  const result = await paystackRequest<{ reference: string; status: string; amount: number; currency: string; domain: string }>(
    'transaction/verify/' + encodeURIComponent(reference)
  );
  const mode = env.PAYSTACK_SECRET_KEY?.includes('_test_') ? 'test' : 'live';
  if (result.reference !== reference || result.status !== 'success' || result.domain !== mode ||
    result.amount !== payment.amount || result.currency !== payment.currency) return false;

  return grantPrepaidPayment(reference);
}
