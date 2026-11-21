import { error, fail } from '@sveltejs/kit';
import { and, asc, eq } from 'drizzle-orm';
import { getDb } from '$lib/server/db';
import { feedbackStatuses, workspaceMembers } from '$lib/server/schema';
import { canManageFeedback, requireWorkspace } from '$lib/server/workspaces';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ request, params, setHeaders }) => {
  setHeaders({ 'cache-control': 'private, no-store' });
  const { workspace, role } = await requireWorkspace(request, params.slug);
  if (!canManageFeedback(role)) error(403, 'Feedback management access required.');
  const statuses = await getDb().select({ name: feedbackStatuses.name }).from(feedbackStatuses)
    .where(eq(feedbackStatuses.workspaceId, workspace.id)).orderBy(asc(feedbackStatuses.name));
  return { slug: workspace.slug, statuses };
};

export const actions: Actions = {
  create: async ({ request, params }) => {
    const { workspace, user, role } = await requireWorkspace(request, params.slug);
    if (!canManageFeedback(role)) error(403, 'Feedback management access required.');
    const raw = (await request.formData()).get('name');
    const name = typeof raw === 'string' ? raw.trim() : '';
    if (!name || name.length > 60) return fail(400, { message: 'Enter a status name of 1–60 characters.' });

    const created = await getDb().transaction(async (tx) => {
      const [member] = await tx.select({ role: workspaceMembers.role }).from(workspaceMembers)
        .where(and(eq(workspaceMembers.workspaceId, workspace.id), eq(workspaceMembers.userId, user.id))).for('share');
      if (!member || !canManageFeedback(member.role)) error(403, 'Feedback management access required.');
      const [status] = await tx.insert(feedbackStatuses).values({ workspaceId: workspace.id, id: crypto.randomUUID(), name })
        .onConflictDoNothing().returning({ id: feedbackStatuses.id });
      return Boolean(status);
    });
    return created ? { message: 'Status added.' } : fail(409, { message: 'That status already exists.' });
  }
};
