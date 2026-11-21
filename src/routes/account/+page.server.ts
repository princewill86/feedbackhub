import { redirect } from '@sveltejs/kit';
import { getAuth } from '$lib/server/auth';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ request, setHeaders }) => {
  setHeaders({ 'cache-control': 'private, no-store' });
  if (!request.headers.has('cookie')) redirect(303, '/auth/sign-in');

  const session = await getAuth().api.getSession({ headers: request.headers });
  if (!session) redirect(303, '/auth/sign-in');

  return { name: session.user.name, email: session.user.email };
};

export const actions: Actions = {
  signOut: async ({ request }) => {
    await getAuth().api.signOut({ headers: request.headers });
    redirect(303, '/auth/sign-in');
  }
};
