import { hasWorkspaceFeature } from '$lib/server/entitlements';
import { error } from '@sveltejs/kit';
import { and, desc, eq } from 'drizzle-orm';
import { getDb } from '$lib/server/db';
import { feedbackItems, products } from '$lib/server/schema';
import { canManageFeedback, requireWorkspace } from '$lib/server/workspaces';
import type { RequestHandler } from './$types';

function cell(value: string) {
  // Quoting does not prevent spreadsheets from interpreting a cell as a formula.
  const safe = /^[\s\uFEFF]*[=+@-]|^[\t\r\n]/u.test(value) ? "'" + value : value;
  return '"' + safe.replaceAll('"', '""') + '"';
}

export const GET: RequestHandler = async ({ request, params }) => {
  const { workspace, role } = await requireWorkspace(request, params.slug);
  if (!canManageFeedback(role)) error(403, 'Export access required.');
  if (!await hasWorkspaceFeature(workspace.id, 'analyticsEnabled')) error(403, 'Analytics is unavailable on this plan.');

  const rows = await getDb().select({
    id: feedbackItems.id, title: feedbackItems.title, description: feedbackItems.description,
    product: products.name, createdAt: feedbackItems.createdAt
  }).from(feedbackItems)
    .leftJoin(products, and(eq(products.workspaceId, feedbackItems.workspaceId), eq(products.id, feedbackItems.productId)))
    .where(eq(feedbackItems.workspaceId, workspace.id))
    .orderBy(desc(feedbackItems.createdAt), desc(feedbackItems.id)).limit(5001);

  if (rows.length > 5000) error(422, 'This workspace exceeds the 5,000-item export limit.');
  const lines = rows.map((row) => [row.id, row.title, row.description, row.product ?? '', row.createdAt.toISOString()]
    .map(cell).join(','));
  const csv = ['ID,Title,Description,Product,Submitted UTC', ...lines].join('\r\n') + '\r\n';
  return new Response(csv, {
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': `attachment; filename="${workspace.slug}-feedback.csv"`,
      'cache-control': 'private, no-store',
      'x-content-type-options': 'nosniff'
    }
  });
};
