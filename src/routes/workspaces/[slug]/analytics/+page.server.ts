import { hasWorkspaceFeature } from '$lib/server/entitlements';
import { error } from '@sveltejs/kit';
import { and, asc, count, countDistinct, eq, isNull, sql } from 'drizzle-orm';
import { getDb } from '$lib/server/db';
import { feedbackComments, feedbackItems, feedbackVotes, products } from '$lib/server/schema';
import { canManageFeedback, requireWorkspace } from '$lib/server/workspaces';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ request, params, url, setHeaders }) => {
  setHeaders({ 'cache-control': 'private, no-store' });
  const { workspace, role } = await requireWorkspace(request, params.slug);
  if (!canManageFeedback(role)) error(403, 'Analytics access required.');
  if (!await hasWorkspaceFeature(workspace.id, 'analyticsEnabled')) error(403, 'Analytics is unavailable on this plan.');

  const days = Number(url.searchParams.get('days') ?? 30);
  if (![7, 30, 90].includes(days)) error(400, 'Invalid date range.');
  const since = new Date();
  since.setUTCHours(0, 0, 0, 0);
  since.setUTCDate(since.getUTCDate() - days + 1);

  const scope = and(eq(feedbackItems.workspaceId, workspace.id), sql`${feedbackItems.createdAt} >= ${since.toISOString()}::timestamptz`);
  const day = sql<string>`to_char(${feedbackItems.createdAt} at time zone 'UTC', 'YYYY-MM-DD')`;
  const db = getDb();
  const [daily, [votes], [comments], breakdown] = await Promise.all([
    db.select({ date: day, total: count() }).from(feedbackItems).where(scope).groupBy(day).orderBy(day),
    db.select({ total: count(), people: countDistinct(feedbackVotes.userId) }).from(feedbackVotes)
      .innerJoin(feedbackItems, and(eq(feedbackVotes.workspaceId, feedbackItems.workspaceId),
        eq(feedbackVotes.feedbackId, feedbackItems.id))).where(scope),
    db.select({ total: count() }).from(feedbackComments)
      .innerJoin(feedbackItems, and(eq(feedbackComments.workspaceId, feedbackItems.workspaceId),
        eq(feedbackComments.feedbackId, feedbackItems.id))).where(and(scope, isNull(feedbackComments.removedAt))),
    db.select({ id: products.id, name: products.name, total: count() }).from(feedbackItems)
      .leftJoin(products, and(eq(products.workspaceId, feedbackItems.workspaceId), eq(products.id, feedbackItems.productId)))
      .where(scope).groupBy(products.id, products.name).orderBy(sql`count(*) desc`, asc(products.name), asc(products.id)).limit(20)
  ]);

  const totals = new Map(daily.map((entry) => [entry.date, entry.total]));
  const series = Array.from({ length: days }, (_, index) => {
    const date = new Date(since.getTime() + index * 86400000).toISOString().slice(0, 10);
    return { date, total: totals.get(date) ?? 0 };
  });

  return {
    slug: workspace.slug, days, series, breakdown, submissions: series.reduce((sum, entry) => sum + entry.total, 0),
    votes: votes.total, voters: votes.people, comments: comments.total
  };
};
