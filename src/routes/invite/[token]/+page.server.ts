import { canAddMember } from '$lib/server/entitlements';
import { createHash } from 'node:crypto';
import { error, redirect } from '@sveltejs/kit';
import { and, eq, gt, isNull, sql } from 'drizzle-orm';
import { getAuth } from '$lib/server/auth';
import { requireUser } from '$lib/server/access';
import { getDb } from '$lib/server/db';
import { workspaceInvitations, workspaceMembers, workspaces } from '$lib/server/schema';
import type { Actions, PageServerLoad } from './$types';

function activeInvitation(token: string) {
  if (!/^[A-Za-z0-9_-]{43}$/.test(token)) error(404, 'Invitation unavailable.');
  return and(eq(workspaceInvitations.digest, createHash('sha256').update(token).digest('hex')),
    isNull(workspaceInvitations.acceptedAt), gt(workspaceInvitations.expiresAt, sql`now()`));
}

export const load: PageServerLoad = async ({ request, params, setHeaders }) => {
  setHeaders({ 'cache-control': 'private, no-store', 'referrer-policy': 'no-referrer', 'x-robots-tag': 'noindex' });
  const [invitation] = await getDb().select({ name: workspaces.name, email: workspaceInvitations.email })
    .from(workspaceInvitations).innerJoin(workspaces, eq(workspaces.id, workspaceInvitations.workspaceId))
    .where(activeInvitation(params.token));
  if (!invitation) error(404, 'Invitation unavailable.');
  const session = request.headers.has('cookie') ? await getAuth().api.getSession({ headers: request.headers }) : null;
  return { name: invitation.name, signedIn: Boolean(session), eligible: session?.user.email.toLowerCase() === invitation.email };
};

export const actions: Actions = {
  accept: async ({ request, params }) => {
    const user = await requireUser(request);
    const slug = await getDb().transaction(async (tx) => {
      const [invitation] = await tx.select().from(workspaceInvitations)
        .where(activeInvitation(params.token)).for('update');
      if (!invitation) error(404, 'Invitation unavailable.');
      if (user.email.toLowerCase() !== invitation.email) error(403, 'Sign in with the invited email address.');
      const [existing] = await tx.select({ userId: workspaceMembers.userId }).from(workspaceMembers)
        .where(and(eq(workspaceMembers.workspaceId, invitation.workspaceId), eq(workspaceMembers.userId, user.id)));
      if (!existing && !await canAddMember(tx, invitation.workspaceId)) error(409, 'The workspace has reached its member limit.');
      await tx.insert(workspaceMembers).values({
        workspaceId: invitation.workspaceId, userId: user.id, role: invitation.role
      }).onConflictDoNothing();
      await tx.update(workspaceInvitations).set({ acceptedAt: sql`now()` })
        .where(eq(workspaceInvitations.digest, invitation.digest));
      const [workspace] = await tx.select({ slug: workspaces.slug }).from(workspaces)
        .where(eq(workspaces.id, invitation.workspaceId));
      if (!workspace) error(404, 'Workspace unavailable.');
      return workspace.slug;
    });
    redirect(303, `/workspaces/${slug}`);
  }
};
