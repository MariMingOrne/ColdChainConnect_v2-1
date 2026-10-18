import { and, eq, inArray } from "drizzle-orm";
import { db } from "../db";
import { accounts_receivable, bookings, customers, invoices, products } from "../db/schema";
import { totalDiscountRate } from "../../shared/api";
import { CustomerCreditState } from "./credit-rules";

const DAY_MS = 86_400_000;

export interface CustomerCreditLoad {
  state: Omit<CustomerCreditState, "newOrderAmount">;
  discountRate: number;
}

export async function loadCustomerCredit(
  customerId: string,
  now: Date = new Date()
): Promise<CustomerCreditLoad | null> {
  const customer = await db.query.customers.findFirst({
    where: eq(customers.id, customerId),
    with: { discounts: true },
  });
  if (!customer) return null;

  const termsDays = customer.credit_terms_days;

  const arRows = await db.query.accounts_receivable.findMany({
    where: eq(accounts_receivable.customer_id, customerId),
  });

  let arBalance = 0;
  let overdueAmount = 0;
  let oldestOverdueDays = 0;
  const deliveredInvoiceIds = new Set<string>();

  for (const row of arRows) {
    if (row.delivery_item_id) deliveredInvoiceIds.add(row.invoice_id);
    if (row.status !== "outstanding") continue;

    const amount = Number(row.amount_due);
    arBalance += amount;

    if (!row.delivery_item_id || amount <= 0) continue;
    const ageDays = Math.floor((now.getTime() - row.created_at.getTime()) / DAY_MS);
    if (ageDays > termsDays) {
      overdueAmount += amount;
      oldestOverdueDays = Math.max(oldestOverdueDays, ageDays);
    }
  }

  let undeliveredInvoiceTotal = 0;
  const customerBookings = await db
    .select({ id: bookings.id })
    .from(bookings)
    .where(eq(bookings.customer_id, customerId));

  if (customerBookings.length > 0) {
    const unpaidInvoices = await db.query.invoices.findMany({
      where: and(
        inArray(invoices.booking_id, customerBookings.map((b) => b.id)),
        eq(invoices.payment_status, "unpaid")
      ),
    });
    for (const invoice of unpaidInvoices) {
      if (deliveredInvoiceIds.has(invoice.id)) continue;
      undeliveredInvoiceTotal += Number(invoice.total_amount ?? 0);
    }
  }

  return {
    state: {
      termsDays,
      creditLimit: customer.credit_limit === null ? null : Number(customer.credit_limit),
      arBalance,
      overdueAmount,
      oldestOverdueDays,
      undeliveredInvoiceTotal,
    },
    discountRate: totalDiscountRate(customer.discounts),
  };
}

export async function estimateOrderTotal(
  items: Array<{ product_id: string; qty_ordered: number }>,
  discountRate: number
): Promise<number> {
  const productIds = [...new Set(items.map((item) => item.product_id))];
  if (productIds.length === 0) return 0;

  const productRows = await db
    .select({ id: products.id, price: products.price })
    .from(products)
    .where(inArray(products.id, productIds));
  const priceById = new Map(productRows.map((p) => [p.id, Number(p.price)]));

  const gross = items.reduce(
    (sum, item) => sum + (priceById.get(item.product_id) ?? 0) * Number(item.qty_ordered),
    0
  );
  return gross - gross * discountRate;
}
