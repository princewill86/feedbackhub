import { error, redirect } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { getAuth } from './auth';
import { getDb } from './db';
import { platformAdministrators } from './schema';

export async function requireUser(request: Request) {
  if (!request.headers.has('cookie')) redirect(303, '/auth/sign-in');

  const session = await getAuth().api.getSession({ headers: request.headers });
  if (!session) redirect(303, '/auth/sign-in');

  return session.user;
}

export async function requirePlatformAdministrator(request: Request) {
  const user = await requireUser(request);
  const [grant] = await getDb().select({ userId: platformAdministrators.userId })
    .from(platformAdministrators).where(eq(platformAdministrators.userId, user.id)).limit(1);

  if (!grant) error(403, 'Platform administrator access required.');
  return user;
}
