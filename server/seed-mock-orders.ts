import "dotenv/config";
import { eq, like } from "drizzle-orm";
import { db } from "./db";
import {
  accounts_receivable,
  agent_returns,
  agents,
  booking_items,
  bookings,
  customers,
  deliveries,
  delivery_items,
  invoice_items,
  invoices,
  order_pallet_items,
  order_pallets,
  pallet_items,
  products,
  receipts,
  trucks,
  users,
} from "./db/schema";

const HISTORY_DAYS = 30;
const DAY_MS = 86_400_000;
const HOUR_MS = 3_600_000;
const PAID_AFTER_DAYS = 3;
const ORDERS_PER_DISTRICT_PER_DAY = 10;
const RETURN_EVERY_DAYS = 5;
const MOCK_PREFIX = "mock-forecast-";

const DISTRICTS = [
  { key: "a", district: "District A", store: "Mock Store A", location: "Makati City", agentUsername: "agent1" },
  { key: "b", district: "District B", store: "Mock Store B", location: "Taguig City", agentUsername: "agent2" },
  { key: "c", district: "District C", store: "Mock Store C", location: "Tagaytay City", agentUsername: "agent3" },
];

const RETURN_REASONS = [
  "Damaged packaging on arrival",
  "Customer over-ordered",
  "Temperature check failed",
  "Wrong item delivered",
];

async function seedMockOrders() {
  const [admin] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.role, "admin"))
    .limit(1);
  if (!admin) throw new Error("Needs an admin user. Run `pnpm db:seed` first.");

  const districtSetup = [];
  for (const d of DISTRICTS) {
    const [agentUser] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.username, d.agentUsername))
      .limit(1);
    const [agent] = agentUser
      ? await db.select({ id: agents.id }).from(agents).where(eq(agents.user_id, agentUser.id)).limit(1)
      : [];
    const [truck] = await db
      .select({ id: trucks.id, driverId: trucks.driver_id })
      .from(trucks)
      .where(eq(trucks.district, d.district))
      .limit(1);
    if (!agentUser || !agent || !truck) {
      throw new Error(`${d.district} needs agent "${d.agentUsername}" with a profile and a truck. Run \`pnpm db:seed\` first.`);
    }
    districtSetup.push({ ...d, agentUserId: agentUser.id, agentId: agent.id, truckId: truck.id, driverId: truck.driverId });
  }

  const stockRows = await db
    .select({
      itemId: pallet_items.id,
      palletId: pallet_items.pallet_id,
      productId: products.id,
      name: products.name,
      sku: products.sku,
      price: products.price,
    })
    .from(pallet_items)
    .innerJoin(products, eq(pallet_items.product_id, products.id))
    .orderBy(products.name);

  const lines: typeof stockRows = [];
  const seenProducts = new Set<string>();
  for (const row of stockRows) {
    if (lines.length === 3) break;
    if (seenProducts.has(row.productId)) continue;
    seenProducts.add(row.productId);
    lines.push(row);
  }
  if (lines.length < 3) {
    throw new Error("Needs 3 products with stock. Run `pnpm db:seed` first.");
  }

  await db.delete(agent_returns).where(like(agent_returns.id, `${MOCK_PREFIX}%`));
  await db.delete(accounts_receivable).where(like(accounts_receivable.id, `${MOCK_PREFIX}%`));
  await db.delete(receipts).where(like(receipts.id, `${MOCK_PREFIX}%`));
  await db.delete(delivery_items).where(like(delivery_items.id, `${MOCK_PREFIX}%`));
  await db.delete(deliveries).where(like(deliveries.id, `${MOCK_PREFIX}%`));
  await db.delete(order_pallet_items).where(like(order_pallet_items.id, `${MOCK_PREFIX}%`));
  await db.delete(order_pallets).where(like(order_pallets.id, `${MOCK_PREFIX}%`));
  await db.delete(invoice_items).where(like(invoice_items.id, `${MOCK_PREFIX}%`));
  await db.delete(invoices).where(like(invoices.id, `${MOCK_PREFIX}%`));
  await db.delete(booking_items).where(like(booking_items.id, `${MOCK_PREFIX}%`));
  await db.delete(bookings).where(like(bookings.id, `${MOCK_PREFIX}%`));

  for (const d of districtSetup) {
    await db
      .insert(customers)
      .values({
        id: `${MOCK_PREFIX}customer-${d.key}`,
        store_name: d.store,
        location: d.location,
        district: d.district,
        agent_id: d.agentUserId,
        payment_type: "cash",
      })
      .onConflictDoUpdate({
        target: customers.id,
        set: { store_name: d.store, location: d.location, district: d.district, agent_id: d.agentUserId },
      });
  }

  const todayStart = new Date();
  todayStart.setUTCHours(0, 0, 0, 0);

  const counts = { orders: 0, deliveries: 0, receipts: 0, ar: 0, returns: 0 };

  for (let daysAgo = HISTORY_DAYS - 1; daysAgo >= 0; daysAgo--) {
    const dayStart = todayStart.getTime() - daysAgo * DAY_MS;
    const dayIndex = HISTORY_DAYS - 1 - daysAgo;
    const dateKey = new Date(dayStart).toISOString().slice(0, 10).replace(/-/g, "");
    const deliveryDayStart = dayStart + DAY_MS;
    const deliveryDate = new Date(deliveryDayStart).toISOString().slice(0, 10);
    const isPaid = daysAgo > PAID_AFTER_DAYS;
    const isDelivered = daysAgo >= 2;
    const isDispatched = daysAgo >= 1;
    const palletStatus = isDispatched ? "shipped" : "approved";

    const bookingRows: (typeof bookings.$inferInsert)[] = [];
    const bookingItemRows: (typeof booking_items.$inferInsert)[] = [];
    const invoiceRows: (typeof invoices.$inferInsert)[] = [];
    const invoiceItemRows: (typeof invoice_items.$inferInsert)[] = [];
    const palletRows: (typeof order_pallets.$inferInsert)[] = [];
    const palletItemRows: (typeof order_pallet_items.$inferInsert)[] = [];
    const deliveryRows: (typeof deliveries.$inferInsert)[] = [];
    const deliveryItemRows: (typeof delivery_items.$inferInsert)[] = [];
    const receiptRows: (typeof receipts.$inferInsert)[] = [];
    const arRows: (typeof accounts_receivable.$inferInsert)[] = [];
    const returnRows: (typeof agent_returns.$inferInsert)[] = [];

    districtSetup.forEach((d, districtIndex) => {
      const deliveryId = `${MOCK_PREFIX}delivery-${dateKey}-${d.key}`;
      if (isDispatched) {
        deliveryRows.push({
          id: deliveryId,
          truck_id: d.truckId,
          driver_id: d.driverId,
          agent_id: d.agentId,
          scheduled_date: deliveryDate,
          status: isDelivered ? "completed" : "pending",
          created_at: new Date(deliveryDayStart + 8 * HOUR_MS),
          updated_at: new Date(deliveryDayStart + 8 * HOUR_MS),
        });
        counts.deliveries++;
      }

      for (let n = 0; n < ORDERS_PER_DISTRICT_PER_DAY; n++) {
        const orderKey = `${dateKey}-${d.key}-${n}`;
        const bookingId = `${MOCK_PREFIX}booking-${orderKey}`;
        const invoiceId = `${MOCK_PREFIX}invoice-${orderKey}`;
        const createdAt = new Date(dayStart + (6 + n) * HOUR_MS + districtIndex * 60_000);
        const confirmedAt = new Date(deliveryDayStart + (9 + n) * HOUR_MS + districtIndex * 60_000);

        const orderLines = lines.map((line, productIndex) => {
          const qty = 2 + ((dayIndex * 7 + n * 3 + districtIndex * 5 + productIndex * 4) % 9);
          const unitPrice = parseFloat(line.price);
          return { line, productIndex, qty, unitPrice, amount: qty * unitPrice };
        });
        const gross = orderLines.reduce((sum, l) => sum + l.amount, 0);
        const discount = gross * 0.02;
        const total = gross - discount;

        bookingRows.push({
          id: bookingId,
          customer_id: `${MOCK_PREFIX}customer-${d.key}`,
          created_by: d.agentUserId,
          status: "approved",
          prepared_delivery_date: deliveryDate,
          created_at: createdAt,
        });

        invoiceRows.push({
          id: invoiceId,
          booking_id: bookingId,
          agent_id: d.agentUserId,
          status: isPaid ? "paid" : "issued",
          payment_status: isPaid ? "paid" : "unpaid",
          receipt_number: `MOCK-${orderKey}`,
          customer_name: d.store,
          discount_rate: "0.02",
          gross_amount: gross.toFixed(2),
          discount_amount: discount.toFixed(2),
          total_amount: total.toFixed(2),
          prepared_by: d.agentUsername,
          created_at: createdAt,
          updated_at: createdAt,
        });

        const palletId = `${MOCK_PREFIX}pallet-${orderKey}`;
        palletRows.push({
          id: palletId,
          order_id: bookingId,
          truck_id: d.truckId,
          status: palletStatus,
          created_at: createdAt,
          updated_at: createdAt,
        });

        for (const { line, productIndex, qty, unitPrice, amount } of orderLines) {
          bookingItemRows.push({
            id: `${MOCK_PREFIX}booking-item-${orderKey}-${productIndex}`,
            booking_id: bookingId,
            product_id: line.productId,
            qty_ordered: qty,
            created_at: createdAt,
          });
          invoiceItemRows.push({
            id: `${MOCK_PREFIX}invoice-item-${orderKey}-${productIndex}`,
            invoice_id: invoiceId,
            product_id: line.productId,
            product_name: line.name,
            product_sku: line.sku,
            qty_ordered: qty,
            unit_price: unitPrice.toFixed(2),
            amount: amount.toFixed(2),
            created_at: createdAt,
          });
          palletItemRows.push({
            id: `${MOCK_PREFIX}pallet-item-${orderKey}-${productIndex}`,
            pallet_id: palletId,
            product_id: line.productId,
            qty_units: qty,
            unit_cost: line.price,
            batch_item_id: line.itemId,
            created_at: createdAt,
            updated_at: createdAt,
          });
        }

        counts.orders++;

        if (!isDelivered) continue;

        const deliveryItemId = `${MOCK_PREFIX}delivery-item-${orderKey}`;
        const receiptNumber = `OR-MOCK-${orderKey}`;
        const payByTransfer = n % 2 === 0;
        const paymentReference = isPaid && payByTransfer ? `MOCK-PAY-${orderKey}` : null;
        const paymentMethod = isPaid ? (payByTransfer ? "bank_transfer" : "cash") : null;

        deliveryItemRows.push({
          id: deliveryItemId,
          delivery_id: deliveryId,
          invoice_id: invoiceId,
          destination_customer_id: `${MOCK_PREFIX}customer-${d.key}`,
          status: "completed",
          completed_at: confirmedAt,
          receipt_number: receiptNumber,
          is_paid: isPaid,
          payment_method: paymentMethod,
          payment_reference: paymentReference,
          paid_at: isPaid ? confirmedAt : null,
          created_at: createdAt,
          updated_at: confirmedAt,
        });

        receiptRows.push({
          id: `${MOCK_PREFIX}receipt-${orderKey}`,
          receipt_number: receiptNumber,
          delivery_item_id: deliveryItemId,
          customer_id: `${MOCK_PREFIX}customer-${d.key}`,
          truck_id: d.truckId,
          invoice_id: invoiceId,
          confirmed_by: d.agentUsername,
          payment_reference: paymentReference,
          confirmed_at: confirmedAt,
        });
        counts.receipts++;

        if (!isPaid) {
          arRows.push({
            id: `${MOCK_PREFIX}ar-${orderKey}`,
            customer_id: `${MOCK_PREFIX}customer-${d.key}`,
            delivery_item_id: deliveryItemId,
            invoice_id: invoiceId,
            amount_due: total.toFixed(2),
            status: "outstanding",
            notes: `Delivery confirmed on ${confirmedAt.toISOString()}. Payment pending.`,
            created_at: confirmedAt,
            updated_at: confirmedAt,
          });
          counts.ar++;
        }

        if (n === 0 && daysAgo >= 4 && daysAgo % RETURN_EVERY_DAYS === 0) {
          const returnType = daysAgo % (RETURN_EVERY_DAYS * 2) === 0 ? "damaged" : "good";
          const returned = lines[0];
          const creditAmount = parseFloat(returned.price).toFixed(2);
          const arCreditId = `${MOCK_PREFIX}ar-return-${orderKey}`;
          arRows.push({
            id: arCreditId,
            customer_id: `${MOCK_PREFIX}customer-${d.key}`,
            delivery_item_id: null,
            invoice_id: invoiceId,
            amount_due: `-${creditAmount}`,
            status: "outstanding",
            notes: `Return credit: 1x ${returned.name} (${returnType}). Mock return`,
            created_at: confirmedAt,
            updated_at: confirmedAt,
          });
          returnRows.push({
            id: `${MOCK_PREFIX}return-${orderKey}`,
            invoice_id: invoiceId,
            customer_id: `${MOCK_PREFIX}customer-${d.key}`,
            product_id: returned.productId,
            product_name: returned.name,
            qty_returned: 1,
            return_type: returnType,
            reason: RETURN_REASONS[returnType === "damaged" ? 0 : 1],
            status: "accepted",
            restored_to_pallet_id: returnType === "good" ? returned.palletId : null,
            ar_credit_id: arCreditId,
            created_by: d.agentUserId,
            reviewed_by: admin.id,
            reviewed_at: confirmedAt,
            created_at: confirmedAt,
            updated_at: confirmedAt,
          });
          counts.returns++;
        } else if (n === 1 && (daysAgo === 2 || daysAgo === 3)) {
          returnRows.push({
            id: `${MOCK_PREFIX}return-${orderKey}`,
            invoice_id: invoiceId,
            customer_id: `${MOCK_PREFIX}customer-${d.key}`,
            product_id: lines[1].productId,
            product_name: lines[1].name,
            qty_returned: 2,
            return_type: "good",
            reason: RETURN_REASONS[2],
            status: "pending",
            created_by: d.agentUserId,
            created_at: confirmedAt,
            updated_at: confirmedAt,
          });
          counts.returns++;
        }
      }
    });

    await db.insert(bookings).values(bookingRows);
    await db.insert(booking_items).values(bookingItemRows);
    await db.insert(invoices).values(invoiceRows);
    await db.insert(invoice_items).values(invoiceItemRows);
    await db.insert(order_pallets).values(palletRows);
    await db.insert(order_pallet_items).values(palletItemRows);
    if (deliveryRows.length) await db.insert(deliveries).values(deliveryRows);
    if (deliveryItemRows.length) await db.insert(delivery_items).values(deliveryItemRows);
    if (receiptRows.length) await db.insert(receipts).values(receiptRows);
    if (arRows.length) await db.insert(accounts_receivable).values(arRows);
    if (returnRows.length) await db.insert(agent_returns).values(returnRows);
  }

  console.log(
    `Seeded ${counts.orders} orders, ${counts.deliveries} delivery runs, ${counts.receipts} receipts, ` +
      `${counts.ar} AR entries, ${counts.returns} returns (${HISTORY_DAYS} days, ` +
      `${ORDERS_PER_DISTRICT_PER_DAY} orders per district per day).`,
  );
}

seedMockOrders()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
