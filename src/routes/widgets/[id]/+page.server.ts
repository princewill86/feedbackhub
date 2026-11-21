import { canCreateFeedback, hasWorkspaceFeature } from '$lib/server/entitlements';
import { enqueueWebhook } from '$lib/server/webhooks';
import { error, fail, redirect } from '@sveltejs/kit';
import { and, eq, sql } from 'drizzle-orm';
import { getDb } from '$lib/server/db';
import { feedbackItems, feedbackWidgets, workspaces } from '$lib/server/schema';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, url, setHeaders }) => {
  const [widget] = await getDb().select({ workspaceId: workspaces.id, name: workspaces.name, origins: feedbackWidgets.origins })
    .from(feedbackWidgets).innerJoin(workspaces, eq(workspaces.id, feedbackWidgets.workspaceId))
    .where(and(eq(feedbackWidgets.id, params.id), eq(feedbackWidgets.enabled, true)));
  if (!widget || !await hasWorkspaceFeature(widget.workspaceId, 'widgetEnabled')) error(404, 'Widget unavailable.');
  setHeaders({
    'content-security-policy': `frame-ancestors 'self' ${widget.origins.join(' ')}`,
    'cache-control': 'no-store',
    'x-robots-tag': 'noindex'
  });
  return { name: widget.name, submitted: url.searchParams.get('sent') === '1' };
};

export const actions: Actions = {
  default: async ({ request, params }) => {
    const form = await request.formData();
    const field = (key: string) => {
      const value = form.get(key);
      return typeof value === 'string' ? value.trim() : '';
    };
    if (field('website')) redirect(303, `/widgets/${params.id}?sent=1`);
    const title = field('title');
    const description = field('description');
    if (title.length < 3 || title.length > 140 || !description || description.length > 5000) {
      return fail(400, { message: 'Enter a title of 3–140 characters and a description of 1–5,000 characters.' });
    }

    const result = await getDb().transaction(async (tx) => {
      const minute = sql`date_trunc('minute', now())`;
      const [widget] = await tx.update(feedbackWidgets).set({
        minute,
        submissions: sql`case when ${feedbackWidgets.minute} = ${minute} then ${feedbackWidgets.submissions} + 1 else 1 end`
      }).where(and(eq(feedbackWidgets.id, params.id), eq(feedbackWidgets.enabled, true),
        sql`(${feedbackWidgets.minute} is distinct from ${minute} or ${feedbackWidgets.submissions} < 10)`))
        .returning({ workspaceId: feedbackWidgets.workspaceId });
      if (!widget) {
        const [enabled] = await tx.select({ id: feedbackWidgets.id }).from(feedbackWidgets)
          .where(and(eq(feedbackWidgets.id, params.id), eq(feedbackWidgets.enabled, true)));
        return enabled ? 'limited' : 'unavailable';
      }
      if (!await hasWorkspaceFeature(widget.workspaceId, 'widgetEnabled', tx)) return 'unavailable';
      if (!await canCreateFeedback(tx, widget.workspaceId)) return 'quota';
      const id = crypto.randomUUID();
      await tx.insert(feedbackItems).values({ id, workspaceId: widget.workspaceId, title, description });
      await enqueueWebhook(tx, widget.workspaceId, 'feedback.created', id);
      return 'submitted';
    });

    if (result === 'unavailable') error(404, 'Widget unavailable.');
    if (result === 'quota') return fail(409, { message: 'This workspace cannot accept more feedback.' });
    if (result === 'limited') return fail(429, { message: 'Too many submissions. Try again in a minute.' });
    redirect(303, `/widgets/${params.id}?sent=1`);
  }
};
