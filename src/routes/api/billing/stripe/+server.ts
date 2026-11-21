import { env } from '$env/dynamic/private';
import { and, eq, sql } from 'drizzle-orm';
import { getDb } from '$lib/server/db';
import { stripeBilling, workspaceSubscriptions, workspaces } from '$lib/server/schema';
import { paidStripeStatus, stripeEnabled, stripeRequest, verifyStripeSignature } from '$lib/server/stripe';
import type { RequestHandler } from './$types';

type Subscription = {
  id: string;
  customer: string;
  status: string;
  livemode: boolean;
  metadata?: { feedbackhub_attempt?: string };
  items?: { data?: { price?: { id?: string }; quantity?: number }[]; has_more?: boolean };
};

export const POST: RequestHandler = async ({ request }) => {
  if (!stripeEnabled()) return new Response(null, { status: 503 });
  const header = request.headers.get('stripe-signature');
  if (!header) return new Response(null, { status: 400 });
  const body = await request.text();
  if (body.length > 262144) return new Response(null, { status: 413 });
  if (!verifyStripeSignature(body, header)) return new Response(null, { status: 400 });

  let event: { type?: string; livemode?: boolean; data?: { object?: { id?: string; metadata?: { feedbackhub_attempt?: string } } } };
  try { event = JSON.parse(body); }
  catch { return new Response(null, { status: 400 }); }
  if (!event || typeof event !== 'object') return new Response(null, { status: 400 });
  const live = env.STRIPE_SECRET_KEY?.includes('_live_');
  if (event.livemode !== live || !['customer.subscription.created', 'customer.subscription.updated', 'customer.subscription.deleted'].includes(event.type ?? '')) {
    return new Response(null, { status: 204 });
  }
  const subscriptionId = event.data?.object?.id;
  const attemptId = event.data?.object?.metadata?.feedbackhub_attempt;
  if (!subscriptionId || !/^sub_[A-Za-z0-9]+$/.test(subscriptionId) || !attemptId) return new Response(null, { status: 204 });

  const db = getDb();
  const [known] = await db.select({ workspaceId: stripeBilling.workspaceId }).from(stripeBilling)
    .where(eq(stripeBilling.attemptId, attemptId));
  if (!known) return new Response(null, { status: 204 });

  try {
    await db.transaction(async (tx) => {
      // Serialize reconciliation. Read Stripe's current state so older webhook events cannot reactivate a canceled subscription.
      await tx.select({ id: workspaces.id }).from(workspaces).where(eq(workspaces.id, known.workspaceId)).for('update');
      const [billing] = await tx.select().from(stripeBilling).where(and(
        eq(stripeBilling.workspaceId, known.workspaceId), eq(stripeBilling.attemptId, attemptId)
      ));
      if (!billing || (billing.subscriptionId && billing.subscriptionId !== subscriptionId)) return;
      const subscription = await stripeRequest<Subscription>('subscriptions/' + subscriptionId);
      if (subscription.id !== subscriptionId || subscription.livemode !== live
        || subscription.metadata?.feedbackhub_attempt !== billing.attemptId
        || !/^cus_[A-Za-z0-9]+$/.test(subscription.customer)) return;
      const items = subscription.items?.data;
      const matchingPrice = !subscription.items?.has_more && items?.length === 1
        && items[0]?.price?.id === billing.priceId && items[0]?.quantity === 1;
      const status = matchingPrice ? subscription.status : 'price_mismatch';
      await tx.update(stripeBilling).set({
        subscriptionId, customerId: subscription.customer, status, updatedAt: sql`now()`
      }).where(eq(stripeBilling.workspaceId, known.workspaceId));

      if (paidStripeStatus(status)) {
        await tx.insert(workspaceSubscriptions).values({ workspaceId: known.workspaceId, planId: billing.planId })
          .onConflictDoUpdate({ target: workspaceSubscriptions.workspaceId, set: { planId: billing.planId, assignedAt: sql`now()` } });
      }
    });
  } catch {
    return new Response(null, { status: 502 });
  }
  return new Response(null, { status: 204 });
};
