import { tmpdir } from 'node:os';
import { join } from 'node:path';
import assert from 'node:assert/strict';
import { createHmac, randomUUID } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import postgres from 'postgres';
if (process.env.STRIPE_SECRET_KEY !== 'sk_test_fixture' || process.env.STRIPE_WEBHOOK_SECRET !== 'whsec_fixture') {
  throw new Error('Use the local Stripe fixture environment for this integration test.');
}
const db = postgres(process.env.DATABASE_URL);
const origin = process.env.TEST_ORIGIN;
const slug = 'stripe-' + randomUUID();
try {
  const result = await fetch(origin + '/api/auth/sign-up/email', {
    method: 'POST', headers: { origin, 'content-type': 'application/json' },
    body: JSON.stringify({ name: 'Billing Fixture', email: slug + '@example.com', password: 'Only-for-test-' + randomUUID() })
  });
  assert.equal(result.status, 200);
  const cookie = result.headers.getSetCookie().find((header) => header.includes('session_token')).split(';')[0];
  const post = (path, fields) => fetch(origin + path, {
    method: 'POST', redirect: 'manual', headers: { origin, cookie, accept: 'text/html' }, body: new URLSearchParams(fields)
  });
  assert.equal((await post('/workspaces?/create', { name: 'Stripe Fixture', slug })).status, 303);
  const plan = randomUUID();
  await db`insert into subscription_plans (id, name, stripe_price_id, feedback_limit)
    values (${plan}, ${slug}, 'price_fixture', 1)`;
  const billing = '/workspaces/' + slug + '/billing';
  const opened = await post(billing + '?/checkout', { plan });
  assert.equal(opened.status, 303);
  assert.match(opened.headers.get('location'), /^https:\/\/checkout.stripe.com\//);
  const repeated = await post(billing + '?/checkout', { plan });
  assert.equal(repeated.headers.get('location'), opened.headers.get('location'));
  const { attempt } = JSON.parse(readFileSync(join(tmpdir(), 'feedbackhub-stripe-attempt.json')));
  const hook = async (type, status, good = true) => {
    writeFileSync(join(tmpdir(), 'feedbackhub-stripe-status'), status);
    const body = JSON.stringify({ type, livemode: false, data: { object: { id: 'sub_fixture', metadata: { feedbackhub_attempt: attempt } } } });
    const time = Math.floor(Date.now() / 1000);
    const signature = createHmac('sha256', process.env.STRIPE_WEBHOOK_SECRET).update(time + '.' + body).digest('hex');
    return fetch(origin + '/api/billing/stripe', {
      method: 'POST', headers: { 'content-type': 'application/json', 'stripe-signature': `t=${time},v1=${good ? signature : '0'.repeat(64)}` }, body
    });
  };
  assert.equal((await hook('customer.subscription.created', 'active', false)).status, 400);
  const [before] = await db`select status from stripe_billing where attempt_id = ${attempt}`;
  assert.equal(before.status, 'pending');
  assert.equal((await hook('customer.subscription.created', 'active')).status, 204);
  const [after] = await db`select status from stripe_billing where attempt_id = ${attempt}`;
  assert.equal(after.status, 'active');
  const portal = await post(billing + '?/portal', {});
  assert.equal(portal.status, 303);
  assert.match(portal.headers.get('location'), /^https:\/\/billing.stripe.com\//);
  assert.equal((await post(billing + '?/checkout', { plan })).status, 409);
  assert.equal((await hook('customer.subscription.deleted', 'canceled')).status, 204);
  assert.equal((await hook('customer.subscription.created', 'canceled')).status, 204);
  assert.equal((await post('/workspaces/' + slug + '?/submit', { title: 'Blocked', description: 'Canceled subscription' })).status, 409);
  console.log('Stripe contract verified with mocked provider: checkout, signature, reconciliation, portal, cancellation, replay.');
} finally { await db.end(); }
