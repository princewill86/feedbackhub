import { canAddMember } from '$lib/server/entitlements';
import { createHash, randomBytes } from 'node:crypto';
import { error, fail } from '@sveltejs/kit';
import { and, asc, eq, ne } from 'drizzle-orm';
import { env } from '$env/dynamic/private';
import { mailEnabled } from '$lib/server/mail';
import { queueTemplate } from '$lib/server/mail-templates';
import { getDb } from '$lib/server/db';
import { user, workspaceInvitations, workspaceMembers } from '$lib/server/schema';
import { requireWorkspace } from '$lib/server/workspaces';
import type { Actions, PageServerLoad } from './$types';

const assignable = ['administrator', 'manager', 'member', 'viewer'] as const;
type AssignableRole = (typeof assignable)[number];

function isAssignable(value: FormDataEntryValue | null): value is AssignableRole {
  return assignable.some((role) => role === value);
}

export const load: PageServerLoad = async ({ request, params, setHeaders }) => {
  setHeaders({ 'cache-control': 'private, no-store' });
  const { workspace, role } = await requireWorkspace(request, params.slug);
  if (role !== 'owner' && role !== 'administrator') error(403, 'Membership management access required.');
  const members = await getDb().select({ id: user.id, name: user.name, email: user.email, role: workspaceMembers.role })
    .from(workspaceMembers).innerJoin(user, eq(workspaceMembers.userId, user.id))
    .where(eq(workspaceMembers.workspaceId, workspace.id)).orderBy(asc(user.name), asc(user.id));
  return { name: workspace.name, slug: workspace.slug, members, owner: role === 'owner', roles: assignable };
};

async function changeMembership(request: Request, slug: string, action: 'add' | 'update' | 'remove') {
  const { workspace, user: actor, role } = await requireWorkspace(request, slug);
  if (role !== 'owner') error(403, 'Workspace owner access required.');
  const form = await request.formData();
  const proposedRole = form.get('role');
  const email = form.get('email');
  const target = form.get('userId');

  if (action !== 'remove' && !isAssignable(proposedRole)) return fail(400, { message: 'Select a workspace role.', invitation: null });
  if (action === 'add' && (typeof email !== 'string' || !email.trim() || email.length > 254)) {
    return fail(400, { message: 'Enter a registered email address.', invitation: null });
  }
  if (action !== 'add' && typeof target !== 'string') return fail(400, { message: 'Select a workspace member.', invitation: null });

  const result = await getDb().transaction(async (tx) => {
    const [grant] = await tx.select({ role: workspaceMembers.role }).from(workspaceMembers)
      .where(and(eq(workspaceMembers.workspaceId, workspace.id), eq(workspaceMembers.userId, actor.id))).for('update');
    if (grant?.role !== 'owner') error(403, 'Workspace owner access required.');

    if (action === 'add' && typeof email === 'string' && isAssignable(proposedRole)) {
      const [account] = await tx.select({ id: user.id }).from(user).where(eq(user.email, email.trim().toLowerCase())).limit(1);
      if (!account) return false;
      if (!await canAddMember(tx, workspace.id)) return 'limit';
      const [added] = await tx.insert(workspaceMembers).values({
        workspaceId: workspace.id, userId: account.id, role: proposedRole
      }).onConflictDoNothing().returning({ id: workspaceMembers.userId });
      return Boolean(added);
    }

    if (typeof target !== 'string') return false;
    const scope = and(eq(workspaceMembers.workspaceId, workspace.id), eq(workspaceMembers.userId, target), ne(workspaceMembers.role, 'owner'));
    if (action === 'remove') {
      const [removed] = await tx.delete(workspaceMembers).where(scope).returning({ id: workspaceMembers.userId });
      return Boolean(removed);
    }
    if (!isAssignable(proposedRole)) return false;
    const [updated] = await tx.update(workspaceMembers).set({ role: proposedRole }).where(scope).returning({ id: workspaceMembers.userId });
    return Boolean(updated);
  });

  if (result === 'limit') return fail(409, { message: 'The workspace has reached its member limit.', invitation: null });
  return result ? { message: 'Membership updated.', invitation: null } : fail(400, { message: 'Could not update that membership.', invitation: null });
}

export const actions: Actions = {
  invite: async ({ request, params }) => {
    const { workspace, user, role } = await requireWorkspace(request, params.slug);
    if (role !== 'owner') error(403, 'Workspace owner access required.');
    const form = await request.formData();
    const value = form.get('email');
    const email = typeof value === 'string' ? value.trim().toLowerCase() : '';
    const invitedRole = form.get('role');
    if (email.length > 254 || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || !isAssignable(invitedRole)) {
      return fail(400, { message: 'Enter an email address and select a role.', invitation: null });
    }

    const token = randomBytes(32).toString('base64url');
    await getDb().transaction(async (tx) => {
      const [grant] = await tx.select({ role: workspaceMembers.role }).from(workspaceMembers)
        .where(and(eq(workspaceMembers.workspaceId, workspace.id), eq(workspaceMembers.userId, user.id))).for('share');
      if (grant?.role !== 'owner') error(403, 'Workspace owner access required.');
      await tx.insert(workspaceInvitations).values({
        digest: createHash('sha256').update(token).digest('hex'), workspaceId: workspace.id, email,
        role: invitedRole, expiresAt: new Date(Date.now() + 7 * 86400000)
      });
    });

    const invitation = `/invite/${token}`;
    if (mailEnabled() && env.BETTER_AUTH_URL) {
      try {
        const link = new URL(invitation, env.BETTER_AUTH_URL).href;
        await queueTemplate('invitation', email, link, workspace.name);
        return { message: 'Invitation email queued.', invitation };
      } catch {
        return { message: 'Invitation created. Email could not be queued. Share the link directly.', invitation };
      }
    }
    return { message: 'Invitation created. Share this link with the invitee.', invitation };
  },
  add: ({ request, params }) => changeMembership(request, params.slug, 'add'),
  update: ({ request, params }) => changeMembership(request, params.slug, 'update'),
  remove: ({ request, params }) => changeMembership(request, params.slug, 'remove')
};
