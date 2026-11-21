import { fail } from '@sveltejs/kit';
import { desc, sql } from 'drizzle-orm';
import { requirePlatformAdministrator } from '$lib/server/access';
import { getDb } from '$lib/server/db';
import { mailEnabled } from '$lib/server/mail';
import { loadMailTemplate, renderMailBody, templateKey, templateKinds, templates, validMailTemplate } from '$lib/server/mail-templates';
import { mailJobs, platformAudit, platformSettings } from '$lib/server/schema';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ request, setHeaders }) => {
  setHeaders({ 'cache-control': 'private, no-store' });
  await requirePlatformAdministrator(request);
  const entries = await Promise.all(templateKinds.map(async (kind) => {
    const { subject, body } = await loadMailTemplate(kind);
    return { kind, label: templates[kind].label, subject, body,
      preview: renderMailBody(body, 'https://example.com/sample-link', 'Example workspace') };
  }));
  const deliveries = await getDb().select({
    id: mailJobs.id, kind: mailJobs.kind, status: mailJobs.status,
    attempts: mailJobs.attempts, createdAt: mailJobs.createdAt
  }).from(mailJobs).orderBy(desc(mailJobs.createdAt), desc(mailJobs.id)).limit(50);
  return { entries, deliveries, enabled: mailEnabled() };
};

export const actions: Actions = {
  save: async ({ request }) => {
    const actor = await requirePlatformAdministrator(request);
    const form = await request.formData();
    const kind = templateKinds.find((key) => key === form.get('kind'));
    const rawSubject = form.get('subject');
    const rawBody = form.get('body');
    const subject = typeof rawSubject === 'string' ? rawSubject.trim() : '';
    const body = typeof rawBody === 'string' ? rawBody.trim() : '';
    if (!kind || !validMailTemplate(kind, subject, body)) {
      return fail(400, { message: 'Enter a subject up to 120 characters and a body up to 5,000 characters. Include {{link}} and use only the listed variables.' });
    }

    await getDb().transaction(async (tx) => {
      await tx.insert(platformSettings).values([
        { key: templateKey(kind, 'subject'), value: subject },
        { key: templateKey(kind, 'body'), value: body }
      ]).onConflictDoUpdate({
        target: platformSettings.key,
        set: { value: sql`excluded.value`, updatedAt: sql`now()` }
      });
      await tx.insert(platformAudit).values({
        id: crypto.randomUUID(), actorId: actor.id, action: 'Updated email template', target: templates[kind].label
      });
    });
    return { message: 'Email template saved.' };
  }
};
