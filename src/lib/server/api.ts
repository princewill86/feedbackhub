import { hasWorkspaceFeature } from './entitlements';
import { createHash, randomBytes } from 'node:crypto';
import { json } from '@sveltejs/kit';
import { and, eq, isNull, sql } from 'drizzle-orm';
import { getDb } from './db';
import { apiKeys, apiUsage } from './schema';

export function digestApiKey(secret: string) {
  return createHash('sha256').update(secret).digest('hex');
}

export function createApiKey() {
  return 'fh_' + randomBytes(32).toString('base64url');
}

export function apiResponse(payload: unknown, status = 200) {
  return json(payload, { status, headers: { 'cache-control': 'no-store' } });
}

export function apiError(status: number, message: string) {
  return apiResponse({ error: { message } }, status);
}

export async function authorizeApi(request: Request, write = false) {
  const secret = request.headers.get('authorization')?.match(/^Bearer (fh_[A-Za-z0-9_-]{43})$/i)?.[1];
  if (!secret) return apiError(401, 'A valid API key is required.');

  const db = getDb();
  const [key] = await db.select({ id: apiKeys.id, workspaceId: apiKeys.workspaceId, canWrite: apiKeys.canWrite })
    .from(apiKeys).where(and(eq(apiKeys.digest, digestApiKey(secret)), isNull(apiKeys.revokedAt))).limit(1);
  if (!key) return apiError(401, 'A valid API key is required.');
  if (!await hasWorkspaceFeature(key.workspaceId, 'apiEnabled', db)) return apiError(403, 'API access is unavailable on this plan.');

  const minute = sql`date_trunc('minute', now())`;
  const [usage] = await db.insert(apiUsage).values({ keyId: key.id, minute, requests: 1 }).onConflictDoUpdate({
    target: apiUsage.keyId,
    set: { minute, requests: sql`case when ${apiUsage.minute} = ${minute} then ${apiUsage.requests} + 1 else 1 end` },
    setWhere: sql`${apiUsage.minute} <> ${minute} or ${apiUsage.requests} < 120`
  }).returning({ requests: apiUsage.requests });
  if (!usage) return apiError(429, 'API rate limit exceeded.');
  if (write && !key.canWrite) return apiError(403, 'This API key has read-only access.');
  return key;
}
