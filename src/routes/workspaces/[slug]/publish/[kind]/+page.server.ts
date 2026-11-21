import { error, fail, redirect } from '@sveltejs/kit';
import { and, desc, eq } from 'drizzle-orm';
import { getDb } from '$lib/server/db';
import { publicationKind } from '$lib/server/publications';
import { publications, workspaceMembers } from '$lib/server/schema';
import { canManageFeedback, requireWorkspace } from '$lib/server/workspaces';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ request, params, url, setHeaders }) => {
  setHeaders({ 'cache-control': 'private, no-store' });
  const kind = publicationKind(params.kind);
  const { workspace, role } = await requireWorkspace(request, params.slug);
  const page = Number(url.searchParams.get('page') ?? 1);
  if (!Number.isInteger(page) || page < 1 || page > 1000) error(400, 'Invalid page.');
  const entries = await getDb().select().from(publications)
    .where(and(eq(publications.workspaceId, workspace.id), eq(publications.kind, kind)))
    .orderBy(desc(publications.createdAt), desc(publications.id)).limit(21).offset((page - 1) * 20);

  return {
    kind, slug: workspace.slug, name: workspace.name, board: workspace.publicBoard,
    canManage: canManageFeedback(role), entries: entries.slice(0, 20), page, hasNext: page < 1000 && entries.length > 20
  };
};

export const actions: Actions = {
  save: async ({ request, params }) => {
    const kind = publicationKind(params.kind);
    const { workspace, user, role } = await requireWorkspace(request, params.slug);
    if (!canManageFeedback(role)) error(403, 'Publishing access required.');
    const form = await request.formData();
    const field = (key: string) => {
      const value = form.get(key);
      return typeof value === 'string' ? value.trim() : '';
    };
    const id = field('id');
    const title = field('title');
    const body = field('body');
    const period = kind === 'roadmap' ? field('period') : '';
    const status = field('status');
    const scheduled = field('scheduled');

    if (!title || title.length > 140 || !body || body.length > 12000 || period.length > 80 ||
      (status !== 'draft' && status !== 'published' && status !== 'archived')) {
      return fail(400, { message: 'Enter a title, description, and valid publication state.' });
    }

    const publishAt = status === 'published' ? scheduled ? new Date(scheduled + 'Z') : new Date() : null;
    if (publishAt && !Number.isFinite(publishAt.getTime())) return fail(400, { message: 'Enter a valid UTC publication date.' });

    await getDb().transaction(async (tx) => {
      const [member] = await tx.select({ role: workspaceMembers.role }).from(workspaceMembers)
        .where(and(eq(workspaceMembers.workspaceId, workspace.id), eq(workspaceMembers.userId, user.id))).for('share');
      if (!member || !canManageFeedback(member.role)) error(403, 'Publishing access required.');
      const values = { title, body, period, status, publishAt } as const;
      if (!id) {
        await tx.insert(publications).values({ ...values, id: crypto.randomUUID(), workspaceId: workspace.id, kind });
        return;
      }
      const [updated] = await tx.update(publications).set(values)
        .where(and(eq(publications.workspaceId, workspace.id), eq(publications.kind, kind), eq(publications.id, id)))
        .returning({ id: publications.id });
      if (!updated) error(404, 'Publication not found.');
    });
    redirect(303, `/workspaces/${workspace.slug}/publish/${kind}`);
  }
};
