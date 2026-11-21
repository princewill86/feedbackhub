import { hasWorkspaceFeature } from '$lib/server/entitlements';
import { error, fail } from '@sveltejs/kit';
import { and, desc, eq, isNull, sql } from 'drizzle-orm';
import { createApiKey, digestApiKey } from '$lib/server/api';
import { getDb } from '$lib/server/db';
import { apiKeys, workspaceMembers } from '$lib/server/schema';
import { requireWorkspace } from '$lib/server/workspaces';
import type { Actions, PageServerLoad } from './$types';

async function requireOwner(request: Request, slug: string) {
  const access = await requireWorkspace(request, slug);
  if (access.role !== 'owner') error(403, 'Workspace owner access required.');
  return access;
}

export const load: PageServerLoad = async ({ request, params, setHeaders }) => {
  setHeaders({ 'cache-control': 'private, no-store' });
  const { workspace } = await requireOwner(request, params.slug);
  const entries = await getDb().select({
    id: apiKeys.id, name: apiKeys.name, canWrite: apiKeys.canWrite, revokedAt: apiKeys.revokedAt
  }).from(apiKeys).where(eq(apiKeys.workspaceId, workspace.id))
    .orderBy(desc(apiKeys.createdAt), desc(apiKeys.id)).limit(100);
  return { slug: workspace.slug, entries };
};

async function mutate(request: Request, slug: string, create: boolean) {
  const { workspace, user } = await requireOwner(request, slug);
  const form = await request.formData();
  const nameValue = form.get('name');
  const name = typeof nameValue === 'string' ? nameValue.trim() : '';
  const canWrite = form.get('scope') === 'write';
  const id = form.get('id');
  if (create && (!name || name.length > 80)) return fail(400, { message: 'Enter a key name of 1–80 characters.' });
  if (!create && (typeof id !== 'string' || id.length > 64)) return fail(400, { message: 'Choose a key.' });

  return getDb().transaction(async (tx) => {
    const [member] = await tx.select({ role: workspaceMembers.role }).from(workspaceMembers)
      .where(and(eq(workspaceMembers.workspaceId, workspace.id), eq(workspaceMembers.userId, user.id))).for('update');
    if (member?.role !== 'owner') error(403, 'Workspace owner access required.');

    if (create) {
      if (!await hasWorkspaceFeature(workspace.id, 'apiEnabled', tx)) error(403, 'API access is unavailable on this plan.');
      const keys = await tx.select({ id: apiKeys.id }).from(apiKeys)
        .where(and(eq(apiKeys.workspaceId, workspace.id), isNull(apiKeys.revokedAt))).limit(25);
      if (keys.length >= 25) return fail(409, { message: 'Revoke an active key before creating another.' });
      const secret = createApiKey();
      await tx.insert(apiKeys).values({
        id: crypto.randomUUID(), workspaceId: workspace.id, name, digest: digestApiKey(secret), canWrite
      });
      return { message: 'API key created. Copy it now.', secret };
    }

    if (typeof id !== 'string') error(400, 'Choose a key.');
    const [revoked] = await tx.update(apiKeys).set({ revokedAt: sql`now()` })
      .where(and(eq(apiKeys.workspaceId, workspace.id), eq(apiKeys.id, id), isNull(apiKeys.revokedAt)))
      .returning({ id: apiKeys.id });
    if (!revoked) error(404, 'Active key not found.');
    return { message: 'API key revoked.', secret: null };
  });
}

export const actions: Actions = {
  create: ({ request, params }) => mutate(request, params.slug, true),
  revoke: ({ request, params }) => mutate(request, params.slug, false)
};
