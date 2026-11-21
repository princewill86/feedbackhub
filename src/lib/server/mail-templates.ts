import { inArray } from 'drizzle-orm';
import { getDb } from './db';
import { enqueueMail } from './mail-queue';
import { platformSettings } from './schema';

export const templates = {
  verify: {
    label: 'Email verification',
    subject: 'Verify your FeedbackHub email',
    body: 'Verify your email address: {{link}}'
  },
  reset: {
    label: 'Password reset',
    subject: 'Reset your FeedbackHub password',
    body: 'Reset your password: {{link}}'
  },
  invitation: {
    label: 'Workspace invitation',
    subject: 'Your FeedbackHub workspace invitation',
    body: 'You have been invited to join {{workspace}}. Open {{link}} within seven days to accept.'
  }
} as const;

export type TemplateKind = keyof typeof templates;
export const templateKinds = Object.keys(templates) as TemplateKind[];
export const templateKey = (kind: TemplateKind, field: 'subject' | 'body') => `mail.${kind}.${field}`;

export async function loadMailTemplate(kind: TemplateKind, db = getDb()) {
  const subjectKey = templateKey(kind, 'subject');
  const bodyKey = templateKey(kind, 'body');
  const rows = await db.select({ key: platformSettings.key, value: platformSettings.value })
    .from(platformSettings).where(inArray(platformSettings.key, [subjectKey, bodyKey]));
  return {
    subject: rows.find((row) => row.key === subjectKey)?.value ?? templates[kind].subject,
    body: rows.find((row) => row.key === bodyKey)?.value ?? templates[kind].body
  };
}

export function validMailTemplate(kind: TemplateKind, subject: string, body: string) {
  if (!subject || subject.length > 120 || /[\u0000-\u001f\u007f{}]/u.test(subject)) return false;
  if (!body || body.length > 5000 || !body.includes('{{link}}')) return false;
  const literal = body.replaceAll('{{link}}', '').replaceAll(kind === 'invitation' ? '{{workspace}}' : '{{link}}', '');
  return !/[{}\u0000]/u.test(literal);
}

export function renderMailBody(body: string, link: string, workspace = '') {
  return body.replace(/\{\{(link|workspace)\}\}/g, (_, name) => name === 'link' ? link : workspace);
}

export async function queueTemplate(kind: TemplateKind, recipient: string, link: string, workspace?: string) {
  const { subject, body } = await loadMailTemplate(kind);
  await enqueueMail(kind, { recipient, subject, body: renderMailBody(body, link, workspace) });
}
