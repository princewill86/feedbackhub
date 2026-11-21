import { canCreateProduct } from '$lib/server/entitlements';
import { error, fail } from '@sveltejs/kit';
import { and, asc, eq, sql } from 'drizzle-orm';
import { getDb } from '$lib/server/db';
import { products, workspaceMembers } from '$lib/server/schema';
import { requireWorkspace } from '$lib/server/workspaces';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ request, params, setHeaders }) => {
  setHeaders({ 'cache-control': 'private, no-store' });
  const { workspace, role } = await requireWorkspace(request, params.slug);
  const entries = await getDb().select({ id: products.id, slug: products.slug, name: products.name, description: products.description, archivedAt: products.archivedAt })
    .from(products).where(eq(products.workspaceId, workspace.id)).orderBy(asc(products.name), asc(products.slug));
  return { entries, slug: workspace.slug, editable: role === 'owner' || role === 'administrator' };
};

export const actions: Actions = {
  save: async ({ request, params }) => {
    const { workspace, user, role } = await requireWorkspace(request, params.slug);
    if (role !== 'owner' && role !== 'administrator') error(403, 'Product management access required.');
    const form = await request.formData();
    const id = form.get('id');
    if (id !== null && (typeof id !== 'string' || id.length > 64)) return fail(400, { message: 'Invalid product.' });
    const name = form.get('name');
    const slug = form.get('slug');
    const description = form.get('description');
    if (typeof name !== 'string' || !name.trim() || name.length > 80 ||
        typeof slug !== 'string' || slug.length > 64 || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) ||
        typeof description !== 'string' || description.length > 500) {
      return fail(400, { message: 'Enter a name, a lowercase URL slug, and an optional description.' });
    }

    const added = await getDb().transaction(async (tx) => {
      const [member] = await tx.select({ role: workspaceMembers.role }).from(workspaceMembers)
        .where(and(eq(workspaceMembers.workspaceId, workspace.id), eq(workspaceMembers.userId, user.id))).for('share');
      await tx.execute(sql`select id from workspaces where id = ${workspace.id} for update`);
      if (member?.role !== 'owner' && member?.role !== 'administrator') error(403, 'Product management access required.');
      const values = { name: name.trim(), slug, description: description.trim() };
      const [conflict] = await tx.select({ id: products.id }).from(products)
        .where(and(eq(products.workspaceId, workspace.id), eq(products.slug, slug)));
      if (conflict && conflict.id !== id) return false;
      if (typeof id === 'string') {
        const [updated] = await tx.update(products).set(values)
          .where(and(eq(products.workspaceId, workspace.id), eq(products.id, id))).returning({ id: products.id });
        if (!updated) error(404, 'Product not found.');
        return true;
      }
      if (!await canCreateProduct(tx, workspace.id)) return 'limit';
      const [product] = await tx.insert(products).values({
        ...values, workspaceId: workspace.id, id: crypto.randomUUID()
      }).onConflictDoNothing().returning({ id: products.id });
      return Boolean(product);
    });
    if (added === 'limit') return fail(409, { message: 'The workspace has reached its product limit.' });
    return added ? { message: 'Product saved.' } : fail(409, { message: 'That product slug is already in use.' });
  },
  archive: async ({ request, params }) => {
    const { workspace, user, role } = await requireWorkspace(request, params.slug);
    if (role !== 'owner' && role !== 'administrator') error(403, 'Product management access required.');
    const form = await request.formData();
    const id = form.get('id');
    const intent = form.get('intent');
    if (typeof id !== 'string' || id.length > 64 || (intent !== 'archive' && intent !== 'restore')) {
      return fail(400, { message: 'Choose a product and archive action.' });
    }
    await getDb().transaction(async (tx) => {
      const [member] = await tx.select({ role: workspaceMembers.role }).from(workspaceMembers)
        .where(and(eq(workspaceMembers.workspaceId, workspace.id), eq(workspaceMembers.userId, user.id))).for('share');
      if (member?.role !== 'owner' && member?.role !== 'administrator') error(403, 'Product management access required.');
      const [updated] = await tx.update(products).set({ archivedAt: intent === 'archive' ? sql`now()` : null })
        .where(and(eq(products.workspaceId, workspace.id), eq(products.id, id))).returning({ id: products.id });
      if (!updated) error(404, 'Product not found.');
    });
    return { message: intent === 'archive' ? 'Product archived.' : 'Product restored.' };
  }
};
