import { error } from '@sveltejs/kit';
import { and, desc, eq, lte, sql } from 'drizzle-orm';
import { getDb } from '$lib/server/db';
import { publicationKind } from '$lib/server/publications';
import { publications, workspaces } from '$lib/server/schema';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, url, setHeaders }) => {
  setHeaders({ 'cache-control': 'no-store' });
  const kind = publicationKind(params.kind);
  const page = Number(url.searchParams.get('page') ?? 1);
  if (!Number.isInteger(page) || page < 1 || page > 1000) error(400, 'Invalid page.');

  const rows = await getDb().select({
    name: workspaces.name, id: publications.id, title: publications.title, body: publications.body,
    period: publications.period, publishedAt: publications.publishAt
  }).from(workspaces)
    .leftJoin(publications, and(eq(publications.workspaceId, workspaces.id), eq(publications.kind, kind),
      eq(publications.status, 'published'), lte(publications.publishAt, sql`now()`)))
    .where(and(eq(workspaces.slug, params.slug), eq(workspaces.publicBoard, true)))
    .orderBy(desc(publications.publishAt), desc(publications.id)).limit(21).offset((page - 1) * 20);
  if (!rows.length) error(404, 'Publication page not found.');
  return { name: rows[0].name, kind, slug: params.slug, items: rows.slice(0, 20).filter((row) => row.id !== null),
    page, hasNext: page < 1000 && rows.length > 20 };
};
