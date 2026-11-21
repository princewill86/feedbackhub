import { containsPattern } from '$lib/server/feedback-search';
import { canCreateFeedback } from '$lib/server/entitlements';
import { enqueueWebhook } from '$lib/server/webhooks';
import { error, fail, redirect } from '@sveltejs/kit';
import { and, asc, desc, eq, ilike, isNull, or } from 'drizzle-orm';
import { getDb } from '$lib/server/db';
import { feedbackItems, products, workspaceMembers, workspaces } from '$lib/server/schema';
import { canManageFeedback, requireWorkspace } from '$lib/server/workspaces';
import type { Actions, PageServerLoad } from './$types';

const pageSize = 20;

export const load: PageServerLoad = async ({ request, params, url, setHeaders }) => {
  setHeaders({ 'cache-control': 'private, no-store' });
  const { workspace, role } = await requireWorkspace(request, params.slug);
  const productFilter = url.searchParams.get('product') ?? '';
  if (productFilter.length > 64) error(400, 'Invalid product filter.');
  const query = (url.searchParams.get('q') ?? '').trim();
  if (query.length > 140) error(400, 'Search must contain at most 140 characters.');
  const pattern = containsPattern(query);
  const page = Number(url.searchParams.get('page') ?? 1);
  if (!Number.isInteger(page) || page < 1 || page > 1000) error(400, 'Invalid feedback page.');

  const db = getDb();
  const entries = await db.select({ id: products.id, name: products.name, archivedAt: products.archivedAt }).from(products)
    .where(eq(products.workspaceId, workspace.id)).orderBy(asc(products.name), asc(products.id));
  const items = await db.select({
    id: feedbackItems.id,
    title: feedbackItems.title,
    description: feedbackItems.description,
    createdAt: feedbackItems.createdAt, product: products.name
  }).from(feedbackItems).leftJoin(products, and(eq(products.workspaceId, feedbackItems.workspaceId),
    eq(products.id, feedbackItems.productId))).where(and(
    eq(feedbackItems.workspaceId, workspace.id),
    productFilter ? eq(feedbackItems.productId, productFilter) : undefined,
    query ? or(ilike(feedbackItems.title, pattern), ilike(feedbackItems.description, pattern)) : undefined
  ))
    .orderBy(desc(feedbackItems.createdAt), desc(feedbackItems.id))
    .limit(pageSize + 1).offset((page - 1) * pageSize);

  return {
    publicBoard: workspace.publicBoard, slug: workspace.slug, name: workspace.name, description: workspace.description, role, canManage: canManageFeedback(role),
    items: items.slice(0, pageSize), products: entries, productFilter, query, page, hasNext: page < 1000 && items.length > pageSize
  };
};

export const actions: Actions = {
  visibility: async ({ request, params }) => {
    const { workspace, user, role } = await requireWorkspace(request, params.slug);
    if (role !== 'owner') error(403, 'Workspace owner access required.');
    const intent = (await request.formData()).get('visibility');
    if (intent !== 'public' && intent !== 'private') return fail(400, { message: 'Choose a visibility setting.', title: '', description: '' });
    await getDb().transaction(async (tx) => {
      const [member] = await tx.select({ role: workspaceMembers.role }).from(workspaceMembers)
        .where(and(eq(workspaceMembers.workspaceId, workspace.id), eq(workspaceMembers.userId, user.id))).for('share');
      if (member?.role !== 'owner') error(403, 'Workspace owner access required.');
      await tx.update(workspaces).set({ publicBoard: intent === 'public' }).where(eq(workspaces.id, workspace.id));
    });
    redirect(303, `/workspaces/${workspace.slug}`);
  },
  submit: async ({ request, params }) => {
    const { workspace, user, role } = await requireWorkspace(request, params.slug);
    if (role === 'viewer') error(403, 'This workspace role cannot submit feedback.');
    const form = await request.formData();
    const rawProduct = form.get('product');
    const productId = typeof rawProduct === 'string' && rawProduct ? rawProduct : null;
    const rawTitle = form.get('title');
    const rawDescription = form.get('description');
    const title = typeof rawTitle === 'string' ? rawTitle.trim() : '';
    const description = typeof rawDescription === 'string' ? rawDescription.trim() : '';
    if (title.length < 3 || title.length > 140 || !description || description.length > 5000) {
      return fail(400, { message: 'Enter a title of 3–140 characters and a description of 1–5,000 characters.', title, description });
    }

    // Lock membership before writing so revocation and submission have a consistent order.
    if (productId && productId.length > 64) return fail(400, { message: 'Choose a valid product.', title, description });

    const created = await getDb().transaction(async (tx) => {
      const [membership] = await tx.select({ role: workspaceMembers.role }).from(workspaceMembers)
        .where(and(eq(workspaceMembers.workspaceId, workspace.id), eq(workspaceMembers.userId, user.id)))
        .for('share');
      if (!membership || membership.role === 'viewer') error(403, 'Feedback submission is unavailable.');
      if (!await canCreateFeedback(tx, workspace.id)) return 'limit';
      if (productId) {
        const [product] = await tx.select({ id: products.id }).from(products)
          .where(and(eq(products.workspaceId, workspace.id), eq(products.id, productId), isNull(products.archivedAt))).for('share');
        if (!product) return 'invalid-product';
      }
      const id = crypto.randomUUID();
      await tx.insert(feedbackItems).values({ id, workspaceId: workspace.id, authorId: user.id, title, description, productId });
      await enqueueWebhook(tx, workspace.id, 'feedback.created', id);
      return true;
    });

    if (created === 'limit') return fail(409, { message: 'The workspace has reached its feedback limit.', title, description });
    if (created === 'invalid-product') return fail(400, { message: 'Choose a product from this workspace.', title, description });
    redirect(303, `/workspaces/${params.slug}`);
  }
};
