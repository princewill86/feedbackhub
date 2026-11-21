import { hasWorkspaceFeature } from '$lib/server/entitlements';
import { env } from '$env/dynamic/private';
import { error, fail, redirect } from '@sveltejs/kit';
import { and, eq } from 'drizzle-orm';
import { getDb } from '$lib/server/db';
import { feedbackWidgets, workspaceMembers } from '$lib/server/schema';
import { requireWorkspace } from '$lib/server/workspaces';
import type { Actions, PageServerLoad } from './$types';

async function owner(request: Request, slug: string) {
  const access = await requireWorkspace(request, slug);
  if (access.role !== 'owner') error(403, 'Workspace owner access required.');
  return access;
}

export const load: PageServerLoad = async ({ request, params, url, setHeaders }) => {
  setHeaders({ 'cache-control': 'private, no-store' });
  const { workspace } = await owner(request, params.slug);
  const [widget] = await getDb().select({
    id: feedbackWidgets.id, origins: feedbackWidgets.origins, enabled: feedbackWidgets.enabled
  }).from(feedbackWidgets).where(eq(feedbackWidgets.workspaceId, workspace.id));
  return { slug: workspace.slug, widget, embedUrl: widget ? new URL('/widgets/' + widget.id, env.BETTER_AUTH_URL ?? url.origin).href : null };
};

export const actions: Actions = {
  save: async ({ request, params }) => {
    const { workspace, user } = await owner(request, params.slug);
    const form = await request.formData();
    const raw = form.get('origins');
    const enabled = form.get('enabled') === 'on';
    const rotate = form.get('intent') === 'rotate';
    const origins = typeof raw === 'string' && raw.length <= 3000 ? raw.split(/\s+/).filter(Boolean) : null;
    if (!origins || origins.length > 15 || (enabled && !origins.length) || origins.some((value) => {
      try {
        const url = new URL(value);
        return url.protocol !== 'https:' || url.origin !== value || !/^https:\/\/[a-z0-9.:-]+$/i.test(value);
      } catch { return true; }
    })) {
      return fail(400, { message: 'Enter up to 15 exact HTTPS origins, such as https://example.com.' });
    }
    await getDb().transaction(async (tx) => {
      const [member] = await tx.select({ role: workspaceMembers.role }).from(workspaceMembers)
        .where(and(eq(workspaceMembers.workspaceId, workspace.id), eq(workspaceMembers.userId, user.id))).for('share');
      if (member?.role !== 'owner') error(403, 'Workspace owner access required.');
      if (enabled && !await hasWorkspaceFeature(workspace.id, 'widgetEnabled', tx)) error(403, 'The widget is unavailable on this plan.');
      const id = crypto.randomUUID();
      const values = { origins: [...new Set(origins)], enabled };
      await tx.insert(feedbackWidgets).values({ ...values, id, workspaceId: workspace.id }).onConflictDoUpdate({
        target: feedbackWidgets.workspaceId,
        set: { ...values, ...(rotate ? { id } : {}) }
      });
    });
    redirect(303, `/workspaces/${workspace.slug}/widget`);
  }
};
