import { createCipheriv, createDecipheriv, createHmac, randomBytes, scryptSync } from 'node:crypto';
import { env } from '$env/dynamic/private';
import { and, eq, sql } from 'drizzle-orm';
import { getDb } from './db';
import { webhookDeliveries, webhooks } from './schema';

type Transaction = Parameters<Parameters<ReturnType<typeof getDb>['transaction']>[0]>[0];
type Event = 'feedback.created' | 'feedback.status_changed' | 'comment.created';

export function allowedWebhook(input: string) {
  try {
    const target = new URL(input);
    const allowed = (env.WEBHOOK_ALLOWED_URLS ?? '').split(/\s+/).filter(Boolean);
    return target.protocol === 'https:' && !target.username && !target.password && !target.hash &&
      !target.search && allowed.includes(target.href) ? target.href : null;
  } catch {
    return null;
  }
}

let key: Buffer | undefined;
function encryptionKey() {
  if (!env.BETTER_AUTH_SECRET || env.BETTER_AUTH_SECRET.length < 32) throw new Error('Missing webhook encryption secret.');
  return key ??= scryptSync(env.BETTER_AUTH_SECRET, 'FeedbackHub webhook signing secret', 32);
}

export function issueWebhookSecret(id: string) {
  const secret = randomBytes(32).toString('hex');
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', encryptionKey(), iv);
  cipher.setAAD(Buffer.from(id));
  const body = Buffer.concat([cipher.update(secret, 'utf8'), cipher.final()]);
  return { secret, encryptedSecret: Buffer.concat([iv, cipher.getAuthTag(), body]).toString('base64url') };
}

function readSecret(id: string, value: string) {
  const encrypted = Buffer.from(value, 'base64url');
  const decipher = createDecipheriv('aes-256-gcm', encryptionKey(), encrypted.subarray(0, 12));
  decipher.setAAD(Buffer.from(id));
  decipher.setAuthTag(encrypted.subarray(12, 28));
  return Buffer.concat([decipher.update(encrypted.subarray(28)), decipher.final()]).toString('utf8');
}

export async function enqueueWebhook(tx: Transaction, workspaceId: string, event: Event, feedbackId: string) {
  const targets = await tx.select({ id: webhooks.id }).from(webhooks)
    .where(and(eq(webhooks.workspaceId, workspaceId), eq(webhooks.disabled, false)));
  if (!targets.length) return;
  await tx.insert(webhookDeliveries).values(targets.map((target) => {
    const id = crypto.randomUUID();
    return { id, webhookId: target.id, event, body: JSON.stringify({ id, event, workspaceId, feedbackId }) };
  }));
}

export async function processWebhooks() {
  const db = getDb();
  await db.execute(sql`
    update webhook_deliveries set state = 'failed', lease = null
    where state = 'sending' and attempts >= 5 and available_at <= now()
  `);
  const jobs = await db.execute<{ id: string; webhook_id: string; body: string; attempts: number; lease: string }>(sql`
    update webhook_deliveries
    set state = 'sending', attempts = attempts + 1, available_at = now() + interval '2 minutes', lease = gen_random_uuid()::text
    where id in (
      select id from webhook_deliveries
      where state in ('pending', 'sending') and attempts < 5 and available_at <= now()
      order by available_at, id limit 5 for update skip locked
    )
    returning id, webhook_id, body, attempts, lease
  `);

  for (const job of jobs) {
    let accepted = false;
    let retryable = true;
    let status: number | null = null;
    try {
      const [target] = await db.select().from(webhooks).where(eq(webhooks.id, job.webhook_id));
      const url = target && !target.disabled ? allowedWebhook(target.url) : null;
      if (url) {
        const signingSecret = readSecret(target.id, target.encryptedSecret);
        const time = Math.floor(Date.now() / 1000).toString();
        const signature = createHmac('sha256', signingSecret).update(time + '.' + job.body).digest('hex');
        const response = await fetch(url, {
          method: 'POST', redirect: 'error', signal: AbortSignal.timeout(10000), body: job.body,
          headers: {
            'content-type': 'application/json', 'x-feedbackhub-delivery': job.id,
            'x-feedbackhub-timestamp': time, 'x-feedbackhub-signature': 'sha256=' + signature
          }
        });
        status = response.status;
        accepted = response.ok;
        retryable = status === 408 || status === 429 || status >= 500;
        await response.body?.cancel();
      } else retryable = false;
    } catch {
      console.error('FeedbackHub webhook delivery attempt failed.');
    }

    await db.update(webhookDeliveries).set({
      state: accepted ? 'sent' : retryable && job.attempts < 5 ? 'pending' : 'failed',
      httpStatus: status, lease: null,
      availableAt: sql`now() + (${2 ** (job.attempts - 1)} * interval '1 minute')`
    }).where(and(eq(webhookDeliveries.id, job.id), eq(webhookDeliveries.lease, job.lease)));
  }
}

let running = false;
export function startWebhookWorker() {
  if (running || !env.WEBHOOK_ALLOWED_URLS?.trim()) return;
  running = true;
  const poll = async () => {
    try { await processWebhooks(); }
    catch { console.error('FeedbackHub webhook queue poll failed.'); }
    finally { setTimeout(poll, 5000).unref(); }
  };
  setTimeout(poll, 0).unref();
}
