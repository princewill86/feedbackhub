import { minimumPasswordLength } from '$lib/password';
import { getRequestEvent } from '$app/server';
import { env } from '$env/dynamic/private';
import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { sveltekitCookies } from 'better-auth/svelte-kit';
import { getDb } from './db';
import { mailEnabled } from './mail';
import { queueTemplate } from './mail-templates';
import * as schema from './schema';

function createAuth() {
  const { DATABASE_URL, BETTER_AUTH_SECRET, BETTER_AUTH_URL } = env;
  if (!DATABASE_URL || !BETTER_AUTH_URL || !BETTER_AUTH_SECRET || BETTER_AUTH_SECRET.length < 32) {
    throw new Error('Configure DATABASE_URL, BETTER_AUTH_URL and a strong BETTER_AUTH_SECRET.');
  }

  const emailEnabled = mailEnabled();
  return betterAuth({
    appName: 'FeedbackHub',
    baseURL: BETTER_AUTH_URL,
    secret: BETTER_AUTH_SECRET,
    database: drizzleAdapter(getDb(), { provider: 'pg', schema, transaction: true }),
    emailAndPassword: {
      enabled: true,
      minPasswordLength: minimumPasswordLength,
      requireEmailVerification: emailEnabled,
      revokeSessionsOnPasswordReset: true,
      sendResetPassword: emailEnabled ? async ({ user, url }) => {
        try {
          await queueTemplate('reset', user.email, url);
        } catch {
          console.error('FeedbackHub password reset email could not be queued.');
        }
      } : undefined
    },
    emailVerification: emailEnabled ? {
      sendOnSignUp: true,
      sendOnSignIn: true,
      sendVerificationEmail: async ({ user, url }) => {
        try {
          await queueTemplate('verify', user.email, url);
        } catch {
          console.error('FeedbackHub verification email could not be queued.');
        }
      }
    } : undefined,
    rateLimit: { enabled: true },
    plugins: [sveltekitCookies(getRequestEvent)]
  });
}

let auth: ReturnType<typeof createAuth> | undefined;

export function getAuth() {
  return auth ??= createAuth();
}
