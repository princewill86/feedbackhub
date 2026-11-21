import { env } from '$env/dynamic/private';
import { btcpayEnabled, reconcileBtcpay, verifyBtcpaySignature } from '$lib/server/btcpay';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request }) => {
  if (!btcpayEnabled()) return new Response(null, { status: 503 });
  const body = Buffer.from(await request.arrayBuffer());
  if (body.length > 262144) return new Response(null, { status: 413 });
  if (!verifyBtcpaySignature(body, request.headers.get('btcpay-sig') ?? '')) return new Response(null, { status: 401 });
  try {
    const event = JSON.parse(body.toString('utf8'));
    if (event?.storeId === env.BTCPAY_STORE_ID && typeof event.invoiceId === 'string'
      && ['InvoiceSettled', 'InvoiceExpired', 'InvoiceInvalid'].includes(event.type)) {
      await reconcileBtcpay(event.invoiceId);
    }
    return new Response(null, { status: 200 });
  } catch {
    return new Response(null, { status: 502 });
  }
};
