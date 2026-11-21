import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { readFileSync, writeFileSync } from 'node:fs';
const original = globalThis.fetch;
globalThis.fetch = async (input, init) => {
  const url = new URL(input);
  if (url.origin !== 'https://api.stripe.com') return original(input, init);
  switch (url.pathname) {
    case '/v1/checkout/sessions': {
      const fields = new URLSearchParams(init.body);
      const attempt = fields.get('subscription_data[metadata][feedbackhub_attempt]');
      const price = fields.get('line_items[0][price]');
      writeFileSync(join(tmpdir(), 'feedbackhub-stripe-attempt.json'), JSON.stringify({ attempt, price }));
      return Response.json({ id: 'cs_test_fixture', status: 'open', url: 'https://checkout.stripe.com/c/pay/cs_test_fixture' });
    }
    case '/v1/subscriptions/sub_fixture': {
      const { attempt, price } = JSON.parse(readFileSync(join(tmpdir(), 'feedbackhub-stripe-attempt.json')));
      const status = readFileSync(join(tmpdir(), 'feedbackhub-stripe-status'), 'utf8');
      return Response.json({ id: 'sub_fixture', customer: 'cus_fixture', livemode: false, status,
        metadata: { feedbackhub_attempt: attempt }, items: { data: [{ price: { id: price }, quantity: 1 }] } });
    }
    case '/v1/billing_portal/sessions':
      return Response.json({ url: 'https://billing.stripe.com/p/session/fixture' });
    default: return new Response(null, { status: 404 });
  }
};
