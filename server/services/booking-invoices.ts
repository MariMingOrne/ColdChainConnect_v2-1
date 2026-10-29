import { randomUUID } from "crypto";
import { eq } from "drizzle-orm";
import { totalDiscountRate } from "../../shared/api";
import { db } from "../db";
import { bookings, invoices, invoice_items } from "../db/schema";

function generateReceiptNumber(): string {
  const num = Math.floor(Math.random() * 99999).toString().padStart(6, "0");
  return `${num.slice(0, 3)} ${num.slice(3)}`;
}

export async function createInvoiceAfterPicking(bookingId: string) {
  return db.transaction(async (tx) => {
    await tx.select({ id: bookings.id }).from(bookings).where(eq(bookings.id, bookingId)).for("update");

    const existingInvoice = await tx.query.invoices.findFirst({
      where: eq(invoices.booking_id, bookingId),
    });
    if (existingInvoice) return { status: "existing" as const, invoice: existingInvoice };

    const booking = await tx.query.bookings.findFirst({
      where: eq(bookings.id, bookingId),
      with: {
        customer: { with: { discounts: true } },
        booking_items: { with: { product: true } },
        creator: true,
        order_pallets: { with: { items: true } },
      },
    });

    if (!booking) return { status: "not_found" as const, invoice: null };
    if (booking.status !== "approved") return { status: "not_ready" as const, invoice: null };

    const pallets = booking.order_pallets;
    if (pallets.length === 0 || pallets.some((pallet) => !["prepared", "approved", "shipped"].includes(pallet.status))) {
      return { status: "not_ready" as const, invoice: null };
    }

    const bookedQuantities = new Map<string, number>();
    for (const item of booking.booking_items) {
      bookedQuantities.set(item.product_id, (bookedQuantities.get(item.product_id) ?? 0) + item.qty_ordered);
    }

    const pickedQuantities = new Map<string, number>();
    for (const pallet of pallets) {
      for (const item of pallet.items) {
        pickedQuantities.set(item.product_id, (pickedQuantities.get(item.product_id) ?? 0) + item.qty_units);
      }
    }

    const quantitiesMatch = bookedQuantities.size === pickedQuantities.size &&
      [...bookedQuantities].every(([productId, quantity]) => pickedQuantities.get(productId) === quantity);
    if (!quantitiesMatch) return { status: "incomplete_pick" as const, invoice: null };

    const discountRate = totalDiscountRate(booking.customer?.discounts);
    const lineItems = booking.booking_items.map((item) => {
      const unitPrice = Number.parseFloat(item.product?.price ?? "0");
      return {
        product_id: item.product_id,
        product_name: item.product?.name ?? item.product_id,
        product_sku: item.product?.sku ?? null,
        qty_ordered: item.qty_ordered,
        unit_price: unitPrice,
        amount: unitPrice * item.qty_ordered,
      };
    });
    const gross = lineItems.reduce((sum, item) => sum + item.amount, 0);
    const discountAmount = gross * discountRate;
    const invoiceId = randomUUID();

    await tx.insert(invoices).values({
      id: invoiceId,
      booking_id: bookingId,
      agent_id: booking.created_by,
      status: "issued",
      payment_status: "unpaid",
      receipt_number: generateReceiptNumber(),
      customer_name: booking.customer?.store_name ?? "",
      customer_address: booking.customer?.location ?? "",
      customer_payment_type: booking.customer?.payment_type ?? "cod",
      discount_rate: String(discountRate),
      gross_amount: gross.toFixed(2),
      discount_amount: discountAmount.toFixed(2),
      total_amount: (gross - discountAmount).toFixed(2),
      prepared_by: booking.creator?.username ?? "",
    });

    if (lineItems.length > 0) {
      await tx.insert(invoice_items).values(lineItems.map((item) => ({
        id: randomUUID(),
        invoice_id: invoiceId,
        product_id: item.product_id,
        product_name: item.product_name,
        product_sku: item.product_sku,
        qty_ordered: item.qty_ordered,
        unit_price: item.unit_price.toFixed(2),
        amount: item.amount.toFixed(2),
      })));
    }

    const invoice = await tx.query.invoices.findFirst({
      where: eq(invoices.id, invoiceId),
      with: {
        invoice_items: true,
        booking: {
          with: {
            customer: true,
            booking_items: { with: { product: true } },
          },
        },
      },
    });

    return { status: "created" as const, invoice };
  });
}
