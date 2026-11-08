import "dotenv/config";
import { eq, like } from "drizzle-orm";
import { db } from "./db";
import { bookings, customers, invoice_items, invoices, products, users } from "./db/schema";

const HISTORY_DAYS = 30;
const DAY_MS = 86_400_000;
const HOUR_MS = 3_600_000;
const PAID_AFTER_DAYS = 3;
const ORDERS_PER_DISTRICT_PER_DAY = 10;
const MOCK_PREFIX = "mock-forecast-";

const DISTRICTS = [
  { key: "a", district: "District A", store: "Mock Store A", location: "Makati City" },
  { key: "b", district: "District B", store: "Mock Store B", location: "Taguig City" },
  { key: "c", district: "District C", store: "Mock Store C", location: "Tagaytay City" },
];

async function seedSalesForecast() {
  const [admin] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.role, "admin"))
    .limit(1);
  const sampleProducts = await db
    .select({ id: products.id, name: products.name, sku: products.sku, price: products.price })
    .from(products)
    .limit(3);

  if (!admin || sampleProducts.length < 3) {
    throw new Error("Needs an admin user and 3 products. Run `pnpm db:seed` first.");
  }

  await db.delete(invoices).where(like(invoices.id, `${MOCK_PREFIX}%`));
  await db.delete(bookings).where(like(bookings.id, `${MOCK_PREFIX}%`));

  for (const d of DISTRICTS) {
    await db
      .insert(customers)
      .values({
        id: `${MOCK_PREFIX}customer-${d.key}`,
        store_name: d.store,
        location: d.location,
        district: d.district,
      })
      .onConflictDoNothing();
  }

  const todayStart = new Date();
  todayStart.setUTCHours(0, 0, 0, 0);

  for (let daysAgo = HISTORY_DAYS - 1; daysAgo >= 0; daysAgo--) {
    const dayStart = todayStart.getTime() - daysAgo * DAY_MS;
    const dateKey = new Date(dayStart).toISOString().slice(0, 10).replace(/-/g, "");
    const dayIndex = HISTORY_DAYS - 1 - daysAgo;
    const isPaid = daysAgo > PAID_AFTER_DAYS;

    const bookingRows: (typeof bookings.$inferInsert)[] = [];
    const invoiceRows: (typeof invoices.$inferInsert)[] = [];
    const itemRows: (typeof invoice_items.$inferInsert)[] = [];

    DISTRICTS.forEach((d, districtIndex) => {
      for (let n = 0; n < ORDERS_PER_DISTRICT_PER_DAY; n++) {
        const orderKey = `${dateKey}-${d.key}-${n}`;
        const bookingId = `${MOCK_PREFIX}booking-${orderKey}`;
        const invoiceId = `${MOCK_PREFIX}invoice-${orderKey}`;
        const createdAt = new Date(dayStart + (6 + n) * HOUR_MS + districtIndex * 60_000);

        const lines = sampleProducts
          .map((product, productIndex) => ({
            product,
            productIndex,
            qty: 2 + ((dayIndex * 7 + n * 3 + districtIndex * 5 + productIndex * 4) % 9),
          }))
          .filter(({ productIndex }) => productIndex === n % 3 || (dayIndex + n + productIndex) % 3 !== 0);

        let gross = 0;
        lines.forEach(({ product, qty }, lineIndex) => {
          const unitPrice = parseFloat(product.price);
          const amount = qty * unitPrice;
          gross += amount;
          itemRows.push({
            id: `${MOCK_PREFIX}item-${orderKey}-${lineIndex}`,
            invoice_id: invoiceId,
            product_id: product.id,
            product_name: product.name,
            product_sku: product.sku,
            qty_ordered: qty,
            unit_price: unitPrice.toFixed(2),
            amount: amount.toFixed(2),
            created_at: createdAt,
          });
        });

        const discount = gross * 0.02;
        bookingRows.push({
          id: bookingId,
          customer_id: `${MOCK_PREFIX}customer-${d.key}`,
          created_by: admin.id,
          status: "approved",
          created_at: createdAt,
        });
        invoiceRows.push({
          id: invoiceId,
          booking_id: bookingId,
          agent_id: admin.id,
          status: isPaid ? "paid" : "issued",
          payment_status: isPaid ? "paid" : "unpaid",
          receipt_number: `MOCK-${orderKey}`,
          customer_name: d.store,
          discount_rate: "0.02",
          gross_amount: gross.toFixed(2),
          discount_amount: discount.toFixed(2),
          total_amount: (gross - discount).toFixed(2),
          prepared_by: "mock-seed",
          created_at: createdAt,
          updated_at: createdAt,
        });
      }
    });

    await db.insert(bookings).values(bookingRows);
    await db.insert(invoices).values(invoiceRows);
    await db.insert(invoice_items).values(itemRows);
  }

  const total = HISTORY_DAYS * DISTRICTS.length * ORDERS_PER_DISTRICT_PER_DAY;
  console.log(`Added ${total} mock orders (${ORDERS_PER_DISTRICT_PER_DAY} per district per day for ${HISTORY_DAYS} days).`);
}

seedSalesForecast()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
