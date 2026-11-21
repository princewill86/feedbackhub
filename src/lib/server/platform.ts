import { getDb } from './db';
import { platformSettings } from './schema';

const defaults = {
  name: 'FeedbackHub',
  homepageTitle: 'Give customer feedback a place to go.',
  homepageDescription: 'Bring requests, ideas, and bugs into one place. See what customers care about and share what your team is building.',
  seoDescription: 'Collect customer feedback, prioritize requests, and share what your team is building.'
};

export const settingFields = [
  { key: 'name', label: 'Platform name', maximum: 80 },
  { key: 'homepageTitle', label: 'Homepage headline', maximum: 140 },
  { key: 'homepageDescription', label: 'Homepage introduction', maximum: 500 },
  { key: 'seoDescription', label: 'Search description', maximum: 200 }
] as const;

export async function loadPlatformSettings() {
  const rows = await getDb().select({ key: platformSettings.key, value: platformSettings.value })
    .from(platformSettings);
  const settings = { ...defaults };
  for (const { key } of settingFields) {
    const record = rows.find((row) => row.key === key);
    if (record) settings[key] = record.value;
  }
  return settings;
}
