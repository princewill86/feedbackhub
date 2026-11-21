import { nowPaymentsEnabled, nowPaymentsRequest } from '$lib/server/nowpayments';
import { btcpayCheckoutUrl, btcpayEnabled, btcpayRequest, reconcileBtcpay } from '$lib/server/btcpay';
import { env } from '$env/dynamic/private';
import { error, fail, redirect } from '@sveltejs/kit';
import { and, asc, desc, eq, isNotNull, isNull } from 'drizzle-orm';
import { getDb } from '$lib/server/db';
import { prepaidPayments, stripeBilling, subscriptionPlans, workspaceMembers, workspaces } from '$lib/server/schema';
import { paystackEnabled, paystackRequest, reconcilePaystack } from '$lib/server/paystack';
import { stripeEnabled, stripeRedirect as hostedBillingUrl, stripeRequest } from '$lib/server/stripe';
import { requireWorkspace } from '$lib/server/workspaces';
import type { Actions, PageServerLoad } from './$types';

async function owner(request: Request, slug: string) {
  const access = await requireWorkspace(request, slug);
  if (access.role !== 'owner') error(403, 'Workspace owner access required.');
  return access;
}

export const load: PageServerLoad = async ({ request, params, setHeaders }) => {
  setHeaders({ 'cache-control': 'private, no-store' });
  const { workspace } = await owner(request, params.slug);
  const db = getDb();
  const [billing] = await db.select({ status: stripeBilling.status, customerId: stripeBilling.customerId, planName: subscriptionPlans.name })
    .from(stripeBilling).innerJoin(subscriptionPlans, eq(stripeBilling.planId, subscriptionPlans.id))
    .where(eq(stripeBilling.workspaceId, workspace.id));
  const plans = stripeEnabled() ? await db.select({ id: subscriptionPlans.id, name: subscriptionPlans.name, description: subscriptionPlans.description })
    .from(subscriptionPlans).where(and(eq(subscriptionPlans.active, true), isNotNull(subscriptionPlans.stripePriceId)))
    .orderBy(asc(subscriptionPlans.name)).limit(100) : [];
  const prepaidPlans = paystackEnabled() ? await db.select({
    id: subscriptionPlans.id, name: subscriptionPlans.name, amount: subscriptionPlans.paystackAmount,
    currency: subscriptionPlans.paystackCurrency, days: subscriptionPlans.paystackDays
  }).from(subscriptionPlans).where(and(eq(subscriptionPlans.active, true), isNotNull(subscriptionPlans.paystackAmount)))
    .orderBy(asc(subscriptionPlans.name)).limit(100) : [];
  const bitcoinPlans = btcpayEnabled() || nowPaymentsEnabled() ? await db.select({
    id: subscriptionPlans.id, name: subscriptionPlans.name, days: subscriptionPlans.bitcoinDays
  }).from(subscriptionPlans).where(and(eq(subscriptionPlans.active, true), isNotNull(subscriptionPlans.bitcoinAmount)))
    .orderBy(asc(subscriptionPlans.name)).limit(100) : [];
  const payments = await db.select({
    reference: prepaidPayments.reference, provider: prepaidPayments.provider, invoiceId: prepaidPayments.invoiceId,
    checkoutUrl: prepaidPayments.checkoutUrl, voidedAt: prepaidPayments.voidedAt, amount: prepaidPayments.amount, currency: prepaidPayments.currency,
    paidAt: prepaidPayments.paidAt, expiresAt: prepaidPayments.expiresAt
  }).from(prepaidPayments).where(eq(prepaidPayments.workspaceId, workspace.id))
    .orderBy(desc(prepaidPayments.createdAt)).limit(20);
  return { nowPaymentsEnabled: nowPaymentsEnabled(), bitcoinPlans, bitcoinEnabled: btcpayEnabled(), prepaidPlans, payments, paystackEnabled: paystackEnabled(), enabled: stripeEnabled(), test: env.STRIPE_SECRET_KEY?.includes('_test_') ?? false, plans,
    billing: billing ? { status: billing.status, planName: billing.planName, portal: Boolean(billing.customerId) } : null };
};

async function prepaidCheckout(request: Request, slug: string, provider: 'paystack' | 'btcpay' | 'nowpayments') {
  const { workspace, user } = await owner(request, slug);
  const enabled = { paystack: paystackEnabled, btcpay: btcpayEnabled, nowpayments: nowPaymentsEnabled };
  if (!enabled[provider]()) return fail(503, { message: 'This payment provider is unavailable.' });
  const selected = (await request.formData()).get('plan');
  if (typeof selected !== 'string' || selected.length > 64) return fail(400, { message: 'Choose a plan.' });

  let destination: string | null;
  try {
    destination = await getDb().transaction(async (tx) => {
      const [member] = await tx.select({ role: workspaceMembers.role }).from(workspaceMembers)
        .where(and(eq(workspaceMembers.workspaceId, workspace.id), eq(workspaceMembers.userId, user.id))).for('share');
      if (member?.role !== 'owner') return null;
      await tx.select({ id: workspaces.id }).from(workspaces).where(eq(workspaces.id, workspace.id)).for('update');
      const [stripe] = await tx.select({ workspaceId: stripeBilling.workspaceId }).from(stripeBilling)
        .where(eq(stripeBilling.workspaceId, workspace.id));
      if (stripe) return null;
      const [pending] = await tx.select().from(prepaidPayments)
        .where(and(eq(prepaidPayments.workspaceId, workspace.id), isNull(prepaidPayments.paidAt), isNull(prepaidPayments.voidedAt))).limit(1);
      if (pending) return pending.provider === provider && pending.planId === selected ? pending.checkoutUrl : null;
      const [activePayment] = await tx.select({ planId: prepaidPayments.planId, expiresAt: prepaidPayments.expiresAt })
        .from(prepaidPayments).where(and(eq(prepaidPayments.workspaceId, workspace.id), isNotNull(prepaidPayments.paidAt)))
        .orderBy(desc(prepaidPayments.expiresAt)).limit(1);
      if (activePayment?.expiresAt && activePayment.expiresAt.getTime() > Date.now() && activePayment.planId !== selected) return null;
      const [plan] = await tx.select().from(subscriptionPlans)
        .where(and(eq(subscriptionPlans.id, selected), eq(subscriptionPlans.active, true)));
      if (!plan) return null;
      const amount = provider === 'paystack' ? plan.paystackAmount : plan.bitcoinAmount;
      if (!amount) return null;
      const currency = provider === 'paystack' ? plan.paystackCurrency : 'USD';
      const termDays = provider === 'paystack' ? plan.paystackDays : plan.bitcoinDays;

      const reference = 'fh-' + crypto.randomUUID();
      const callback = new URL(`/workspaces/${workspace.slug}/billing`, env.BETTER_AUTH_URL);
      let checkoutUrl: string;
      let invoiceId: string | null = null;
      if (provider === 'paystack') {
        const initialized = await paystackRequest<{ authorization_url: string; reference: string }>('transaction/initialize', {
          email: user.email, amount, currency, reference, callback_url: callback.href
        });
        if (initialized.reference !== reference) throw new Error('Paystack returned an unexpected reference.');
        checkoutUrl = hostedBillingUrl(initialized.authorization_url, 'checkout.paystack.com');
      } else if (provider === 'btcpay') {
        const invoice = await btcpayRequest(undefined, {
          amount: (amount / 100).toFixed(2), currency, metadata: { orderId: reference },
          checkout: { redirectURL: callback.href, redirectAutomatically: false }
        });
        checkoutUrl = btcpayCheckoutUrl(invoice);
        invoiceId = invoice.id;
      } else {
        const invoice = await nowPaymentsRequest<{ id: string | number; invoice_url: string }>('invoice', {
          price_amount: amount / 100, price_currency: 'usd', order_id: reference,
          ipn_callback_url: new URL('/api/billing/nowpayments', env.BETTER_AUTH_URL).href,
          success_url: callback.href, cancel_url: callback.href
        });
        invoiceId = String(invoice.id);
        if (!/^\d{1,30}$/.test(invoiceId)) throw new Error('Invalid NOWPayments invoice ID.');
        const host = new URL(invoice.invoice_url).hostname;
        const allowedHosts = env.NOWPAYMENTS_SANDBOX === 'true'
          ? ['sandbox.nowpayments.io', 'nowpayments.io'] : ['nowpayments.io'];
        if (!allowedHosts.includes(host)) throw new Error('Unexpected NOWPayments checkout host.');
        checkoutUrl = hostedBillingUrl(invoice.invoice_url, host);
      }
      await tx.insert(prepaidPayments).values({
        reference, workspaceId: workspace.id, planId: plan.id, amount, currency, termDays, checkoutUrl, provider, invoiceId
      });
      return checkoutUrl;
    });
  } catch {
    return fail(502, { message: 'Checkout is unavailable. Try again.' });
  }
  if (!destination) return fail(409, { message: 'Checkout is unavailable while there is a payment for another plan or provider.' });
  redirect(303, destination);
}

export const actions: Actions = {
  paystack: ({ request, params }) => prepaidCheckout(request, params.slug, 'paystack'),
  bitcoin: ({ request, params }) => prepaidCheckout(request, params.slug, 'btcpay'),
  nowpayments: ({ request, params }) => prepaidCheckout(request, params.slug, 'nowpayments'),
  verifyBitcoin: async ({ request, params }) => {
    const { workspace } = await owner(request, params.slug);
    const invoice = (await request.formData()).get('invoice');
    if (typeof invoice !== 'string') return fail(400, { message: 'Choose an invoice.' });
    try {
      if (!await reconcileBtcpay(invoice, workspace.id)) return fail(409, { message: 'BTCPay has not confirmed this invoice.' });
    } catch {
      return fail(502, { message: 'Could not verify this invoice.' });
    }
    redirect(303, `/workspaces/${workspace.slug}/billing`);
  },
  verifyPaystack: async ({ request, params }) => {
    const { workspace } = await owner(request, params.slug);
    const reference = (await request.formData()).get('reference');
    if (typeof reference !== 'string') return fail(400, { message: 'Choose a payment.' });
    try {
      if (!await reconcilePaystack(reference, workspace.id)) return fail(409, { message: 'Paystack has not confirmed this payment.' });
    } catch {
      return fail(502, { message: 'Could not verify this payment with Paystack.' });
    }
    redirect(303, `/workspaces/${workspace.slug}/billing`);
  },
  checkout: async ({ request, params }) => {
    const { user, workspace } = await owner(request, params.slug);
    if (!stripeEnabled()) return fail(503, { message: 'Stripe billing is unavailable.' });
    const selected = (await request.formData()).get('plan');
    if (typeof selected !== 'string' || selected.length > 64) return fail(400, { message: 'Choose a plan.' });

    const attempt = await getDb().transaction(async (tx) => {
      const [member] = await tx.select({ role: workspaceMembers.role }).from(workspaceMembers)
        .where(and(eq(workspaceMembers.workspaceId, workspace.id), eq(workspaceMembers.userId, user.id))).for('share');
      if (member?.role !== 'owner') error(403, 'Workspace owner access required.');
      await tx.select({ id: workspaces.id }).from(workspaces).where(eq(workspaces.id, workspace.id)).for('update');
      const [existing] = await tx.select().from(stripeBilling).where(eq(stripeBilling.workspaceId, workspace.id));
      if (existing?.subscriptionId) return null;
      const [prepaid] = await tx.select({ reference: prepaidPayments.reference }).from(prepaidPayments)
        .where(eq(prepaidPayments.workspaceId, workspace.id)).limit(1);
      if (prepaid) return null;
      if (existing && existing.checkoutExpiresAt.getTime() + 60_000 > Date.now()) {
        return existing.planId === selected && existing.checkoutExpiresAt.getTime() > Date.now() ? existing : null;
      }

      if (existing) {
        if (!existing.checkoutSessionId) return null;
        try {
          const expired = await stripeRequest<{ status: string; subscription: string | null }>(
            'checkout/sessions/' + encodeURIComponent(existing.checkoutSessionId)
          );
          if (expired.status !== 'expired' || expired.subscription !== null) return null;
        } catch {
          return null;
        }
      }

      const [plan] = await tx.select().from(subscriptionPlans)
        .where(and(eq(subscriptionPlans.id, selected), eq(subscriptionPlans.active, true)));
      if (!plan?.stripePriceId) return null;
      const values = {
        planId: plan.id, attemptId: crypto.randomUUID(), priceId: plan.stripePriceId, checkoutEmail: user.email, checkoutSessionId: null,
        checkoutExpiresAt: new Date(Math.floor(Date.now() / 1000 + 4 * 3600) * 1000), status: 'pending'
      };
      const [saved] = await tx.insert(stripeBilling).values({ ...values, workspaceId: workspace.id })
        .onConflictDoUpdate({ target: stripeBilling.workspaceId, set: values }).returning();
      return saved;
    });

    if (!attempt) return fail(409, { message: 'This workspace has an existing subscription or checkout for another plan.' });
    const returnUrl = new URL(`/workspaces/${workspace.slug}/billing`, env.BETTER_AUTH_URL).href;
    let checkout: string;
    try {
      const session = await stripeRequest<{ id: string; url: string | null; status: string }>('checkout/sessions', {
        mode: 'subscription', 'line_items[0][price]': attempt.priceId, 'line_items[0][quantity]': '1',
        customer_email: attempt.checkoutEmail, success_url: returnUrl, cancel_url: returnUrl,
        expires_at: String(attempt.checkoutExpiresAt.getTime() / 1000),
        'subscription_data[metadata][feedbackhub_attempt]': attempt.attemptId
      }, 'feedbackhub-checkout-' + attempt.attemptId);
      if (session.status !== 'open') return fail(409, { message: 'Checkout has ended. Wait for the subscription status to update.' });
      if (!/^cs_(test|live)_[A-Za-z0-9]+$/.test(session.id)) throw new Error('Invalid Stripe Checkout Session ID.');
      await getDb().update(stripeBilling).set({ checkoutSessionId: session.id })
        .where(and(eq(stripeBilling.workspaceId, workspace.id), eq(stripeBilling.attemptId, attempt.attemptId)));
      checkout = hostedBillingUrl(session.url, 'checkout.stripe.com');
    } catch {
      return fail(502, { message: 'Stripe checkout is unavailable. Try again.' });
    }
    redirect(303, checkout);
  },
  portal: async ({ request, params }) => {
    const { workspace } = await owner(request, params.slug);
    if (!stripeEnabled()) return fail(503, { message: 'Stripe billing is unavailable.' });
    const [billing] = await getDb().select({ customerId: stripeBilling.customerId })
      .from(stripeBilling).where(eq(stripeBilling.workspaceId, workspace.id));
    if (!billing?.customerId) return fail(409, { message: 'Complete checkout before opening the billing portal.' });
    let portal: string;
    try {
      const result = await stripeRequest<{ url: string }>('billing_portal/sessions', {
        customer: billing.customerId, return_url: new URL(`/workspaces/${workspace.slug}/billing`, env.BETTER_AUTH_URL).href
      });
      portal = hostedBillingUrl(result.url, 'billing.stripe.com');
    } catch {
      return fail(502, { message: 'Stripe billing portal is unavailable. Try again.' });
    }
    redirect(303, portal);
  }
};
