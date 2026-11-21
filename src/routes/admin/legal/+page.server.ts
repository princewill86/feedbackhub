import { fail } from '@sveltejs/kit';
import { sql } from 'drizzle-orm';
import { requirePlatformAdministrator } from '$lib/server/access';
import { getDb } from '$lib/server/db';
import { isLegalDocument, legalKey, loadLegalDocument } from '$lib/server/legal';
import { platformAudit, platformSettings } from '$lib/server/schema';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ request, setHeaders }) => {
  setHeaders({ 'cache-control': 'private, no-store' });
  await requirePlatformAdministrator(request);
  const [terms, privacy] = await Promise.all([loadLegalDocument('terms'), loadLegalDocument('privacy')]);
  return { terms, privacy };
};

export const actions: Actions = {
  save: async ({ request }) => {
    const administrator = await requirePlatformAdministrator(request);
    const form = await request.formData();
    const kind = form.get('document');
    const input = form.get('body');
    const body = typeof input === 'string' ? input.trim() : '';
    if (!isLegalDocument(kind) || !body || body.length > 24000) {
      return fail(400, { message: 'Enter document text of up to 24,000 characters.' });
    }
    await getDb().transaction(async (tx) => {
      await tx.insert(platformSettings).values({ key: legalKey(kind), value: body })
        .onConflictDoUpdate({ target: platformSettings.key, set: { value: body, updatedAt: sql`now()` } });
      await tx.insert(platformAudit).values({
        id: crypto.randomUUID(), actorId: administrator.id, action: 'Updated legal page', target: kind
      });
    });
    return { message: 'Legal page saved.' };
  }
};
