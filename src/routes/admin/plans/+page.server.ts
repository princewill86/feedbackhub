import { error, fail } from '@sveltejs/kit';
import { and, asc, eq, sql } from 'drizzle-orm';
import { requirePlatformAdministrator } from '$lib/server/access';
import { getDb } from '$lib/server/db';
import { platformAudit, subscriptionPlans, workspaces, workspaceSubscriptions } from '$lib/server/schema';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ request, setHeaders, url }) => {
  setHeaders({ 'cache-control': 'private, no-store' });
  await requirePlatformAdministrator(request);
  const slug = (url.searchParams.get('workspace') ?? '').trim();
  if (slug.length > 64) error(400, 'Invalid workspace slug.');
  const db = getDb();
  const plans = await db.select().from(subscriptionPlans).orderBy(asc(subscriptionPlans.name)).limit(100);
  const [workspace] = slug ? await db.select({ slug: workspaces.slug, name: workspaces.name, planId: workspaceSubscriptions.planId })
    .from(workspaces).leftJoin(workspaceSubscriptions, eq(workspaces.id, workspaceSubscriptions.workspaceId))
    .where(eq(workspaces.slug, slug)) : [];
  return { plans, slug, workspace };
};

export const actions: Actions = {
  save: async ({ request }) => {
    const actor = await requirePlatformAdministrator(request);
    const form = await request.formData();
    const name = form.get('name');
    const description = form.get('description');
    const price = form.get('stripePriceId');
    const stripePriceId = typeof price === 'string' ? price.trim() || null : null;
    const parseLimit = (field: string, minimum = 0) => {
      const raw = form.get(field);
      if (raw === null || raw === '') return null;
      if (typeof raw !== 'string' || !/^\d+$/.test(raw)) return undefined;
      const value = Number(raw);
      return Number.isInteger(value) && value >= minimum && value <= 1000000 ? value : undefined;
    };
    const paystackAmount = parseLimit('paystackAmount', 1);
    const paystackCurrency = form.get('paystackCurrency') ?? 'NGN';
    const paystackDays = parseLimit('paystackDays', 1) ?? 30;
    const bitcoinAmount = parseLimit('bitcoinAmount', 1);
    const bitcoinDays = parseLimit('bitcoinDays', 1) ?? 30;
    const feedbackLimit = parseLimit('limit');
    const productLimit = parseLimit('products');
    const memberLimit = parseLimit('members', 1);
    const configured = form.get('features') === 'configured';
    const apiEnabled = !configured || form.get('api') === 'on';
    const widgetEnabled = !configured || form.get('widget') === 'on';
    const analyticsEnabled = !configured || form.get('analytics') === 'on';
    const id = form.get('id');
    const active = form.get('active') === 'on';
    if (typeof name !== 'string' || !name.trim() || name.length > 80 ||
      typeof description !== 'string' || description.length > 500 ||
      (stripePriceId !== null && !/^price_[A-Za-z0-9]{1,120}$/.test(stripePriceId)) ||
      paystackAmount === undefined || typeof paystackCurrency !== 'string' || !/^[A-Z]{3}$/.test(paystackCurrency) ||
      paystackDays > 365 || (form.has('paystackDays') && parseLimit('paystackDays', 1) === undefined) ||
      bitcoinAmount === undefined || bitcoinDays > 365 || (form.has('bitcoinDays') && parseLimit('bitcoinDays', 1) === undefined) ||
      feedbackLimit === undefined || productLimit === undefined || memberLimit === undefined ||
      (id !== null && (typeof id !== 'string' || id.length > 64))) {
      return fail(400, { message: 'Enter a plan name, description, and valid feedback limit.' });
    }
    try {
      await getDb().transaction(async (tx) => {
        const values = { name: name.trim(), description: description.trim(), stripePriceId, paystackAmount, paystackCurrency, paystackDays, bitcoinAmount, bitcoinDays, feedbackLimit, productLimit, memberLimit, apiEnabled, widgetEnabled, analyticsEnabled, active };
        if (typeof id === 'string') {
          const [updated] = await tx.update(subscriptionPlans).set(values).where(eq(subscriptionPlans.id, id))
            .returning({ id: subscriptionPlans.id });
          if (!updated) error(404, 'Plan not found.');
        } else await tx.insert(subscriptionPlans).values({ ...values, id: crypto.randomUUID() });
        await tx.insert(platformAudit).values({
          id: crypto.randomUUID(), actorId: actor.id, action: 'Saved subscription plan', target: values.name
        });
      });
    } catch (cause) {
      if (cause instanceof Error && 'cause' in cause && (cause.cause as { code?: string })?.code === '23505') {
        return fail(409, { message: 'That plan name is already in use.' });
      }
      throw cause;
    }
    return { message: 'Plan saved.' };
  },
  assign: async ({ request }) => {
    const actor = await requirePlatformAdministrator(request);
    const form = await request.formData();
    const slug = form.get('workspace');
    const planId = form.get('plan');
    if (typeof slug !== 'string' || slug.length > 64 || typeof planId !== 'string' || planId.length > 64) {
      return fail(400, { message: 'Choose a workspace and a plan.' });
    }

    await getDb().transaction(async (tx) => {
      const [workspace] = await tx.select({ id: workspaces.id }).from(workspaces).where(eq(workspaces.slug, slug)).for('update');
      if (!workspace) error(404, 'Workspace not found.');
      if (planId) {
        const [plan] = await tx.select({ id: subscriptionPlans.id }).from(subscriptionPlans)
          .where(and(eq(subscriptionPlans.id, planId), eq(subscriptionPlans.active, true))).for('share');
        if (!plan) error(400, 'Choose an active plan.');
        await tx.insert(workspaceSubscriptions).values({ workspaceId: workspace.id, planId })
          .onConflictDoUpdate({ target: workspaceSubscriptions.workspaceId, set: { planId, assignedAt: sql`now()` } });
      } else {
        await tx.delete(workspaceSubscriptions).where(eq(workspaceSubscriptions.workspaceId, workspace.id));
      }
      await tx.insert(platformAudit).values({
        id: crypto.randomUUID(), actorId: actor.id, action: planId ? 'Assigned workspace plan' : 'Removed workspace plan', target: slug
      });
    });
    return { message: 'Workspace plan updated.' };
  }
};
