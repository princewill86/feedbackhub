import { fail, redirect } from '@sveltejs/kit';
import { asc, eq } from 'drizzle-orm';
import { requireUser } from '$lib/server/access';
import { getDb } from '$lib/server/db';
import { workspaceMembers, workspaces } from '$lib/server/schema';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ request, setHeaders }) => {
  setHeaders({ 'cache-control': 'private, no-store' });
  const user = await requireUser(request);
  const entries = await getDb().select({ name: workspaces.name, slug: workspaces.slug, role: workspaceMembers.role })
    .from(workspaceMembers).innerJoin(workspaces, eq(workspaceMembers.workspaceId, workspaces.id))
    .where(eq(workspaceMembers.userId, user.id)).orderBy(asc(workspaces.name), asc(workspaces.slug));
  return { entries };
};

export const actions: Actions = {
  create: async ({ request }) => {
    const user = await requireUser(request);
    const form = await request.formData();
    const name = form.get('name')?.toString().trim() ?? '';
    const slug = form.get('slug')?.toString().trim().toLowerCase() ?? '';
    if (!name || name.length > 80 || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || slug.length > 64) {
      return fail(400, { message: 'Enter a name and a URL slug using lowercase letters, numbers, and single hyphens.' });
    }

    const id = crypto.randomUUID();
    const created = await getDb().transaction(async (tx) => {
      const [record] = await tx.insert(workspaces).values({ id, name, slug })
        .onConflictDoNothing({ target: workspaces.slug }).returning({ id: workspaces.id });
      if (!record) return false;
      await tx.insert(workspaceMembers).values({ workspaceId: record.id, userId: user.id, role: 'owner' });
      return true;
    });
    if (!created) return fail(409, { message: 'That URL slug is already in use.' });
    redirect(303, `/workspaces/${slug}`);
  }
};
