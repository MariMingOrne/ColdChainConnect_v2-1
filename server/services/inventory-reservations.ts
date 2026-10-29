import { and, eq, inArray, ne, sql } from "drizzle-orm";
import { db } from "../db";
import { order_pallet_items, order_pallets } from "../db/schema";

export async function getReservedUnitsBySource(sourceItemIds?: string[]) {
  if (sourceItemIds?.length === 0) return new Map<string, number>();

  const rows = await db
    .select({
      sourceItemId: order_pallet_items.batch_item_id,
      quantity: sql<number>`sum(${order_pallet_items.qty_units})::int`,
    })
    .from(order_pallet_items)
    .innerJoin(order_pallets, eq(order_pallet_items.pallet_id, order_pallets.id))
    .where(and(
      ne(order_pallets.status, "shipped"),
      sourceItemIds ? inArray(order_pallet_items.batch_item_id, sourceItemIds) : undefined,
    ))
    .groupBy(order_pallet_items.batch_item_id);

  return new Map(rows.map((row) => [row.sourceItemId, row.quantity]));
}
