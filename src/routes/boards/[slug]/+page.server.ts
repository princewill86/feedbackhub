import { error } from '@sveltejs/kit';
import { and, desc, eq, ilike, isNotNull, or, sql } from 'drizzle-orm';
import { getDb } from '$lib/server/db';
import { containsPattern } from '$lib/server/feedback-search';
import { feedbackItems, feedbackVotes, products, workspaces } from '$lib/server/schema';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, url, setHeaders }) => {
  setHeaders({ 'cache-control': 'no-store' });
  const page = Number(url.searchParams.get('page') ?? 1);
  const query = (url.searchParams.get('q') ?? '').trim();
  const product = url.searchParams.get('product') ?? '';
  const sort = url.searchParams.get('sort') ?? 'newest';
  if (!Number.isInteger(page) || page < 1 || page > 1000 || query.length > 140 || product.length > 64
    || (sort !== 'newest' && sort !== 'popular')) error(400, 'Invalid board filters.');

  const db = getDb();
  const publicScope = and(eq(workspaces.slug, params.slug), eq(workspaces.publicBoard, true));
  const [workspace] = await db.select({ name: workspaces.name, description: workspaces.description })
    .from(workspaces).where(publicScope);
  if (!workspace) error(404, 'Board not found.');

  const visible = and(eq(feedbackItems.workspaceId, workspaces.id), eq(feedbackItems.published, true));
  const productJoin = and(eq(products.workspaceId, feedbackItems.workspaceId), eq(products.id, feedbackItems.productId));
  const votes = sql<number>`(select count(*)::integer from ${feedbackVotes}
    where ${feedbackVotes.workspaceId} = ${feedbackItems.workspaceId} and ${feedbackVotes.feedbackId} = ${feedbackItems.id})`;
  const pattern = containsPattern(query);
  const [rows, options] = await Promise.all([
    db.select({
      id: feedbackItems.id, title: feedbackItems.title, body: feedbackItems.description, product: products.name, votes
    }).from(workspaces).innerJoin(feedbackItems, visible).leftJoin(products, productJoin)
      .where(and(publicScope, product ? eq(feedbackItems.productId, product) : undefined,
        query ? or(ilike(feedbackItems.title, pattern), ilike(feedbackItems.description, pattern)) : undefined))
      .orderBy(...(sort === 'popular' ? [desc(votes)] : []), desc(feedbackItems.createdAt), desc(feedbackItems.id))
      .limit(21).offset((page - 1) * 20),
    db.selectDistinct({ id: products.id, name: products.name }).from(workspaces)
      .innerJoin(feedbackItems, visible).innerJoin(products, productJoin)
      .where(and(publicScope, isNotNull(feedbackItems.productId))).orderBy(products.name, products.id).limit(100)
  ]);

  return { ...workspace, slug: params.slug, items: rows.slice(0, 20), options, query, product, sort,
    page, hasNext: page < 1000 && rows.length > 20 };
};
