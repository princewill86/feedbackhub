import { paystackEnabled, reconcilePaystack, verifyPaystackSignature } from '$lib/server/paystack';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request }) => {
  if (!paystackEnabled()) return new Response(null, { status: 503 });
  const body = Buffer.from(await request.arrayBuffer());
  if (body.length > 262144) return new Response(null, { status: 413 });
  if (!verifyPaystackSignature(body, request.headers)) return new Response(null, { status: 401 });
  try {
    const event = JSON.parse(body.toString('utf8'));
    if (event?.event === 'charge.success' && typeof event.data?.reference === 'string') {
      await reconcilePaystack(event.data.reference);
    }
    return new Response(null, { status: 200 });
  } catch {
    return new Response(null, { status: 502 });
  }
};
