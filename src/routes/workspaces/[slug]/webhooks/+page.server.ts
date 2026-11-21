import { error, fail } from '@sveltejs/kit';
import { and, desc, eq } from 'drizzle-orm';
import { getDb } from '$lib/server/db';
import { webhookDeliveries, webhooks, workspaceMembers } from '$lib/server/schema';
import { allowedWebhook, issueWebhookSecret } from '$lib/server/webhooks';
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
  const [entries, deliveries] = await Promise.all([
    db.select({ id: webhooks.id, url: webhooks.url, disabled: webhooks.disabled }).from(webhooks)
      .where(eq(webhooks.workspaceId, workspace.id)).orderBy(desc(webhooks.createdAt)).limit(50),
    db.select({
      id: webhookDeliveries.id, event: webhookDeliveries.event, state: webhookDeliveries.state,
      attempts: webhookDeliveries.attempts, status: webhookDeliveries.httpStatus
    }).from(webhookDeliveries).innerJoin(webhooks, eq(webhookDeliveries.webhookId, webhooks.id))
      .where(eq(webhooks.workspaceId, workspace.id)).orderBy(desc(webhookDeliveries.createdAt)).limit(50)
  ]);
  return { slug: workspace.slug, entries, deliveries };
};

async function mutate(request: Request, slug: string, create: boolean) {
  const { workspace, user } = await owner(request, slug);
  const form = await request.formData();
  const raw = form.get(create ? 'url' : 'id');
  if (typeof raw !== 'string' || !raw || raw.length > 500) return fail(400, { message: 'Enter a valid destination.', secret: null });
  const url = create ? allowedWebhook(raw.trim()) : null;
  if (create && !url) return fail(400, { message: 'The destination must match an operator-approved HTTPS URL.', secret: null });

  return getDb().transaction(async (tx) => {
    const [member] = await tx.select({ role: workspaceMembers.role }).from(workspaceMembers)
      .where(and(eq(workspaceMembers.workspaceId, workspace.id), eq(workspaceMembers.userId, user.id))).for('update');
    if (member?.role !== 'owner') error(403, 'Workspace owner access required.');
    if (url) {
      const targets = await tx.select({ id: webhooks.id }).from(webhooks)
        .where(and(eq(webhooks.workspaceId, workspace.id), eq(webhooks.disabled, false))).limit(10);
      if (targets.length >= 10) return fail(409, { message: 'Disable an active destination first.', secret: null });
      const id = crypto.randomUUID();
      const { secret, encryptedSecret } = issueWebhookSecret(id);
      await tx.insert(webhooks).values({ id, workspaceId: workspace.id, url, encryptedSecret });
      return { message: 'Webhook added. Copy the signing secret now.', secret };
    }
    const [updated] = await tx.update(webhooks).set({ disabled: true })
      .where(and(eq(webhooks.id, raw), eq(webhooks.workspaceId, workspace.id))).returning({ id: webhooks.id });
    if (!updated) error(404, 'Webhook not found.');
    return { message: 'Webhook disabled.', secret: null };
  });
}

export const actions: Actions = {
  add: ({ request, params }) => mutate(request, params.slug, true),
  disable: ({ request, params }) => mutate(request, params.slug, false)
};
