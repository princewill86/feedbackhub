import { and, eq } from 'drizzle-orm';
import { apiError, apiResponse, authorizeApi } from '$lib/server/api';
import { getDb } from '$lib/server/db';
import { feedbackItems } from '$lib/server/schema';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ request, params }) => {
  const access = await authorizeApi(request);
  if (access instanceof Response) return access;
  const [item] = await getDb().select({
    id: feedbackItems.id, title: feedbackItems.title, description: feedbackItems.description, createdAt: feedbackItems.createdAt
  }).from(feedbackItems)
    .where(and(eq(feedbackItems.workspaceId, access.workspaceId), eq(feedbackItems.id, params.id))).limit(1);
  return item ? apiResponse({ data: item }) : apiError(404, 'Feedback not found.');
};
