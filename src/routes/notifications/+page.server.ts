import { error, redirect } from '@sveltejs/kit';
import { and, desc, eq, isNull, sql } from 'drizzle-orm';
import { requireUser } from '$lib/server/access';
import { getDb } from '$lib/server/db';
import { feedbackItems, notifications, workspaceMembers, workspaces } from '$lib/server/schema';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ request, url, setHeaders }) => {
  setHeaders({ 'cache-control': 'private, no-store' });
  const user = await requireUser(request);
  const page = Number(url.searchParams.get('page') ?? 1);
  if (!Number.isInteger(page) || page < 1 || page > 1000) error(400, 'Invalid inbox page.');

  // A revoked membership also removes access to details in historical notifications.
  const entries = await getDb().select({
    id: notifications.id, kind: notifications.kind, at: notifications.createdAt, readAt: notifications.readAt,
    slug: workspaces.slug, feedbackId: feedbackItems.id, title: feedbackItems.title
  }).from(notifications)
    .innerJoin(workspaceMembers, and(eq(workspaceMembers.workspaceId, notifications.workspaceId),
      eq(workspaceMembers.userId, user.id)))
    .innerJoin(workspaces, eq(workspaces.id, notifications.workspaceId))
    .innerJoin(feedbackItems, and(eq(feedbackItems.workspaceId, notifications.workspaceId), eq(feedbackItems.id, notifications.feedbackId)))
    .where(eq(notifications.recipientId, user.id)).orderBy(desc(notifications.createdAt), desc(notifications.id))
    .limit(26).offset((page - 1) * 25);

  return { entries: entries.slice(0, 25), page, hasNext: page < 1000 && entries.length > 25 };
};

export const actions: Actions = {
  readAll: async ({ request }) => {
    const user = await requireUser(request);
    await getDb().update(notifications).set({ readAt: sql`now()` })
      .where(and(eq(notifications.recipientId, user.id), isNull(notifications.readAt)));
    redirect(303, '/notifications');
  }
};
