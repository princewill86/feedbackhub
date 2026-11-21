import { error } from '@sveltejs/kit';
import { mailEnabled } from '$lib/server/mail';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = ({ url, setHeaders }) => {
  if (!mailEnabled()) error(404, 'Account recovery is unavailable.');
  setHeaders({ 'cache-control': 'private, no-store', 'referrer-policy': 'no-referrer' });
  const token = url.searchParams.get('token');
  return { token: token && token.length <= 256 ? token : null };
};
