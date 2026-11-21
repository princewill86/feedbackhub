import { enqueueWebhook } from '$lib/server/webhooks';
import { error, fail, redirect } from '@sveltejs/kit';
import { and, asc, count, desc, eq, isNull, sql } from 'drizzle-orm';
import { getDb } from '$lib/server/db';
import { feedbackComments, feedbackItems, feedbackStatusChanges, feedbackStatuses, feedbackVotes, notifications, user, workspaceMembers } from '$lib/server/schema';
import { canManageFeedback, requireWorkspace } from '$lib/server/workspaces';
import type { Actions, PageServerLoad } from './$types';

const pageSize = 25;
const itemScope = (workspaceId: string, id: string) => and(eq(feedbackItems.workspaceId, workspaceId), eq(feedbackItems.id, id));
const voteScope = (workspaceId: string, id: string) => and(eq(feedbackVotes.workspaceId, workspaceId), eq(feedbackVotes.feedbackId, id));

export const load: PageServerLoad = async ({ request, params, setHeaders, url }) => {
  setHeaders({ 'cache-control': 'private, no-store' });
  const { workspace, role, user: actor } = await requireWorkspace(request, params.slug);
  const page = Number(url.searchParams.get('page') ?? 1);
  if (!Number.isInteger(page) || page < 1 || page > 1000) error(400, 'Invalid comment page.');

  const db = getDb();
  const [item] = await db.select({ title: feedbackItems.title, description: feedbackItems.description, published: feedbackItems.published })
    .from(feedbackItems).where(itemScope(workspace.id, params.id)).limit(1);
  if (!item) error(404, 'Feedback not found.');

  const [[total], votes, comments, statuses, history] = await Promise.all([
    db.select({ value: count() }).from(feedbackVotes).where(voteScope(workspace.id, params.id)),
    db.select({ userId: feedbackVotes.userId }).from(feedbackVotes)
      .where(and(voteScope(workspace.id, params.id), eq(feedbackVotes.userId, actor.id))).limit(1),
    db.select({
      id: feedbackComments.id, body: feedbackComments.body, author: user.name, authorId: feedbackComments.authorId,
      createdAt: feedbackComments.createdAt, editedAt: feedbackComments.editedAt
    }).from(feedbackComments).leftJoin(user, eq(feedbackComments.authorId, user.id))
      .where(and(eq(feedbackComments.workspaceId, workspace.id), eq(feedbackComments.feedbackId, params.id), isNull(feedbackComments.removedAt)))
      .orderBy(desc(feedbackComments.createdAt), desc(feedbackComments.id))
      .limit(pageSize + 1).offset((page - 1) * pageSize),
    canManageFeedback(role) ? db.select({ id: feedbackStatuses.id, name: feedbackStatuses.name }).from(feedbackStatuses)
      .where(eq(feedbackStatuses.workspaceId, workspace.id)).orderBy(asc(feedbackStatuses.name)) : [],
    db.select({ id: feedbackStatusChanges.id, name: feedbackStatuses.name, at: feedbackStatusChanges.createdAt })
      .from(feedbackStatusChanges).innerJoin(feedbackStatuses, and(eq(feedbackStatuses.workspaceId, feedbackStatusChanges.workspaceId),
        eq(feedbackStatuses.id, feedbackStatusChanges.statusId)))
      .where(and(eq(feedbackStatusChanges.workspaceId, workspace.id), eq(feedbackStatusChanges.feedbackId, params.id)))
      .orderBy(desc(feedbackStatusChanges.createdAt), desc(feedbackStatusChanges.id)).limit(20)
  ]);

  return {
    item, statuses, history, canPublish: role === 'owner', slug: workspace.slug, writable: role !== 'viewer', votes: total.value,
    voted: votes.length > 0, comments: comments.slice(0, pageSize).map(({ authorId, ...comment }) => ({
      ...comment,
      canEdit: role !== 'viewer' && authorId === actor.id,
      canRemove: role !== 'viewer' && (authorId === actor.id || canManageFeedback(role))
    })), page,
    hasNext: page < 1000 && comments.length > pageSize
  };
};

async function mutate(request: Request, slug: string, id: string, action: 'vote' | 'comment') {
  const { workspace, user: actor } = await requireWorkspace(request, slug);
  const form = await request.formData();
  const rawBody = form.get('body');
  const body = typeof rawBody === 'string' ? rawBody.trim() : '';
  const intent = form.get('intent');
  if (action === 'comment' && (!body || body.length > 3000)) {
    return fail(400, { message: 'Enter a comment of 1–3,000 characters.' });
  }
  if (action === 'vote' && intent !== 'add' && intent !== 'remove') {
    return fail(400, { message: 'Choose whether to add or remove your vote.' });
  }

  await getDb().transaction(async (tx) => {
    // Lock the membership and feedback row until the write commits.
    const [member] = await tx.select({ role: workspaceMembers.role }).from(workspaceMembers)
      .where(and(eq(workspaceMembers.workspaceId, workspace.id), eq(workspaceMembers.userId, actor.id))).for('share');
    if (!member || member.role === 'viewer') error(403, 'This workspace role has read-only access.');
    const [item] = await tx.select({ id: feedbackItems.id, author: feedbackItems.authorId }).from(feedbackItems)
      .where(itemScope(workspace.id, id)).for('key share');
    if (!item) error(404, 'Feedback not found.');

    const key = { workspaceId: workspace.id, feedbackId: item.id };
    if (action === 'comment') {
      await tx.insert(feedbackComments).values({ ...key, id: crypto.randomUUID(), authorId: actor.id, body });
      await enqueueWebhook(tx, workspace.id, 'comment.created', item.id);
      if (item.author && item.author !== actor.id) {
        await tx.insert(notifications).values({ ...key, id: crypto.randomUUID(), recipientId: item.author, kind: 'comment' });
      }
    } else if (intent === 'add') {
      await tx.insert(feedbackVotes).values({ ...key, userId: actor.id }).onConflictDoNothing();
    } else {
      await tx.delete(feedbackVotes).where(and(voteScope(workspace.id, item.id), eq(feedbackVotes.userId, actor.id)));
    }
  });

  redirect(303, `/workspaces/${slug}/feedback/${id}`);
}

async function manageComment(request: Request, slug: string, feedbackId: string, remove: boolean) {
  const { workspace, user: actor } = await requireWorkspace(request, slug);
  const form = await request.formData();
  const id = form.get('commentId');
  const rawBody = form.get('body');
  const body = typeof rawBody === 'string' ? rawBody.trim() : '';
  if (typeof id !== 'string' || id.length > 64 || (!remove && (!body || body.length > 3000))) {
    return fail(400, { message: 'Choose a comment and provide up to 3,000 characters when editing.' });
  }

  await getDb().transaction(async (tx) => {
    const [member] = await tx.select({ role: workspaceMembers.role }).from(workspaceMembers)
      .where(and(eq(workspaceMembers.workspaceId, workspace.id), eq(workspaceMembers.userId, actor.id))).for('share');
    if (!member || member.role === 'viewer') error(403, 'Comment management access required.');
    const scope = and(eq(feedbackComments.workspaceId, workspace.id), eq(feedbackComments.feedbackId, feedbackId),
      eq(feedbackComments.id, id), isNull(feedbackComments.removedAt));
    const [comment] = await tx.select({ authorId: feedbackComments.authorId }).from(feedbackComments).where(scope).for('update');
    if (!comment) error(404, 'Comment not found.');
    if (comment.authorId !== actor.id && !(remove && canManageFeedback(member.role))) {
      error(403, 'Comment management access required.');
    }
    await tx.update(feedbackComments).set(remove ? { removedAt: sql`now()` } : { body, editedAt: sql`now()` }).where(scope);
  });

  redirect(303, `/workspaces/${slug}/feedback/${feedbackId}`);
}

export const actions: Actions = {
  editComment: ({ request, params }) => manageComment(request, params.slug, params.id, false),
  removeComment: ({ request, params }) => manageComment(request, params.slug, params.id, true),
  publish: async ({ request, params }) => {
    const { workspace, user: actor, role } = await requireWorkspace(request, params.slug);
    if (role !== 'owner') error(403, 'Workspace owner access required.');
    const intent = (await request.formData()).get('intent');
    if (intent !== 'publish' && intent !== 'hide') return fail(400, { message: 'Choose a publication action.' });
    await getDb().transaction(async (tx) => {
      const [member] = await tx.select({ role: workspaceMembers.role }).from(workspaceMembers)
        .where(and(eq(workspaceMembers.workspaceId, workspace.id), eq(workspaceMembers.userId, actor.id))).for('share');
      if (member?.role !== 'owner') error(403, 'Workspace owner access required.');
      const [updated] = await tx.update(feedbackItems).set({ published: intent === 'publish' })
        .where(itemScope(workspace.id, params.id)).returning({ id: feedbackItems.id });
      if (!updated) error(404, 'Feedback not found.');
    });
    redirect(303, `/workspaces/${workspace.slug}/feedback/${params.id}`);
  },
  vote: ({ request, params }) => mutate(request, params.slug, params.id, 'vote'),
  comment: ({ request, params }) => mutate(request, params.slug, params.id, 'comment'),
  status: async ({ request, params }) => {
    const { workspace, user: actor, role } = await requireWorkspace(request, params.slug);
    if (!canManageFeedback(role)) error(403, 'Feedback management access required.');
    const statusId = (await request.formData()).get('status');
    if (typeof statusId !== 'string' || statusId.length > 64) return fail(400, { message: 'Choose a status.' });
    const changed = await getDb().transaction(async (tx) => {
      const [member] = await tx.select({ role: workspaceMembers.role }).from(workspaceMembers)
        .where(and(eq(workspaceMembers.workspaceId, workspace.id), eq(workspaceMembers.userId, actor.id))).for('share');
      if (!member || !canManageFeedback(member.role)) error(403, 'Feedback management access required.');
      const [item] = await tx.select({ id: feedbackItems.id, author: feedbackItems.authorId }).from(feedbackItems)
        .where(itemScope(workspace.id, params.id)).for('update');
      if (!item) error(404, 'Feedback not found.');
      const [status] = await tx.select({ id: feedbackStatuses.id }).from(feedbackStatuses)
        .where(and(eq(feedbackStatuses.workspaceId, workspace.id), eq(feedbackStatuses.id, statusId)));
      if (!status) return false;
      const [latest] = await tx.select({ id: feedbackStatusChanges.statusId }).from(feedbackStatusChanges)
        .where(and(eq(feedbackStatusChanges.workspaceId, workspace.id), eq(feedbackStatusChanges.feedbackId, item.id)))
        .orderBy(desc(feedbackStatusChanges.createdAt), desc(feedbackStatusChanges.id)).limit(1);
      if (latest?.id !== status.id) {
        await tx.insert(feedbackStatusChanges).values({
          id: crypto.randomUUID(), workspaceId: workspace.id, feedbackId: item.id, statusId: status.id, actorId: actor.id,
          createdAt: sql`clock_timestamp()`
        });
        await enqueueWebhook(tx, workspace.id, 'feedback.status_changed', item.id);
        if (item.author && item.author !== actor.id) {
          await tx.insert(notifications).values({
            id: crypto.randomUUID(), workspaceId: workspace.id, feedbackId: item.id, recipientId: item.author, kind: 'status'
          });
        }
      }
      return true;
    });
    if (!changed) return fail(400, { message: 'Choose a status from this workspace.' });
    redirect(303, `/workspaces/${workspace.slug}/feedback/${params.id}`);
  }
};
