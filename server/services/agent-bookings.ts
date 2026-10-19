import { eq } from "drizzle-orm";
import { db } from "../db";
import { agents, bookings, deliveries } from "../db/schema";

export async function getAgentOrderIds(userId: string): Promise<string[]> {
  const agent = await db.query.agents.findFirst({
    where: eq(agents.user_id, userId),
    columns: { id: true },
  });

  const [ownedOrders, assignedRuns] = await Promise.all([
    db.select({ id: bookings.id }).from(bookings).where(eq(bookings.created_by, userId)),
    agent
      ? db.query.deliveries.findMany({
          where: eq(deliveries.agent_id, agent.id),
          with: { delivery_items: { with: { invoice: { columns: { booking_id: true } } } } },
        })
      : Promise.resolve([]),
  ]);

  return [...new Set([
    ...ownedOrders.map((order) => order.id),
    ...assignedRuns.flatMap((run) => run.delivery_items.map((item) => item.invoice.booking_id)),
  ])];
}
