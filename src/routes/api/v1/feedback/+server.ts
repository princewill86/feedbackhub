import { canCreateFeedback } from '$lib/server/entitlements';
import { enqueueWebhook } from '$lib/server/webhooks';
import { desc, eq } from 'drizzle-orm';
import { apiError, apiResponse, authorizeApi } from '$lib/server/api';
import { getDb } from '$lib/server/db';
import { feedbackItems } from '$lib/server/schema';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ request, url }) => {
  const access = await authorizeApi(request);
  if (access instanceof Response) return access;
  const page = Number(url.searchParams.get('page') ?? 1);
  if (!Number.isInteger(page) || page < 1 || page > 1000) return apiError(400, 'Invalid page.');

  const rows = await getDb().select({
    id: feedbackItems.id, title: feedbackItems.title, description: feedbackItems.description, createdAt: feedbackItems.createdAt
  }).from(feedbackItems).where(eq(feedbackItems.workspaceId, access.workspaceId))
    .orderBy(desc(feedbackItems.createdAt), desc(feedbackItems.id)).limit(26).offset((page - 1) * 25);
  return apiResponse({ data: rows.slice(0, 25), page, hasNext: page < 1000 && rows.length > 25 });
};

export const POST: RequestHandler = async ({ request }) => {
  const access = await authorizeApi(request, true);
  if (access instanceof Response) return access;
  if (request.headers.get('content-type')?.split(';')[0].trim().toLowerCase() !== 'application/json') {
    return apiError(415, 'Send a JSON request.');
  }

  let payload: unknown;
  try { payload = await request.json(); } catch { return apiError(400, 'Invalid JSON.'); }
  if (!payload || typeof payload !== 'object' || !('title' in payload) || !('description' in payload)) {
    return apiError(400, 'Provide a title and description.');
  }
  const title = typeof payload.title === 'string' ? payload.title.trim() : '';
  const description = typeof payload.description === 'string' ? payload.description.trim() : '';
  if (title.length < 3 || title.length > 140 || !description || description.length > 5000) {
    return apiError(400, 'Enter a title of 3–140 characters and a description of 1–5,000 characters.');
  }

  const created = await getDb().transaction(async (tx) => {
    if (!await canCreateFeedback(tx, access.workspaceId)) return null;
    const id = crypto.randomUUID();
    const [item] = await tx.insert(feedbackItems).values({ id, workspaceId: access.workspaceId, title, description })
      .returning({ id: feedbackItems.id, title: feedbackItems.title, description: feedbackItems.description,
        createdAt: feedbackItems.createdAt });
    await enqueueWebhook(tx, access.workspaceId, 'feedback.created', id);
    return item;
  });
  return created ? apiResponse({ data: created }, 201) : apiError(409, 'The workspace has reached its feedback limit.');
};
