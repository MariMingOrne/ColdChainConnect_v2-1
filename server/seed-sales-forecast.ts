import "dotenv/config";
import { eq } from "drizzle-orm";
import { db } from "./db";
import { bookings, customers, invoice_items, invoices, products, users } from "./db/schema";

const HISTORY_DAYS = 30;
const DAY_MS = 86_400_000;
const BASE_DAILY_SALES = 18_000;
const DAILY_GROWTH = 120;
const PAID_AFTER_DAYS = 3;

async function seedSalesForecast() {
  const [admin] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.role, "admin"))
    .limit(1);
  const [customer] = await db.select({ id: customers.id }).from(customers).limit(1);
  const sampleProducts = await db
    .select({ id: products.id, name: products.name, sku: products.sku, price: products.price })
    .from(products)
    .limit(3);

  if (!admin || !customer || sampleProducts.length < 3) {
    throw new Error("Needs an admin user, a customer, and 3 products. Run `pnpm db:seed` first.");
  }


  const anchor = new Date();
  anchor.setUTCHours(12, 0, 0, 0);

  for (let daysAgo = HISTORY_DAYS - 1; daysAgo >= 0; daysAgo--) {
    const createdAt = new Date(anchor.getTime() - daysAgo * DAY_MS);
    const dateKey = createdAt.toISOString().slice(0, 10).replace(/-/g, "");
    const dayIndex = HISTORY_DAYS - 1 - daysAgo;

    const weekdayFactor = [0.7, 1, 1, 1, 1, 1.1, 1.2][createdAt.getUTCDay()];
    const wobble = Math.sin(dayIndex * 1.7) * 900;
    const gross = (BASE_DAILY_SALES + dayIndex * DAILY_GROWTH + wobble) * weekdayFactor;
    const discount = gross * 0.02;
    const total = gross - discount;
    const isPaid = daysAgo > PAID_AFTER_DAYS;

    const bookingId = `mock-forecast-booking-${dateKey}`;
    const invoiceId = `mock-forecast-invoice-${dateKey}`;

    await db
      .insert(bookings)
      .values({
        id: bookingId,
        customer_id: customer.id,
        created_by: admin.id,
        status: "approved",
        created_at: createdAt,
      })
      .onConflictDoNothing();

    await db
      .insert(invoices)
      .values({
        id: invoiceId,
        booking_id: bookingId,
        agent_id: admin.id,
        status: isPaid ? "paid" : "issued",
        payment_status: isPaid ? "paid" : "unpaid",
        receipt_number: `MOCK-${dateKey}`,
        customer_name: "Mock Forecast Sample",
        discount_rate: "0.02",
        gross_amount: gross.toFixed(2),
        discount_amount: discount.toFixed(2),
        total_amount: total.toFixed(2),
        prepared_by: "mock-seed",
        created_at: createdAt,
        updated_at: createdAt,
      })
      .onConflictDoNothing();

    // Sold on every day, on 80% of days, and on 40% of days respectively.
    const soldToday = [
      sampleProducts[0],
      dayIndex % 5 !== 0 ? sampleProducts[1] : null,
      dayIndex % 5 < 2 ? sampleProducts[2] : null,
    ].filter((product): product is (typeof sampleProducts)[number] => product !== null);

    for (const [lineIndex, product] of soldToday.entries()) {
      const qty = 4 + ((dayIndex * 3 + lineIndex * 5) % 9);
      const unitPrice = parseFloat(product.price);
      await db
        .insert(invoice_items)
        .values({
          id: `mock-forecast-item-${dateKey}-${lineIndex}`,
          invoice_id: invoiceId,
          product_id: product.id,
          product_name: product.name,
          product_sku: product.sku,
          qty_ordered: qty,
          unit_price: unitPrice.toFixed(2),
          amount: (qty * unitPrice).toFixed(2),
          created_at: createdAt,
        })
        .onConflictDoNothing();
    }
  }

  console.log(`Added mock invoices for the last ${HISTORY_DAYS} days (re-runs skip existing rows).`);
}

seedSalesForecast()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
