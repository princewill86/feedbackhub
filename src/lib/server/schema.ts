import { boolean, foreignKey, index, integer, pgTable, primaryKey, text, timestamp, unique } from 'drizzle-orm/pg-core';

const date = (name: string) => timestamp(name, { withTimezone: true });

export const user = pgTable('users', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  emailVerified: boolean('email_verified').notNull().default(false),
  image: text('image'),
  createdAt: date('created_at').notNull().defaultNow(),
  updatedAt: date('updated_at').notNull().defaultNow()
});

export const session = pgTable('sessions', {
  id: text('id').primaryKey(),
  token: text('token').notNull().unique(),
  userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  expiresAt: date('expires_at').notNull(),
  createdAt: date('created_at').notNull().defaultNow(),
  updatedAt: date('updated_at').notNull().defaultNow(),
  ipAddress: text('ip_address'),
  userAgent: text('user_agent')
}, (table) => [index('sessions_user_idx').on(table.userId)]);

export const account = pgTable('accounts', {
  id: text('id').primaryKey(),
  accountId: text('account_id').notNull(),
  providerId: text('provider_id').notNull(),
  userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  accessToken: text('access_token'),
  refreshToken: text('refresh_token'),
  idToken: text('id_token'),
  accessTokenExpiresAt: date('access_token_expires_at'),
  refreshTokenExpiresAt: date('refresh_token_expires_at'),
  scope: text('scope'),
  password: text('password'),
  createdAt: date('created_at').notNull().defaultNow(),
  updatedAt: date('updated_at').notNull().defaultNow()
}, (table) => [index('accounts_user_idx').on(table.userId)]);

export const verification = pgTable('verifications', {
  id: text('id').primaryKey(),
  identifier: text('identifier').notNull(),
  value: text('value').notNull(),
  expiresAt: date('expires_at').notNull(),
  createdAt: date('created_at').notNull().defaultNow(),
  updatedAt: date('updated_at').notNull().defaultNow()
}, (table) => [index('verifications_identifier_idx').on(table.identifier)]);

export const platformAdministrators = pgTable('platform_administrators', {
  userId: text('user_id').primaryKey().references(() => user.id, { onDelete: 'cascade' }),
  createdAt: date('created_at').notNull().defaultNow()
});

export const platformSettings = pgTable('platform_settings', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
  updatedAt: date('updated_at').notNull().defaultNow()
});

export const platformAudit = pgTable('platform_audit', {
  id: text('id').primaryKey(),
  actorId: text('actor_id').references(() => user.id, { onDelete: 'set null' }),
  action: text('action').notNull(),
  target: text('target').notNull(),
  createdAt: date('created_at').notNull().defaultNow()
}, (table) => [index('platform_audit_created_idx').on(table.createdAt)]);

export const workspaces = pgTable('workspaces', {
  publicBoard: boolean('public_board').notNull().default(false),
  id: text('id').primaryKey(),
  slug: text('slug').notNull().unique(),
  name: text('name').notNull(),
  description: text('description').notNull().default(''),
  createdAt: date('created_at').notNull().defaultNow()
});

export const workspaceMembers = pgTable('workspace_members', {
  workspaceId: text('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
  userId: text('user_id').notNull().references(() => user.id, { onDelete: 'restrict' }),
  role: text('role', { enum: ['owner', 'administrator', 'manager', 'member', 'viewer'] }).notNull(),
  createdAt: date('created_at').notNull().defaultNow()
}, (table) => [
  primaryKey({ columns: [table.workspaceId, table.userId] }),
  index('workspace_members_user_idx').on(table.userId)
]);

export const products = pgTable('products', {
  archivedAt: date('archived_at'),
  workspaceId: text('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
  id: text('id').notNull(),
  name: text('name').notNull(),
  slug: text('slug').notNull(),
  description: text('description').notNull().default('')
}, (table) => [
  primaryKey({ columns: [table.workspaceId, table.id] }),
  unique('products_workspace_slug_unique').on(table.workspaceId, table.slug)
]);

export const feedbackItems = pgTable('feedback_items', {
  published: boolean('published').notNull().default(false),
  id: text('id').primaryKey(),
  workspaceId: text('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
  productId: text('product_id'),
  authorId: text('author_id').references(() => user.id, { onDelete: 'set null' }),
  title: text('title').notNull(),
  description: text('description').notNull(),
  createdAt: date('created_at').notNull().defaultNow()
}, (table) => [
  index('feedback_items_workspace_created_idx').on(table.workspaceId, table.createdAt, table.id),
  unique('feedback_items_workspace_id_unique').on(table.workspaceId, table.id),
  foreignKey({
    name: 'feedback_items_product_fk',
    columns: [table.workspaceId, table.productId],
    foreignColumns: [products.workspaceId, products.id]
  })
]);

export const feedbackVotes = pgTable('feedback_votes', {
  workspaceId: text('workspace_id').notNull(),
  feedbackId: text('feedback_id').notNull(),
  userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' })
}, (table) => [
  primaryKey({ columns: [table.workspaceId, table.feedbackId, table.userId] }),
  foreignKey({
    name: 'feedback_votes_item_fk',
    columns: [table.workspaceId, table.feedbackId],
    foreignColumns: [feedbackItems.workspaceId, feedbackItems.id]
  }).onDelete('cascade')
]);

export const feedbackComments = pgTable('feedback_comments', {
  id: text('id').primaryKey(),
  workspaceId: text('workspace_id').notNull(),
  feedbackId: text('feedback_id').notNull(),
  authorId: text('author_id').references(() => user.id, { onDelete: 'set null' }),
  body: text('body').notNull(),
  editedAt: date('edited_at'),
  removedAt: date('removed_at'),
  createdAt: date('created_at').notNull().defaultNow()
}, (table) => [
  index('feedback_comments_item_created_idx').on(table.workspaceId, table.feedbackId, table.createdAt, table.id),
  foreignKey({
    name: 'feedback_comments_item_fk',
    columns: [table.workspaceId, table.feedbackId],
    foreignColumns: [feedbackItems.workspaceId, feedbackItems.id]
  }).onDelete('cascade')
]);

export const feedbackStatuses = pgTable('feedback_statuses', {
  workspaceId: text('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
  id: text('id').notNull(),
  name: text('name').notNull()
}, (table) => [
  primaryKey({ columns: [table.workspaceId, table.id] }),
  unique('feedback_status_workspace_name_unique').on(table.workspaceId, table.name)
]);

export const feedbackStatusChanges = pgTable('feedback_status_changes', {
  id: text('id').primaryKey(),
  workspaceId: text('workspace_id').notNull(),
  feedbackId: text('feedback_id').notNull(),
  statusId: text('status_id').notNull(),
  actorId: text('actor_id').references(() => user.id, { onDelete: 'set null' }),
  createdAt: date('created_at').notNull().defaultNow()
}, (table) => [
  index('feedback_status_changes_item_idx').on(table.workspaceId, table.feedbackId, table.createdAt, table.id),
  foreignKey({ name: 'feedback_status_changes_item_fk', columns: [table.workspaceId, table.feedbackId],
    foreignColumns: [feedbackItems.workspaceId, feedbackItems.id] }).onDelete('cascade'),
  foreignKey({ name: 'feedback_status_changes_status_fk', columns: [table.workspaceId, table.statusId],
    foreignColumns: [feedbackStatuses.workspaceId, feedbackStatuses.id] })
]);

export const publications = pgTable('publications', {
  id: text('id').primaryKey(),
  workspaceId: text('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
  kind: text('kind', { enum: ['roadmap', 'changelog'] }).notNull(),
  title: text('title').notNull(),
  body: text('body').notNull(),
  period: text('period').notNull().default(''),
  status: text('status', { enum: ['draft', 'published', 'archived'] }).notNull().default('draft'),
  publishAt: date('publish_at'),
  createdAt: date('created_at').notNull().defaultNow()
}, (table) => [index('publications_workspace_kind_created_idx').on(table.workspaceId, table.kind, table.createdAt, table.id)]);

export const notifications = pgTable('notifications', {
  id: text('id').primaryKey(),
  recipientId: text('recipient_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  workspaceId: text('workspace_id').notNull(),
  feedbackId: text('feedback_id').notNull(),
  kind: text('kind', { enum: ['comment', 'status'] }).notNull(),
  createdAt: date('created_at').notNull().defaultNow(),
  readAt: date('read_at')
}, (table) => [
  index('notifications_recipient_created_idx').on(table.recipientId, table.createdAt, table.id),
  foreignKey({ name: 'notifications_feedback_fk', columns: [table.workspaceId, table.feedbackId],
    foreignColumns: [feedbackItems.workspaceId, feedbackItems.id] }).onDelete('cascade')
]);

export const apiKeys = pgTable('api_keys', {
  id: text('id').primaryKey(),
  workspaceId: text('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  digest: text('digest').notNull().unique(),
  canWrite: boolean('can_write').notNull().default(false),
  createdAt: date('created_at').notNull().defaultNow(),
  revokedAt: date('revoked_at')
}, (table) => [index('api_keys_workspace_created_idx').on(table.workspaceId, table.createdAt, table.id)]);

export const apiUsage = pgTable('api_usage', {
  keyId: text('key_id').primaryKey().references(() => apiKeys.id, { onDelete: 'cascade' }),
  minute: timestamp('minute', { withTimezone: true }).notNull(),
  requests: integer('requests').notNull()
});

export const workspaceInvitations = pgTable('workspace_invitations', {
  digest: text('digest').primaryKey(),
  workspaceId: text('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
  email: text('email').notNull(),
  role: text('role', { enum: ['administrator', 'manager', 'member', 'viewer'] }).notNull(),
  expiresAt: date('expires_at').notNull(),
  acceptedAt: date('accepted_at')
}, (table) => [index('workspace_invites_expiry_idx').on(table.expiresAt)]);

export const mailJobs = pgTable('mail_jobs', {
  id: text('id').primaryKey(),
  kind: text('kind', { enum: ['verify', 'reset', 'invitation'] }).notNull(),
  payload: text('payload'),
  status: text('status', { enum: ['pending', 'sending', 'sent', 'failed'] }).notNull().default('pending'),
  attempts: integer('attempts').notNull().default(0),
  availableAt: date('available_at').notNull().defaultNow(),
  expiresAt: date('expires_at').notNull(),
  leaseId: text('lease_id'),
  createdAt: date('created_at').notNull().defaultNow(),
  completedAt: date('completed_at')
}, (table) => [
  index('mail_jobs_ready_idx').on(table.status, table.availableAt),
  index('mail_jobs_created_idx').on(table.createdAt, table.id)
]);

export const feedbackWidgets = pgTable('feedback_widgets', {
  workspaceId: text('workspace_id').primaryKey().references(() => workspaces.id, { onDelete: 'cascade' }),
  id: text('id').notNull().unique(),
  origins: text('origins').array().notNull(),
  enabled: boolean('enabled').notNull().default(false),
  minute: date('minute'),
  submissions: integer('submissions').notNull().default(0)
});

export const webhooks = pgTable('webhooks', {
  id: text('id').primaryKey(),
  workspaceId: text('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
  url: text('url').notNull(),
  encryptedSecret: text('encrypted_secret').notNull(),
  disabled: boolean('disabled').notNull().default(false),
  createdAt: date('created_at').notNull().defaultNow()
}, (table) => [index('webhooks_workspace_idx').on(table.workspaceId, table.disabled)]);

export const webhookDeliveries = pgTable('webhook_deliveries', {
  id: text('id').primaryKey(),
  webhookId: text('webhook_id').notNull().references(() => webhooks.id, { onDelete: 'cascade' }),
  event: text('event').notNull(),
  body: text('body').notNull(),
  state: text('state', { enum: ['pending', 'sending', 'sent', 'failed'] }).notNull().default('pending'),
  availableAt: date('available_at').notNull().defaultNow(),
  createdAt: date('created_at').notNull().defaultNow(),
  attempts: integer('attempts').notNull().default(0),
  lease: text('lease'),
  httpStatus: integer('http_status')
}, (table) => [
  index('webhook_deliveries_ready_idx').on(table.state, table.availableAt),
  index('webhook_deliveries_webhook_idx').on(table.webhookId, table.createdAt, table.id)
]);

export const subscriptionPlans = pgTable('subscription_plans', {
  id: text('id').primaryKey(),
  name: text('name').notNull().unique(),
  description: text('description').notNull().default(''),
  stripePriceId: text('stripe_price_id'),
  paystackAmount: integer('paystack_amount'),
  paystackCurrency: text('paystack_currency').notNull().default('NGN'),
  paystackDays: integer('paystack_days').notNull().default(30),
  bitcoinAmount: integer('bitcoin_amount'),
  bitcoinDays: integer('bitcoin_days').notNull().default(30),
  feedbackLimit: integer('feedback_limit'),
  productLimit: integer('product_limit'),
  memberLimit: integer('member_limit'),
  apiEnabled: boolean('api_enabled').notNull().default(true),
  widgetEnabled: boolean('widget_enabled').notNull().default(true),
  analyticsEnabled: boolean('analytics_enabled').notNull().default(true),
  active: boolean('active').notNull().default(true),
  createdAt: date('created_at').notNull().defaultNow()
});

export const workspaceSubscriptions = pgTable('workspace_subscriptions', {
  workspaceId: text('workspace_id').primaryKey().references(() => workspaces.id, { onDelete: 'cascade' }),
  planId: text('plan_id').notNull().references(() => subscriptionPlans.id, { onDelete: 'restrict' }),
  assignedAt: date('assigned_at').notNull().defaultNow()
});

export const stripeBilling = pgTable('stripe_billing', {
  workspaceId: text('workspace_id').primaryKey().references(() => workspaces.id, { onDelete: 'cascade' }),
  planId: text('plan_id').notNull().references(() => subscriptionPlans.id, { onDelete: 'restrict' }),
  attemptId: text('attempt_id').notNull().unique(),
  priceId: text('price_id').notNull(),
  checkoutEmail: text('checkout_email').notNull(),
  checkoutSessionId: text('checkout_session_id'),
  checkoutExpiresAt: date('checkout_expires_at').notNull(),
  customerId: text('customer_id'),
  subscriptionId: text('subscription_id').unique(),
  status: text('status').notNull().default('pending'),
  updatedAt: date('updated_at').notNull().defaultNow()
});

// Preserve the SQL table name for existing Paystack installations.
export const prepaidPayments = pgTable('paystack_payments', {
  provider: text('provider', { enum: ['paystack', 'btcpay', 'nowpayments'] }).notNull().default('paystack'),
  invoiceId: text('invoice_id'),
  voidedAt: date('voided_at'),
  reference: text('reference').primaryKey(),
  workspaceId: text('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
  planId: text('plan_id').notNull().references(() => subscriptionPlans.id, { onDelete: 'restrict' }),
  amount: integer('amount').notNull(),
  currency: text('currency').notNull(),
  termDays: integer('term_days').notNull(),
  checkoutUrl: text('checkout_url').notNull(),
  paidAt: date('paid_at'),
  expiresAt: date('expires_at'),
  createdAt: date('created_at').notNull().defaultNow()
}, (table) => [
  index('paystack_payments_workspace_idx').on(table.workspaceId, table.createdAt, table.reference),
  unique('prepaid_payments_provider_invoice_unique').on(table.provider, table.invoiceId)
]);
