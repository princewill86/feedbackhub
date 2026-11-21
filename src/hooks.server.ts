import { startWebhookWorker } from '$lib/server/webhooks';
import { startMailWorker } from '$lib/server/mail-queue';
import { building } from '$app/environment';
import { getAuth } from '$lib/server/auth';
import type { Handle } from '@sveltejs/kit';
import { svelteKitHandler } from 'better-auth/svelte-kit';

export const handle: Handle = ({ event, resolve }) => {
  const path = event.url.pathname;
  if (building || (path !== '/api/auth' && !path.startsWith('/api/auth/'))) {
    return resolve(event);
  }

  return svelteKitHandler({ event, resolve, auth: getAuth(), building });
};

export function init() {
  if (!building) {
    startMailWorker();
    startWebhookWorker();
  }
}
