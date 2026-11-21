import { eq } from 'drizzle-orm';
import { getAuth } from '$lib/server/auth';
import { getDb } from '$lib/server/db';
import { platformAdministrators } from '$lib/server/schema';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ request, url, depends }) => {
  depends('app:session');
  if (url.pathname.startsWith('/widgets/') || !request.headers.has('cookie')) return { account: null };
  const session = await getAuth().api.getSession({ headers: request.headers });
  if (!session) return { account: null };
  const [administrator] = await getDb().select({ id: platformAdministrators.userId }).from(platformAdministrators)
    .where(eq(platformAdministrators.userId, session.user.id));
  return { account: { name: session.user.name, administrator: Boolean(administrator) } };
};
