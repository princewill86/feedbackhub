import { and, desc, eq, isNotNull, sql } from 'drizzle-orm';
import { getDb } from './db';
import { prepaidPayments, workspaceSubscriptions, workspaces } from './schema';

export async function grantPrepaidPayment(reference: string) {
  const db = getDb();
  const [payment] = await db.select({ workspaceId: prepaidPayments.workspaceId }).from(prepaidPayments)
    .where(eq(prepaidPayments.reference, reference));
  if (!payment) return false;
  return db.transaction(async (tx) => {
    await tx.select({ id: workspaces.id }).from(workspaces).where(eq(workspaces.id, payment.workspaceId)).for('update');
    const [current] = await tx.select().from(prepaidPayments).where(eq(prepaidPayments.reference, reference));
    if (!current || current.voidedAt) return false;
    if (current.paidAt) return true;
    const [previous] = await tx.select({ expiresAt: prepaidPayments.expiresAt }).from(prepaidPayments)
      .where(and(eq(prepaidPayments.workspaceId, payment.workspaceId), isNotNull(prepaidPayments.expiresAt)))
      .orderBy(desc(prepaidPayments.expiresAt)).limit(1);
    const start = Math.max(Date.now(), previous?.expiresAt?.getTime() ?? 0);
    const expiresAt = new Date(start + current.termDays * 86400000);
    await tx.update(prepaidPayments).set({ paidAt: sql`now()`, expiresAt }).where(eq(prepaidPayments.reference, reference));
    await tx.insert(workspaceSubscriptions).values({ workspaceId: payment.workspaceId, planId: current.planId })
      .onConflictDoUpdate({ target: workspaceSubscriptions.workspaceId, set: { planId: current.planId, assignedAt: sql`now()` } });
    return true;
  });
}
