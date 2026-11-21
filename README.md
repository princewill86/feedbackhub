# FeedbackHub

FeedbackHub is a multi-tenant SaaS for collecting customer feedback, prioritizing requests, and sharing roadmaps and changelogs.

Built by [princewill86](https://github.com/princewill86). Project source: [FeedbackHub on GitHub](https://github.com/princewill86/feedbackhub).

## Local development

Use Node.js 22.12 or newer and Docker Compose, or point the application at a local PostgreSQL instance.

```sh
npm ci
cp .env.example .env
openssl rand -hex 32
```

Put the generated secret in `BETTER_AUTH_SECRET` in `.env`. For the bundled local database, run:

```sh
docker compose up -d --wait db
npm run db:migrate
npm run dev
```

Open `http://localhost:5173`. Register, verify that the account screen displays your name and email, then sign out and confirm that opening `/account` redirects to sign-in. Use `npm run check` and `npm run build` to verify the project. The Node adapter serves the built app with `node --env-file=.env build`.

## Architecture and design

SvelteKit serves the website and account routes. Better Auth owns credential hashing and session handling. Drizzle maps users, accounts, sessions, and verification tokens to PostgreSQL. The account screen reads the session server-side and returns only the profile fields it renders.

Private workspace reads require server-resolved membership. Future workspace mutations will also require explicit permissions. Workspace-scoped queries will include the workspace identifier, and tenant-owned relationships will use database constraints to enforce the same scope. Platform administration will have a separate authorization boundary.

The visual system uses warm paper, dark aubergine, and editorial serif headlines with system sans-serif for controls. Navigation wraps on narrow screens, interactive controls target at least 44px, and forms use persistent labels. Feedback management is planned around compact, expandable rows with filters above the list.

## Phase 1 status

The scaffold, account routes, dependency lockfile, initial migration, and local PostgreSQL configuration are in source. Type checking and the production build passed. The initial migration and HTTP account integration test passed against PostgreSQL 17 through Docker Compose. Chromium layout checks passed for the landing, authentication, account, workspace directory, workspace board, and administration screens at five viewport widths. Full browser navigation checks remain pending. Better Auth used a shared rate-limit bucket in the integration environment because it did not receive a trusted client IP. Email verification and password recovery are available when a mail transport is configured. The platform console supports editing selected homepage and SEO fields and displays recent accounts and audit events. Registered users can create private workspaces with transactional owner assignment. Private workspaces support paginated feedback, single votes that users can remove, and discussion comments. Owners can add registered accounts directly, change their roles, and remove them. Viewers can read feedback but cannot submit, vote, or comment. The PostgreSQL integration test covers duplicate vote prevention under concurrent requests, membership enforcement, and cross-workspace isolation. Workspace managers can create statuses and record status changes. Owners and administrators can create, edit, archive, and restore products. Archived products stay linked to existing feedback and remain available as board filters. New submissions can use active products. Owners can create single-use invitation links for an email address. The invitee signs in with that address to accept within seven days. Additional moderation workflows and browser end-to-end coverage remain pending.

With the development server running against a disposable test database, run `node --test tests/auth.integration.mjs` for the HTTP account integration test. It creates a new account on each run. Set `TEST_ORIGIN` for a different server URL. The GitHub Actions workflow runs the same test against the built Node server with a fresh PostgreSQL service.

## Platform administration

Register the account that will operate the installation, then grant it access from an operator terminal:

```sh
node --env-file=.env scripts/grant-platform-admin.mjs your-address@example.com
```

Open `/admin` while signed in as that account. Settings changes apply to the public homepage and record an audit event. Standard accounts receive HTTP 403 for both the console and its settings action.

## Publishing and engagement

Workspace owners can enable public board access and explicitly publish individual feedback items. Workspace managers can create, edit, archive, and schedule roadmap or changelog entries. Public update pages require the board to be enabled and only show entries whose publication time has arrived. Feedback authors receive in-app notifications for new comments and status changes by other members. Authors can edit their comments, and managers can remove comments from discussion. Workspace analytics report actual submission counts, product breakdowns, votes, and comments.

## Feedback API

Workspace owners can issue and revoke API keys from the workspace navigation. Copy a key when it is issued. The server stores its digest and authorizes requests against the key's workspace and access scope. Send the key as `Authorization: Bearer KEY`. Each key allows up to 120 requests per minute.

- `GET /api/v1/feedback?page=1` lists feedback, 25 items per page.
- `GET /api/v1/feedback/ID` returns one feedback item.
- `POST /api/v1/feedback` accepts JSON with `title` and `description` and requires a read-and-create key. It creates private feedback.

## Container deployment

Build the runtime image with `docker build -t feedbackhub .`. Apply the migrations as a release step using `npm ci` and `npm run db:migrate` against the deployment database. Run the image with `DATABASE_URL`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, and `ORIGIN` supplied at runtime. Set both origin values to the canonical HTTPS address and forward traffic to container port 3000. The runtime image runs as the unprivileged Node user.

## Account email

Set `MAIL_TRANSPORT` and `MAIL_FROM` to enable account verification, password recovery, and automatic invitation email. Set `BETTER_AUTH_URL` to the canonical address recipients can open.

- **Resend** uses `MAIL_TRANSPORT=resend` and `RESEND_API_KEY`. Use a sender authorized by your Resend account.
- **SMTP** uses `MAIL_TRANSPORT=smtp` and `SMTP_HOST`. Set `SMTP_TLS=starttls` for port 587 or `SMTP_TLS=implicit` for port 465. Set `SMTP_PORT` to override the default. Set both `SMTP_USERNAME` and `SMTP_PASSWORD` for authenticated submission. SMTP uses curl with certificate validation. The runtime Dockerfile includes curl.
- **PHP mail** uses `MAIL_TRANSPORT=php` and a local PHP CLI with a configured mail transfer agent. Set `PHP_MAIL_BINARY` if PHP is outside the service's PATH. The application invokes PHP locally. For a container deployment, supply PHP and the local mail agent in a derived image.

SMTP and PHP require a bare email address in `MAIL_FROM`. Verification is required before sign-in when mail is enabled. Password resets revoke existing sessions. If invitation sending fails, the owner can still share the link.

Outgoing messages are queued in PostgreSQL and delivered by a worker in the Node server. Run at least one replica with `MAIL_WORKER_ENABLED=true`. All replicas must share `BETTER_AUTH_SECRET`, which encrypts queued message contents. Drain the queue before rotating that secret. Failed attempts retry with backoff up to four total attempts. Delivery is at least once, so a worker crash after a transport accepts a message can cause a duplicate. Completed and permanently failed jobs retain status metadata and discard message contents. Platform administrators can edit and preview verification, reset, and invitation templates at `/admin/email`. Each template requires a link variable. Invitation templates can include the workspace name. Changes appear in the audit log. The console lists recent delivery attempts. Live-provider delivery verification remains pending.

## Embeddable feedback form

Open **Widget** from a workspace as its owner. Add exact HTTPS origins, enable the form, and copy the generated iframe HTML to an allowed site. The browser enforces the origin list for framing. The form also supports a direct preview URL. Submissions are anonymous, rate-limited to ten per workspace per minute, and appear in private feedback. Disable the widget or regenerate its ID to invalidate an old embed.

The initial widget supports feedback submission. Browser-based cross-origin embedding verification, appearance controls, and optional voting and discussion remain pending.

## Outbound webhooks

Set `WEBHOOK_ALLOWED_URLS` to a whitespace-separated list of exact HTTPS destinations you control and trust. Include the path. The worker checks the allowlist before each delivery and rejects redirects. After configuring the allowlist, workspace owners can add or disable destinations under **Webhooks** and view recent attempts.

Feedback submissions from the workspace, widget, or API emit `feedback.created`. Status transitions emit `feedback.status_changed`. New comments emit `comment.created`. Each delivery includes the event, workspace ID, feedback ID, and delivery ID. The delivery ID stays the same across retries and can be used for deduplication. Network errors, HTTP 408, HTTP 429, and HTTP 5xx responses retry with backoff, up to five total attempts.

Verify `X-FeedbackHub-Signature` by computing HMAC-SHA256 over the UTF-8 string `timestamp.rawBody` using the signing secret exactly as displayed on creation. Read the epoch timestamp from `X-FeedbackHub-Timestamp`, reject stale timestamps, and compare the result in constant time against the hexadecimal value after `sha256=`.

## Subscription plans

Platform administrators can create and edit plans at `/admin/plans`, then assign a plan by workspace slug. Plans can cap feedback items, products, and members, and can gate API, widget, and analytics access. Feedback quotas apply to workspace forms, widget submissions, and API writes. Member quotas apply to direct additions and invitation acceptance. Archived products count toward the product cap. Unassigned workspaces have unlimited quotas and access to all three features. Making a plan inactive prevents new assignments and preserves the limits for existing assignments.

Plan assignments support manual administration, Stripe subscriptions, and prepaid purchases via Paystack, BTCPay Server, or NOWPayments. Each provider is independently configurable.

## Local demo accounts

With migrations applied and a local server running with mail disabled, run:

```sh
DEMO_SEED=local DEMO_ORIGIN=http://localhost:5173 node --env-file=.env scripts/seed-demo.mjs
```

The script creates a platform administrator, a demo workspace owner, and a read-only viewer, plus three sample feedback items. It stores randomly generated credentials in the gitignored `.env.demo` file and refuses to overwrite it. Use the administrator at `/admin`, or sign in as the owner or viewer and open **Your workspaces**. Keep these accounts in the local development database.

### Stripe checkout and invoices

1. Set `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` for the same Stripe environment. Start with test mode. Keep both values server-side.
2. Configure Stripe to send `customer.subscription.created`, `customer.subscription.updated`, and `customer.subscription.deleted` events to `/api/billing/stripe`. Enable the Stripe customer portal and invoice history. Keep plan switching disabled in the portal because FeedbackHub grants access only for the originally purchased price.
3. Create a recurring Stripe Price and enter its ID on the corresponding FeedbackHub plan at `/admin/plans`. Activate the plan and open **Billing** as a workspace owner.

Stripe hosts payment entry and invoice access. Verified subscription events trigger Stripe API reconciliation. An active or trialing subscription applies the configured plan. A canceled or otherwise inactive subscription suspends its entitlements. Checkout retries share an idempotency key. If an attempt is stuck and its Stripe session is unknown, an operator must reconcile it before permitting another checkout.

Type checks and the production build have passed. A PostgreSQL integration test with a mocked Stripe API exercised checkout, signature verification, activation, the portal redirect, and cancellation. A real Stripe test-mode transaction requires operator credentials and remains unverified.

### Prepaid checkout

- **Paystack** requires `PAYSTACK_SECRET_KEY`. Set `PAYSTACK_WEBHOOK_SECRET` if the account uses the newer timestamped signature header. Send `charge.success` events to `/api/billing/paystack`. Set a minor-unit price, currency, and prepaid term on the plan.
- **BTCPay Server** requires `BTCPAY_ORIGIN`, `BTCPAY_STORE_ID`, `BTCPAY_API_KEY`, and `BTCPAY_WEBHOOK_SECRET`. Give the API key invoice creation and retrieval access to that store. Send `InvoiceSettled`, `InvoiceExpired`, and `InvoiceInvalid` events to `/api/billing/btcpay`.
- **NOWPayments** requires `NOWPAYMENTS_API_KEY` and `NOWPAYMENTS_IPN_SECRET`. Set `NOWPAYMENTS_SANDBOX=true` with matching sandbox credentials. FeedbackHub passes `/api/billing/nowpayments` as the IPN callback when creating an invoice.

Set the crypto price in US cents and the prepaid term on each plan available for BTCPay or NOWPayments. Use a publicly reachable canonical HTTPS `BETTER_AUTH_URL` so providers can send callbacks. The billing page shows payment history and links to hosted crypto invoices. Stripe invoice history is available in its customer portal. Paystack prepaid checkout exposes transaction history in FeedbackHub.

Prepaid purchases do not auto-renew. A verified renewal of the same plan extends an unexpired term. A workspace with an open checkout must resolve it before starting with another provider or plan. A workspace that has used Stripe or prepaid billing cannot switch between those billing models through self-service. Live payments are unverified. Local PostgreSQL contract checks used mocked provider APIs.

## Legal pages

Registration and the footer link to `/terms` and `/privacy`. Platform administrators can edit both documents at `/admin/legal`. The included text describes the default installation. Review it before launch and supply the operator identity, contact information, applicable terms, and actual data handling and retention practices.

## Contributing and security

- [Contribution guide](CONTRIBUTING.md)
- [Code of conduct](CODE_OF_CONDUCT.md)
- [Security policy and vulnerability reporting](SECURITY.md)
- [MIT License](LICENSE)
