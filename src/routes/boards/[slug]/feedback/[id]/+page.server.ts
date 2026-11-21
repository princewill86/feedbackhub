import { error } from '@sveltejs/kit';
import { and, count, desc, eq } from 'drizzle-orm';
import { getDb } from '$lib/server/db';
import { feedbackItems, feedbackStatusChanges, feedbackStatuses, feedbackVotes, workspaces } from '$lib/server/schema';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, setHeaders }) => {
  setHeaders({ 'cache-control': 'no-store' });
  const db = getDb();
  const [item] = await db.select({
    workspaceId: workspaces.id, workspaceName: workspaces.name, title: feedbackItems.title,
    description: feedbackItems.description, createdAt: feedbackItems.createdAt
  }).from(workspaces).innerJoin(feedbackItems, eq(feedbackItems.workspaceId, workspaces.id))
    .where(and(eq(workspaces.slug, params.slug), eq(workspaces.publicBoard, true),
      eq(feedbackItems.id, params.id), eq(feedbackItems.published, true)));
  if (!item) error(404, 'Feedback not found.');

  const [[votes], [status]] = await Promise.all([
    db.select({ total: count() }).from(feedbackVotes)
      .where(and(eq(feedbackVotes.workspaceId, item.workspaceId), eq(feedbackVotes.feedbackId, params.id))),
    db.select({ name: feedbackStatuses.name }).from(feedbackStatusChanges)
      .innerJoin(feedbackStatuses, and(eq(feedbackStatuses.workspaceId, feedbackStatusChanges.workspaceId),
        eq(feedbackStatuses.id, feedbackStatusChanges.statusId)))
      .where(and(eq(feedbackStatusChanges.workspaceId, item.workspaceId), eq(feedbackStatusChanges.feedbackId, params.id)))
      .orderBy(desc(feedbackStatusChanges.createdAt), desc(feedbackStatusChanges.id)).limit(1)
  ]);
  const { workspaceId, ...publicItem } = item;
  return { ...publicItem, slug: params.slug, votes: votes.total, status: status?.name ?? null };
};
