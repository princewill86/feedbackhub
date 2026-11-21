import { and, count, desc, eq, isNotNull } from 'drizzle-orm';
import { getDb } from './db';
import { feedbackItems, prepaidPayments, products, stripeBilling, subscriptionPlans, workspaceMembers, workspaceSubscriptions, workspaces } from './schema';

type Db = ReturnType<typeof getDb>;
type Transaction = Parameters<Parameters<Db['transaction']>[0]>[0];
async function billingSuspended(workspaceId: string, db: Db | Transaction) {
  const [row] = await db.select({ status: stripeBilling.status }).from(stripeBilling)
    .innerJoin(workspaceSubscriptions, and(eq(workspaceSubscriptions.workspaceId, stripeBilling.workspaceId),
      eq(workspaceSubscriptions.planId, stripeBilling.planId)))
    .where(eq(stripeBilling.workspaceId, workspaceId));
  if (row && row.status !== 'pending' && row.status !== 'active' && row.status !== 'trialing') return true;
  const [payment] = await db.select({ expiresAt: prepaidPayments.expiresAt }).from(prepaidPayments)
    .innerJoin(workspaceSubscriptions, and(eq(workspaceSubscriptions.workspaceId, prepaidPayments.workspaceId),
      eq(workspaceSubscriptions.planId, prepaidPayments.planId)))
    .where(and(eq(prepaidPayments.workspaceId, workspaceId), isNotNull(prepaidPayments.expiresAt)))
    .orderBy(desc(prepaidPayments.expiresAt)).limit(1);
  return Boolean(payment?.expiresAt && payment.expiresAt.getTime() <= Date.now());
}

type Feature = 'apiEnabled' | 'widgetEnabled' | 'analyticsEnabled';

export async function hasWorkspaceFeature(workspaceId: string, feature: Feature, db: Db | Transaction = getDb()) {
  if (await billingSuspended(workspaceId, db)) return false;
  const [plan] = await db.select({ enabled: subscriptionPlans[feature] })
    .from(workspaceSubscriptions).innerJoin(subscriptionPlans, eq(workspaceSubscriptions.planId, subscriptionPlans.id))
    .where(eq(workspaceSubscriptions.workspaceId, workspaceId));
  return plan?.enabled ?? true;
}

const resourceTable = { feedback: feedbackItems, product: products, member: workspaceMembers };
const limitField = { feedback: 'feedbackLimit', product: 'productLimit', member: 'memberLimit' } as const;
type Resource = keyof typeof resourceTable;

async function hasCapacity(tx: Transaction, workspaceId: string, resource: Resource) {
  // Serialize quota checks with competing inserts and plan assignment.
  const [workspace] = await tx.select({ id: workspaces.id }).from(workspaces)
    .where(eq(workspaces.id, workspaceId)).for('update');
  if (!workspace || await billingSuspended(workspaceId, tx)) return false;

  const [plan] = await tx.select({ limit: subscriptionPlans[limitField[resource]] })
    .from(workspaceSubscriptions).innerJoin(subscriptionPlans, eq(workspaceSubscriptions.planId, subscriptionPlans.id))
    .where(eq(workspaceSubscriptions.workspaceId, workspaceId)).for('share', { of: subscriptionPlans });
  if (plan?.limit == null) return true;
  const table = resourceTable[resource];
  const [usage] = await tx.select({ total: count() }).from(table).where(eq(table.workspaceId, workspaceId));
  return usage.total < plan.limit;
}

export const canCreateFeedback = (tx: Transaction, workspaceId: string) => hasCapacity(tx, workspaceId, 'feedback');
export const canCreateProduct = (tx: Transaction, workspaceId: string) => hasCapacity(tx, workspaceId, 'product');
export const canAddMember = (tx: Transaction, workspaceId: string) => hasCapacity(tx, workspaceId, 'member');
