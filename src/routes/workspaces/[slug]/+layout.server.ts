import { canManageFeedback, requireWorkspace } from '$lib/server/workspaces';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ params, request }) => {
  const { workspace, role } = await requireWorkspace(request, params.slug);
  return { workspaceNavigation: { slug: workspace.slug, name: workspace.name, role, manager: canManageFeedback(role) } };
};
