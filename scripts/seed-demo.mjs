import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
import postgres from 'postgres';

const origin = new URL(process.env.DEMO_ORIGIN ?? 'http://127.0.0.1:5173');
if (!['127.0.0.1', 'localhost'].includes(origin.hostname) || !process.env.DATABASE_URL || process.env.DEMO_SEED !== 'local') {
  throw new Error('Use a local FeedbackHub server and set DEMO_SEED=local and DATABASE_URL.');
}

const id = randomBytes(4).toString('hex');
const slug = 'demo-' + id;
const accounts = [
  { name: 'Demo Platform Admin', role: 'admin' },
  { name: 'Demo Workspace Owner', role: 'owner' },
  { name: 'Demo Workspace Viewer', role: 'viewer' }
].map((account) => ({
  ...account, email: `${account.role}-${id}@feedbackhub.example`, password: randomBytes(24).toString('base64url')
}));
const [admin, owner, viewer] = accounts;
const output = process.env.DEMO_CREDENTIALS_FILE ?? '.env.demo';
await writeFile(output, accounts.map((account) =>
  `DEMO_${account.role.toUpperCase()}_EMAIL=${account.email}\nDEMO_${account.role.toUpperCase()}_PASSWORD=${account.password}`
).join('\n') + `\nDEMO_WORKSPACE_SLUG=${slug}\n`, { flag: 'wx', mode: 0o600 });

const db = postgres(process.env.DATABASE_URL, { max: 1 });
async function request(path, { json, form, cookie } = {}) {
  const headers = new Headers({ origin: origin.origin });
  if (cookie) headers.set('cookie', cookie);
  if (json) headers.set('content-type', 'application/json');
  if (form) headers.set('accept', 'text/html');
  return fetch(new URL(path, origin), {
    method: json || form ? 'POST' : 'GET',
    headers,
    body: json ? JSON.stringify(json) : form ? new URLSearchParams(form) : undefined,
    redirect: 'manual'
  });
}

try {
  for (const account of accounts) {
    const registered = await request('/api/auth/sign-up/email', {
      json: { name: account.name, email: account.email, password: account.password }
    });
    assert.equal(registered.status, 200, `Registration failed for ${account.role}.`);
    const session = registered.headers.getSetCookie().find((entry) => /better-auth\.session_token=/.test(entry));
    assert.ok(session, 'Disable outgoing mail when seeding these local demo accounts.');
    account.cookie = session.split(';')[0];
  }
  await db.begin(async (tx) => {
    const [identity] = await tx`select id from users where email = ${admin.email}`;
    await tx`insert into platform_administrators (user_id) values (${identity.id})`;
    await tx`insert into platform_audit (id, action, target)
      values (${randomUUID()}, 'Created local demo administrator', ${identity.id})`;
    await tx`update users set email_verified = true where email in ${tx(accounts.map((account) => account.email))}`;
  });

  const created = await request('/workspaces?/create', { cookie: owner.cookie, form: { name: 'FeedbackHub Demo', slug } });
  assert.equal(created.status, 303);
  const board = `/workspaces/${slug}`;
  const added = await request(`${board}/members?/add`, {
    cookie: owner.cookie, form: { email: viewer.email, role: 'viewer' }
  });
  assert.equal(added.status, 200);
  for (const title of ['Export feedback as CSV', 'Add weekly roadmap updates', 'Improve mobile voting']) {
    const feedback = await request(`${board}?/submit`, {
      cookie: owner.cookie, form: { title, description: 'Example feedback created for the local demo workspace.' }
    });
    assert.equal(feedback.status, 303);
  }
  assert.equal((await request('/admin', { cookie: admin.cookie })).status, 200);
  assert.equal((await request('/admin', { cookie: owner.cookie })).status, 403);
  assert.equal((await request(board, { cookie: viewer.cookie })).status, 200);
  assert.equal((await request(`${board}?/submit`, { cookie: viewer.cookie, form: { title: 'Read only', description: 'Read only' } })).status, 403);
  console.log(`Administrator, owner, and viewer verified. Demo workspace: ${board}. Credentials saved to ${output}.`);
} finally {
  await db.end();
}
