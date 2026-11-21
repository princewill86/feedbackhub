import { fail } from '@sveltejs/kit';
import { desc, sql } from 'drizzle-orm';
import { requirePlatformAdministrator } from '$lib/server/access';
import { getDb } from '$lib/server/db';
import { loadPlatformSettings, settingFields } from '$lib/server/platform';
import { platformAudit, platformSettings, user } from '$lib/server/schema';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ request, setHeaders }) => {
  setHeaders({ 'cache-control': 'private, no-store' });
  await requirePlatformAdministrator(request);
  const db = getDb();
  const [settings, accounts, activity] = await Promise.all([
    loadPlatformSettings(),
    db.select({ name: user.name, email: user.email, createdAt: user.createdAt })
      .from(user).orderBy(desc(user.createdAt), desc(user.id)).limit(25),
    db.select({ action: platformAudit.action, target: platformAudit.target, createdAt: platformAudit.createdAt })
      .from(platformAudit).orderBy(desc(platformAudit.createdAt), desc(platformAudit.id)).limit(25)
  ]);

  return { settings, accounts, activity, fields: settingFields };
};

export const actions: Actions = {
  save: async ({ request }) => {
    const actor = await requirePlatformAdministrator(request);
    const form = await request.formData();
    const values: (typeof platformSettings.$inferInsert)[] = [];
    for (const field of settingFields) {
      const input = form.get(field.key);
      const value = typeof input === 'string' ? input.trim() : '';
      if (!value || value.length > field.maximum) {
        return fail(400, { message: `${field.label} must contain 1–${field.maximum} characters.` });
      }
      values.push({ key: field.key, value });
    }

    // Settings and their audit record must describe the same successful write.
    await getDb().transaction(async (tx) => {
      await tx.insert(platformSettings).values(values).onConflictDoUpdate({
        target: platformSettings.key,
        set: { value: sql`excluded.value`, updatedAt: sql`now()` }
      });
      await tx.insert(platformAudit).values({
        id: crypto.randomUUID(), actorId: actor.id, action: 'Updated settings', target: 'Public website'
      });
    });
    return { message: 'Settings saved.' };
  }
};
