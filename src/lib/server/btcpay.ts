import { createHmac, timingSafeEqual } from 'node:crypto';
import { env } from '$env/dynamic/private';
import { and, eq, isNull, sql } from 'drizzle-orm';
import { getDb } from './db';
import { grantPrepaidPayment } from './prepaid';
import { prepaidPayments, workspaces } from './schema';

export function btcpayOrigin() {
  try {
    const url = new URL(env.BTCPAY_ORIGIN ?? '');
    if (url.protocol !== 'https:' || url.username || url.password || url.pathname !== '/' || url.search || url.hash) return null;
    return url.origin;
  } catch { return null; }
}

export function btcpayEnabled() {
  return Boolean(btcpayOrigin() && env.BTCPAY_STORE_ID && env.BTCPAY_API_KEY && env.BTCPAY_WEBHOOK_SECRET && env.BETTER_AUTH_URL);
}

export type BtcInvoice = {
  id: string;
  checkoutLink: string;
  amount: string;
  currency: string;
  status: string;
  metadata?: { orderId?: string };
};

export async function btcpayRequest(id?: string, payload?: Record<string, unknown>): Promise<BtcInvoice> {
  if (!btcpayEnabled()) throw new Error('Bitcoin checkout is unavailable.');
  const url = btcpayOrigin() + '/api/v1/stores/' + encodeURIComponent(env.BTCPAY_STORE_ID ?? '') +
    '/invoices' + (id ? '/' + encodeURIComponent(id) : '');
  const response = await fetch(url, {
    method: payload ? 'POST' : 'GET', redirect: 'error', signal: AbortSignal.timeout(12000),
    headers: { authorization: 'token ' + env.BTCPAY_API_KEY, 'content-type': 'application/json' },
    body: payload ? JSON.stringify(payload) : undefined
  });
  if (!response.ok) throw new Error('BTCPay returned HTTP ' + response.status);
  return await response.json() as BtcInvoice;
}

export function btcpayCheckoutUrl(invoice: BtcInvoice) {
  if (!/^[A-Za-z0-9]{1,128}$/.test(invoice.id)) throw new Error('Invalid BTCPay invoice ID.');
  const url = new URL(invoice.checkoutLink);
  if (url.origin !== btcpayOrigin() || url.username || url.password) throw new Error('Unexpected BTCPay checkout URL.');
  return url.href;
}

export function verifyBtcpaySignature(body: Buffer, header: string) {
  const digest = /^sha256=([a-f0-9]{64})$/i.exec(header)?.[1];
  return Boolean(digest && env.BTCPAY_WEBHOOK_SECRET && timingSafeEqual(
    Buffer.from(digest, 'hex'), createHmac('sha256', env.BTCPAY_WEBHOOK_SECRET).update(body).digest()
  ));
}

export async function reconcileBtcpay(invoiceId: string, workspaceId?: string) {
  if (!/^[A-Za-z0-9]{1,128}$/.test(invoiceId)) return false;
  const db = getDb();
  const [payment] = await db.select().from(prepaidPayments)
    .where(and(eq(prepaidPayments.invoiceId, invoiceId), eq(prepaidPayments.provider, 'btcpay')));
  if (!payment || (workspaceId && payment.workspaceId !== workspaceId)) return false;
  if (payment.paidAt) return true;
  const invoice = await btcpayRequest(invoiceId);
  if (invoice.id !== invoiceId || invoice.metadata?.orderId !== payment.reference || invoice.currency !== 'USD'
    || !/^\d+(?:\.\d{1,2})?0*$/.test(invoice.amount) || Number(invoice.amount).toFixed(2) !== (payment.amount / 100).toFixed(2)) return false;
  if (invoice.status === 'Settled') return grantPrepaidPayment(payment.reference);
  if (invoice.status === 'Expired' || invoice.status === 'Invalid') {
    await db.transaction(async (tx) => {
      await tx.select({ id: workspaces.id }).from(workspaces).where(eq(workspaces.id, payment.workspaceId)).for('update');
      await tx.update(prepaidPayments).set({ voidedAt: sql`now()` })
        .where(and(eq(prepaidPayments.reference, payment.reference), isNull(prepaidPayments.paidAt)));
    });
  }
  return false;
}
