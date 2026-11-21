import { error } from '@sveltejs/kit';
import { mailEnabled } from '$lib/server/mail';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = ({ params }) => {
  if (params.mode !== 'register' && params.mode !== 'sign-in') error(404, 'Page not found');
  return { register: params.mode === 'register', emailEnabled: mailEnabled() };
};
