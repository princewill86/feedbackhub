import { createHmac, timingSafeEqual } from 'node:crypto';
import { env } from '$env/dynamic/private';
import { and, eq } from 'drizzle-orm';
import { getDb } from './db';
import { grantPrepaidPayment } from './prepaid';
import { prepaidPayments } from './schema';

export function nowPaymentsEnabled() {
  return Boolean(env.NOWPAYMENTS_API_KEY && env.NOWPAYMENTS_IPN_SECRET && env.BETTER_AUTH_URL);
}

export async function nowPaymentsRequest<T>(path: string, payload?: Record<string, unknown>) {
  if (!nowPaymentsEnabled()) throw new Error('NOWPayments is unavailable.');
  const host = env.NOWPAYMENTS_SANDBOX === 'true' ? 'api-sandbox.nowpayments.io' : 'api.nowpayments.io';
  const response = await fetch(`https://${host}/v1/${path}`, {
    method: payload ? 'POST' : 'GET', redirect: 'error', signal: AbortSignal.timeout(12000),
    headers: { 'x-api-key': env.NOWPAYMENTS_API_KEY ?? '', 'content-type': 'application/json' },
    body: payload ? JSON.stringify(payload) : undefined
  });
  if (!response.ok) throw new Error('NOWPayments returned HTTP ' + response.status);
  return await response.json() as T;
}

function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (value === null || typeof value !== 'object') return value;
  return Object.fromEntries(Object.entries(value).sort(([left], [right]) => left < right ? -1 : left > right ? 1 : 0)
    .map(([key, entry]) => [key, sortKeys(entry)]));
}

export function verifyNowPaymentsSignature(event: unknown, signature: string) {
  if (!env.NOWPAYMENTS_IPN_SECRET || !/^[a-f0-9]{128}$/i.test(signature)) return false;
  const digest = createHmac('sha512', env.NOWPAYMENTS_IPN_SECRET).update(JSON.stringify(sortKeys(event))).digest();
  return timingSafeEqual(digest, Buffer.from(signature, 'hex'));
}

export async function reconcileNowPayments(reference: string, invoiceId: string, paymentId: string) {
  if (!/^fh-[a-f0-9-]{36}$/.test(reference) || !/^\d{1,30}$/.test(invoiceId) || !/^\d{1,30}$/.test(paymentId)) return false;
  const [order] = await getDb().select().from(prepaidPayments).where(and(
    eq(prepaidPayments.reference, reference), eq(prepaidPayments.provider, 'nowpayments'),
    eq(prepaidPayments.invoiceId, invoiceId)
  ));
  if (!order) return false;
  if (order.paidAt) return true;

  const payment = await nowPaymentsRequest<{
    payment_id: string | number; invoice_id?: string | number; order_id: string;
    payment_status: string; price_currency: string; price_amount: string | number;
  }>('payment/' + paymentId);
  if (String(payment.payment_id) !== paymentId || (payment.invoice_id != null && String(payment.invoice_id) !== invoiceId)
    || payment.order_id !== reference || payment.payment_status !== 'finished'
    || payment.price_currency?.toLowerCase() !== 'usd'
    || !/^\d+(?:\.\d{1,2})?0*$/.test(String(payment.price_amount))
    || Number(payment.price_amount).toFixed(2) !== (order.amount / 100).toFixed(2)) return false;
  return grantPrepaidPayment(reference);
}
