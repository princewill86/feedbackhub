import { error } from '@sveltejs/kit';
import { and, eq } from 'drizzle-orm';
import { requireUser } from './access';
import { getDb } from './db';
import { workspaceMembers, workspaces } from './schema';

export async function requireWorkspace(request: Request, slug: string) {
  const user = await requireUser(request);
  // Resolve tenancy and membership together, so a private slug reveals no data to nonmembers.
  const [membership] = await getDb().select({ workspace: workspaces, role: workspaceMembers.role })
    .from(workspaces).innerJoin(workspaceMembers, eq(workspaces.id, workspaceMembers.workspaceId))
    .where(and(eq(workspaces.slug, slug), eq(workspaceMembers.userId, user.id))).limit(1);
  if (!membership) error(404, 'Workspace not found.');
  return { ...membership, user };
}

export function canManageFeedback(role: typeof workspaceMembers.$inferSelect.role) {
  return role === 'owner' || role === 'administrator' || role === 'manager';
}
