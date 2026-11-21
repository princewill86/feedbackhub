import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'node:crypto';
import { env } from '$env/dynamic/private';
import { and, eq, inArray, lte, sql } from 'drizzle-orm';
import { getDb } from './db';
import { mailEnabled, sendAccountMail } from './mail';
import { mailJobs } from './schema';

type Kind = typeof mailJobs.$inferInsert.kind;
type Message = { recipient: string; subject: string; body: string };

let key: Buffer | undefined;
function queueKey() {
  if (!env.BETTER_AUTH_SECRET || env.BETTER_AUTH_SECRET.length < 32) throw new Error('A valid auth secret is required.');
  return key ??= scryptSync(env.BETTER_AUTH_SECRET, 'FeedbackHub email queue', 32);
}

function encrypt(id: string, message: Message) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', queueKey(), iv);
  cipher.setAAD(Buffer.from(id));
  const content = Buffer.concat([cipher.update(JSON.stringify(message)), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), content]).toString('base64url');
}

function decrypt(id: string, value: string): Message {
  const buffer = Buffer.from(value, 'base64url');
  const cipher = createDecipheriv('aes-256-gcm', queueKey(), buffer.subarray(0, 12));
  cipher.setAAD(Buffer.from(id));
  cipher.setAuthTag(buffer.subarray(12, 28));
  return JSON.parse(Buffer.concat([cipher.update(buffer.subarray(28)), cipher.final()]).toString('utf8'));
}

export async function enqueueMail(kind: Kind, message: Message) {
  const id = crypto.randomUUID();
  const lifetime = kind === 'invitation' ? 7 * 86400000 : 45 * 60000;
  await getDb().insert(mailJobs).values({
    id, kind, payload: encrypt(id, message), expiresAt: new Date(Date.now() + lifetime)
  });
}

const maxAttempts = 4;

export async function processMailJobs() {
  const db = getDb();
  await db.update(mailJobs).set({ status: 'failed', payload: null, completedAt: sql`now()`, leaseId: null })
    .where(and(inArray(mailJobs.status, ['pending', 'sending']), lte(mailJobs.availableAt, sql`now()`),
      sql`(${mailJobs.expiresAt} <= now() or ${mailJobs.attempts} >= ${maxAttempts})`));

  // A short lease lets another worker recover jobs if this process exits mid-delivery.
  const rows = await db.execute<{ id: string; payload: string; attempts: number; lease_id: string }>(sql`
    update mail_jobs
    set status = 'sending', available_at = now() + interval '2 minutes',
        attempts = attempts + 1, lease_id = gen_random_uuid()::text
    where id in (
      select id from mail_jobs
      where status in ('pending', 'sending') and available_at <= now()
        and expires_at > now() and attempts < ${maxAttempts} and payload is not null
      order by available_at, id limit 5 for update skip locked
    )
    returning id, payload, attempts, lease_id
  `);

  for (const job of rows) {
    let delivered = false;
    try {
      const message = decrypt(job.id, job.payload);
      await sendAccountMail(message.recipient, message.subject, message.body);
      delivered = true;
    } catch {
      console.error('FeedbackHub mail transport rejected a queued message.');
    }

    const complete = delivered || job.attempts >= maxAttempts;
    await db.update(mailJobs).set({
      status: delivered ? 'sent' : complete ? 'failed' : 'pending',
      payload: complete ? null : job.payload,
      completedAt: complete ? sql`now()` : null,
      availableAt: sql`now() + (${Math.pow(2, job.attempts - 1)} * interval '1 minute')`,
      leaseId: null
    }).where(and(eq(mailJobs.id, job.id), eq(mailJobs.leaseId, job.lease_id)));
  }
}

let running = false;
export function startMailWorker() {
  if (!mailEnabled() || env.MAIL_WORKER_ENABLED === 'false' || running) return;
  running = true;

  const poll = async () => {
    try {
      await processMailJobs();
    } catch {
      console.error('FeedbackHub mail queue poll failed.');
    } finally {
      setTimeout(poll, 5000).unref();
    }
  };
  setTimeout(poll, 0).unref();
}
