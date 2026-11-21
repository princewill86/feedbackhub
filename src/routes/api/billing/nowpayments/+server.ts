import { nowPaymentsEnabled, reconcileNowPayments, verifyNowPaymentsSignature } from '$lib/server/nowpayments';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request }) => {
  if (!nowPaymentsEnabled()) return new Response(null, { status: 503 });
  const body = await request.text();
  if (body.length > 262144) return new Response(null, { status: 413 });
  let event;
  try { event = JSON.parse(body); }
  catch { return new Response(null, { status: 400 }); }
  if (!verifyNowPaymentsSignature(event, request.headers.get('x-nowpayments-sig') ?? '')) {
    return new Response(null, { status: 401 });
  }
  try {
    if (event?.payment_status === 'finished' && typeof event.order_id === 'string') {
      await reconcileNowPayments(event.order_id, String(event.invoice_id), String(event.payment_id));
    }
    return new Response(null, { status: 200 });
  } catch {
    return new Response(null, { status: 502 });
  }
};
